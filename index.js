const { addonBuilder, serveHTTP } = require("stremio-addon-sdk");
const fetch = require("node-fetch");

const NAME = "XHamsterLive Pro";
const ID_PREFIX = "xh_";
const TYPE = "XHamsterLive"; // Tipo personalizzato per separarlo dai canali TV normali

const manifest = {
    id: "org.xhamsterlive.pro",
    version: "1.5.0",
    name: NAME,
    description: "Addon professionale per XHamsterLive con filtri e categorie",
    logo: "https://i.ibb.co/pdbYM1R/image.png", // Puoi cambiarlo con un logo XH
    resources: ["catalog", "meta", "stream"],
    types: [TYPE],
    idPrefixes: [ID_PREFIX],
    catalogs: [
        {
            type: TYPE,
            id: "xh_popular",
            name: "XHamster Live",
            extra: [
                {
                    name: "genre",
                    options: ["Girls", "Couples", "Trans", "Men"],
                    isRequired: false
                }
            ]
        }
    ]
};

const builder = new addonBuilder(manifest);
const MAIN_URL = "https://xhamsterlive.com";
const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
    "Referer": MAIN_URL
};

// --- 1. CATALOGO (La lista delle miniature) ---
builder.defineCatalogHandler(async (args) => {
    const genre = args.extra.genre ? args.extra.genre.toLowerCase() : "girls";
    const url = `${MAIN_URL}/api/front/v2/models?primaryTag=${genre}&limit=60&isRevised=true`;

    try {
        const res = await fetch(url, { headers });
        const data = await res.json();
        
        const metas = (data.models || []).map(m => ({
            id: `${ID_PREFIX}${m.username}`,
            name: m.username,
            type: TYPE,
            poster: m.previewUrl || `https://img.doppiocdn.net/${m.preview?.url}`,
            background: m.previewUrl || `https://img.doppiocdn.net/${m.preview?.url}`,
            description: `Modella Live: ${m.username}`
        }));

        return { metas };
    } catch (e) {
        return { metas: [] };
    }
});

// --- 2. META (La scheda dettagliata che si apre prima del video) ---
builder.defineMetaHandler(async (args) => {
    const username = args.id.replace(ID_PREFIX, "");
    const poster = `https://xhamsterlive.com/api/front/v2/models/${username}/preview`;

    return {
        meta: {
            id: args.id,
            name: username,
            type: TYPE,
            poster: poster,
            background: poster,
            description: `Stai per guardare lo show live di ${username}.`,
            runtime: "LIVE"
        }
    };
});

// --- 3. STREAM (Il flusso video vero e proprio) ---
builder.defineStreamHandler(async (args) => {
    const username = args.id.replace(ID_PREFIX, "");
    const pageUrl = `${MAIN_URL}/${username}`;

    try {
        const res = await fetch(pageUrl, { headers });
        const html = await res.text();

        const streamName = html.split('"streamName":"')[1]?.split('"')[0];
        const streamHost = html.split('"hlsStreamHost":"')[1]?.split('"')[0];
        const urlTemplate = html.split('"hlsStreamUrlTemplate":"')[1]?.split('"')[0];

        if (streamName && streamHost && urlTemplate) {
            let m3u8Url = urlTemplate
                .replace("{cdnHost}", streamHost)
                .replace("{streamName}", streamName)
                .replace("{suffix}", "_auto")
                .replace(/\\u002F/g, "/");

            return {
                streams: [{
                    title: `Riproduci Live: ${username}`,
                    url: m3u8Url,
                    behaviorHints: {
                        notWebReady: false,
                        isLive: true,
                        proxyHeaders: { "request": { "Referer": MAIN_URL } }
                    }
                }]
            };
        }
    } catch (e) {
        console.error("Errore Stream:", e);
    }
    return { streams: [] };
});

const port = process.env.PORT || 7000;
serveHTTP(builder.getInterface(), { port });
