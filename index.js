const { addonBuilder, serveHTTP } = require("stremio-addon-sdk");
const fetch = require("node-fetch");

const manifest = {
    id: "org.strip-live.addon",
    name: "Strip Live Pro",
    version: "1.1.2",
    description: "XHamsterLive Premium Scraper",
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

// Configurazione Headers per evitare errore 500/403
const getHeaders = () => ({
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36",
    "Referer": MAIN_URL,
    "Accept": "application/json"
});

builder.defineCatalogHandler(async (args) => {
    const category = args.id || "girls";
    const url = `${MAIN_URL}/api/front/v2/models?primaryTag=${category}&limit=60&isRevised=true&nic=true`;

    try {
        const response = await fetch(url, { headers: getHeaders() });
        if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
        
        const data = await response.json();
        const metas = (data.models || []).map(m => {
            // Pulizia link immagine
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
                description: `Live: ${m.username}`
            };
        });

        return { metas };
    } catch (e) {
        console.error("Catalog Error:", e.message);
        return { metas: [] };
    }
});

builder.defineStreamHandler(async (args) => {
    const username = args.id.replace("strip_", "");
    const pageUrl = `${MAIN_URL}/${username}`;
    
    try {
        const res = await fetch(pageUrl, { headers: getHeaders() });
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
                    title: `Stream: ${username}`,
                    url: m3u8Url
                }]
            };
        }
    } catch (e) {
        console.error("Stream Error:", e.message);
    }
    return { streams: [] };
});

const port = process.env.PORT || 7000;
serveHTTP(builder.getInterface(), { port });
