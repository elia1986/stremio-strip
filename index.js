const { addonBuilder, serveHTTP } = require("stremio-addon-sdk");
const fetch = require("node-fetch");

// 1. Definiamo l'identità dell'Addon (Manifest)
const manifest = {
    id: "org.strip-live.addon",
    name: "Strip Live",
    version: "1.0.0",
    description: "Modelle live da XHamsterLive (NSFW)",
    resources: ["catalog", "stream"],
    types: ["tv"], // Usiamo 'tv' per i canali live
    idPrefixes: ["strip_"],
    catalogs: [
        {
            type: "tv",
            id: "strip_catalog",
            name: "Live Models",
            extra: [{ name: "search", isRequired: false }]
        }
    ]
};

const builder = new addonBuilder(manifest);

const MAIN_URL = "https://xhamsterlive.com";
const API_PARAMS = "limit=60&isRevised=true&nic=true&guestHash=a1ba5b85cbcd82cb9c6be570ddfa8a266f6461a38d55b89ea1a5fb06f0790f60";

// 2. Logica per la lista delle Modelle (Catalog)
builder.defineCatalogHandler(async (args) => {
    const url = `${MAIN_URL}/api/front/v2/models?${API_PARAMS}`;
    const response = await fetch(url);
    const data = await response.json();

    const metas = data.models.map(m => ({
        id: `strip_${m.username}`,
        name: m.username,
        type: "tv",
        poster: m.previewUrl || m.thumbUrl,
        background: m.previewUrl,
        description: `Guarda ${m.username} in diretta`
    }));

    return { metas };
});

// 3. Logica per il flusso Video (Stream)
builder.defineStreamHandler(async (args) => {
    const username = args.id.replace("strip_", "");
    const pageUrl = `${MAIN_URL}/${username}`;
    
    // Scarichiamo la pagina per trovare i dati del flusso m3u8
    const res = await fetch(pageUrl);
    const html = await res.text();

    const streamName = html.split('"streamName":"')[1]?.split('"')[0];
    const streamHost = html.split('"hlsStreamHost":"')[1]?.split('"')[0];
    const urlTemplate = html.split('"hlsStreamUrlTemplate":"')[1]?.split('"')[0];

    if (streamName && streamHost) {
        let m3u8Url = urlTemplate
            .replace("{cdnHost}", streamHost)
            .replace("{streamName}", streamName)
            .replace("{suffix}", "_auto")
            .replace(/\\u002F/g, "/");

        return {
            streams: [{
                title: "Live Stream (Auto)",
                url: m3u8Url,
                behaviorHints: { notWebReady: true }
            }]
        };
    }

    return { streams: [] };
});

// Avviamo il server sulla porta 7000
serveHTTP(builder.getInterface(), { port: 7000 });
console.log("Addon pronto su: http://localhost:7000/manifest.json");