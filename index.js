const { addonBuilder, serveHTTP } = require("stremio-addon-sdk");
const fetch = require("node-fetch");

// 1. Configurazione del Manifest
const manifest = {
    id: "org.strip-live.addon",
    name: "Strip Live Pro",
    version: "1.2.0",
    description: "XHamsterLive Premium Scraper per Stremio",
    resources: ["catalog", "stream"],
    types: ["tv"],
    idPrefixes: ["strip_"],
    catalogs: [
        { type: "tv", id: "girls", name: "Girls - Strip" },
        { type: "tv", id: "couples", name: "Couples - Strip" },
        { type: "tv", id: "trans", name: "Trans - Strip" },
        { type: "tv", id: "men", name: "Men - Strip" }
    ]
};

const builder = new addonBuilder(manifest);
const MAIN_URL = "https://xhamsterlive.com";

// Headers standard per simulare un browser ed evitare blocchi 400/403
const commonHeaders = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://xhamsterlive.com/",
    "X-Requested-With": "XMLHttpRequest",
    "Origin": "https://xhamsterlive.com"
};

// --- GESTORE CATALOGHI (Lista Modelle) ---
builder.defineCatalogHandler(async (args) => {
    const category = args.id || "girls";
    // URL semplificato: rimosso guestHash e parametri che causano errore 400
    const url = `${MAIN_URL}/api/front/v2/models?primaryTag=${category}&limit=60&isRevised=true`;

    console.log(`[Log] Richiedo catalogo: ${category}`);

    try {
        const response = await fetch(url, { headers: commonHeaders });
        
        if (!response.ok) {
            console.error(`[Log] Errore HTTP: ${response.status}`);
            return { metas: [] };
        }

        const data = await response.json();
        const models = data.models || [];

        const metas = models.map(m => {
            // Ricostruzione corretta dei link immagine (Poster)
            let posterPath = m.previewUrl || m.thumbUrl;
            if (!posterPath && m.preview?.url) {
                posterPath = m.preview.url.startsWith('http') ? m.preview.url : `https://img.doppiocdn.net/${m.preview.url.replace(/^\//, '')}`;
            }

            return {
                id: `strip_${m.username}`,
                name: m.username,
                type: "tv",
                poster: posterPath,
                background: posterPath,
                description: `Guarda lo show live di ${m.username}`
            };
        });

        console.log(`[Log] Trovate ${metas.length} modelle.`);
        return { metas };

    } catch (e) {
        console.error("[Log] Catalog Error:", e.message);
        return { metas: [] };
    }
});

// --- GESTORE STREAM (Video) ---
builder.defineStreamHandler(async (args) => {
    const username = args.id.replace("strip_", "");
    const pageUrl = `${MAIN_URL}/${username}`;
    
    console.log(`[Log] Carico link per: ${username}`);

    try {
        const res = await fetch(pageUrl, { headers: commonHeaders });
        const html = await res.text();

        // Estrazione dati stream dall'HTML
        const streamName = html.split('"streamName":"')[1]?.split('"')[0];
        const streamHost = html.split('"hlsStreamHost":"')[1]?.split('"')[0];
        const urlTemplate = html.split('"hlsStreamUrlTemplate":"')[1]?.split('"')[0];

        if (streamName && streamHost && urlTemplate) {
            const m3u8Url = urlTemplate
                .replace("{cdnHost}", streamHost)
                .replace("{streamName}", streamName)
                .replace("{suffix}", "_auto")
                .replace(/\\u002F/g, "/");

            return {
                streams: [{
                    title: `Live - ${username}`,
                    url: m3u8Url,
                    behaviorHints: {
                        notWebReady: true,
                        proxyHeaders: { "request": { "Referer": MAIN_URL } }
                    }
                }]
            };
        }
    } catch (e) {
        console.error("[Log] Stream Error:", e.message);
    }

    return { streams: [] };
});

// Avvio Server
const port = process.env.PORT || 7000;
serveHTTP(builder.getInterface(), { port });
console.log(`Addon in ascolto sulla porta: ${port}`);
