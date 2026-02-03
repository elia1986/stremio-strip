const { addonBuilder, serveHTTP } = require("stremio-addon-sdk");
const fetch = require("node-fetch");

const manifest = {
    id: "org.xh-pro.addon",
    version: "1.6.0",
    name: "XH Live Ultimate",
    description: "XHamsterLive Scraper con bypass firewall",
    resources: ["catalog", "stream", "meta"],
    types: ["tv", "XHamsterLive"],
    idPrefixes: ["xh_"],
    catalogs: [
        {
            type: "XHamsterLive",
            id: "xh_girls",
            name: "XH Girls",
            extra: [{ name: "search", isRequired: false }]
        }
    ]
};

const builder = new addonBuilder(manifest);

// --- LOGICA CATALOGO CON BYPASS ---
builder.defineCatalogHandler(async (args) => {
    // Usiamo l'endpoint "front" che è quello che usa il sito ufficiale
    const url = `https://xhamsterlive.com/api/front/v2/models?limit=60&isRevised=true&nic=true`;

    console.log("Tentativo recupero lista...");

    try {
        const response = await fetch(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36",
                "Accept": "application/json, text/plain, */*",
                "Accept-Language": "it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7",
                "Referer": "https://xhamsterlive.com/",
                "X-Requested-With": "XMLHttpRequest",
                "Cookie": "is_bot=0; has_js=1;" // Inganiniamo il controllo bot
            }
        });

        if (!response.ok) {
            console.error(`Errore Server Sito: ${response.status}`);
            return { metas: [] };
        }

        const data = await response.json();
        const models = data.models || [];

        if (models.length === 0) console.log("Attenzione: Lista ricevuta vuota");

        const metas = models.map(m => ({
            id: `xh_${m.username}`,
            name: m.username,
            type: "XHamsterLive",
            poster: m.previewUrl || (m.preview ? `https://img.doppiocdn.net/${m.preview.url}` : ""),
            background: m.previewUrl || "",
            description: `Modella: ${m.username} - Clicca per la diretta`
        }));

        return { metas };
    } catch (e) {
        console.error("Errore fatale:", e.message);
        return { metas: [] };
    }
});

// --- META (Necessario per mostrare i dettagli) ---
builder.defineMetaHandler(async (args) => {
    const username = args.id.replace("xh_", "");
    return {
        meta: {
            id: args.id,
            name: username,
            type: "XHamsterLive",
            poster: `https://xhamsterlive.com/api/front/v2/models/${username}/preview`,
            description: `Guarda lo show di ${username} su Stremio.`
        }
    };
});

// --- STREAM (Video diretto) ---
builder.defineStreamHandler(async (args) => {
    const username = args.id.replace("xh_", "");
    try {
        const res = await fetch(`https://xhamsterlive.com/${username}`, {
            headers: { "User-Agent": "Mozilla/5.0" }
        });
        const html = await res.text();
        
        const streamName = html.split('"streamName":"')[1]?.split('"')[0];
        const streamHost = html.split('"hlsStreamHost":"')[1]?.split('"')[0];
        const urlTemplate = html.split('"hlsStreamUrlTemplate":"')[1]?.split('"')[0];

        if (streamName && streamHost) {
            const m3u8Url = urlTemplate
                .replace("{cdnHost}", streamHost)
                .replace("{streamName}", streamName)
                .replace("{suffix}", "_auto")
                .replace(/\\u002F/g, "/");

            return {
                streams: [{
                    title: "Diretta Streaming",
                    url: m3u8Url,
                    behaviorHints: { isLive: true }
                }]
            };
        }
    } catch (e) {}
    return { streams: [] };
});

const port = process.env.PORT || 7000;
serveHTTP(builder.getInterface(), { port });
