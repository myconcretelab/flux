// server.js
/* eslint-disable no-console */
const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const icy = require('icy');
const { http, https } = require('follow-redirects');

const app = express();
const PORT = process.env.PORT || 3000;
const STREAM_FILE = './streams.json';

// ---- Middlewares
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// ---- Helpers
function toAbsoluteHttp(url) {
  try {
    const u = new URL(url);
    if (u.protocol === 'https:') u.protocol = 'http:';
    return u.toString();
  } catch {
    return url;
  }
}

function maybeForceHttp(url, force) {
  return force ? toAbsoluteHttp(url) : url;
}

function guessMount(u) {
  try {
    const { pathname } = new URL(u);
    // ex: /fip-hifi.aac -> retourne même chose (utile pour status-json.xsl?mount=)
    return pathname && pathname !== '/' ? pathname : null;
  } catch {
    return null;
  }
}

async function readStreams() {
  try {
    const data = await fs.readFile(STREAM_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

async function writeStreams(list) {
  await fs.writeFile(STREAM_FILE, JSON.stringify(list, null, 2));
}

async function fetchIcecastStatus(origin, mount) {
  const qs = mount ? `?mount=${encodeURIComponent(mount)}` : '';
  const res = await fetch(`${origin}/status-json.xsl${qs}`, {
    headers: { 'User-Agent': 'VLC/3.0 libVLC' },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`status-json not ok (${res.status})`);
  return res.json();
}

async function fetchGenericNowPlaying(origin) {
  const res = await fetch(`${origin}/nowplaying`, {
    headers: { 'User-Agent': 'VLC/3.0 libVLC' },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`nowplaying not ok (${res.status})`);
  return res.json();
}

function extractTitleFromIcecastJson(json, mount) {
  const srcs = []
    .concat(json?.icestats?.source || [])
    .filter(Boolean);

  if (!srcs.length) return null;

  // Essayer de trouver la source qui correspond au mount
  let source = null;
  if (mount) {
    source =
      srcs.find(s => (s.listenurl || '').includes(mount)) ||
      srcs.find(s => (s.server_name || '').toLowerCase().includes(mount.toLowerCase())) ||
      null;
  }
  if (!source) source = srcs[0];

  // Champs candidats
  const t = source?.title || source?.server_name || source?.stream_title;
  // Parfois artist/title sont séparés
  const artist = source?.artist || source?.song_artist;
  const song = source?.song || source?.song_title || source?.title;

  if (artist && song) return `${artist} - ${song}`;
  if (t) return t;
  if (song) return song;
  return null;
}

// Effectuer une requête stream avec suivi de redirections
function getStreamWithRedirects(u, options, onResponse, onError) {
  const mod = u.startsWith('https') ? https : http;
  const req = mod.get(u, options, res => onResponse(res));
  req.on('error', onError);
  return req;
}

// ---- API
app.get('/api/streams', async (req, res) => {
  const streams = await readStreams();
  res.json(streams);
});

app.put('/api/streams', async (req, res) => {
  const streams = Array.isArray(req.body.streams) ? req.body.streams : [];
  await writeStreams(streams);
  res.json({ ok: true });
});

/**
 * GET /api/metadata?url=...&forceHttp=true|false
 * Renvoie une seule valeur (première metadata ICY reçue) avec fallbacks.
 */
app.get('/api/metadata', async (req, res) => {
  const originalUrl = req.query.url;
  const forceHttp = String(req.query.forceHttp || 'false').toLowerCase() === 'true';

  if (!originalUrl) return res.status(400).json({ error: 'URL manquante' });

  const url = maybeForceHttp(originalUrl, forceHttp);

  let answered = false;
  const reply = (data) => {
    if (!answered) {
      answered = true;
      res.json(data || {});
    }
  };

  // Fallback chain
  const sendFallback = async (currentUrl, alsoTryMp3 = true) => {
    try {
      const u = new URL(currentUrl);
      const origin = `${u.protocol}//${u.host}`;
      const mount = guessMount(currentUrl);

      // 1) Icecast status avec ?mount=
      try {
        const j = await fetchIcecastStatus(origin, mount);
        const title = extractTitleFromIcecastJson(j, mount);
        if (title) return reply({ StreamTitle: title });
      } catch (e) {
        // ignore
      }

      // 2) Essai MP3 si l'URL est AAC/AACP
      if (alsoTryMp3 && /\.(aac|aacp)\b/i.test(u.pathname)) {
        const mp3Url = currentUrl.replace(/\.(aac|aacp)\b/i, '.mp3');
        try {
          return tryIcy(mp3Url, 15000 /* 15s */, false /* évite boucle */);
        } catch {
          // ignore
        }
      }

      // 3) Endpoint générique nowplaying (si présent)
      try {
        const j = await fetchGenericNowPlaying(origin);
        const title =
          j?.now_playing?.song?.text ||
          j?.now_playing?.song?.title ||
          j?.song ||
          j?.title;
        if (title) return reply({ StreamTitle: title });
      } catch (e) {
        // ignore
      }
    } catch {
      // ignore
    }
    // Rien trouvé
    reply({});
  };

  function tryIcy(u = url, timeoutMs = 25000, tryMp3OnFail = true) {
    const headers = {
      'Icy-MetaData': '1',
      'User-Agent': 'VLC/3.0 libVLC',
      // Certains serveurs aiment bien un "Accept" basique
      'Accept': '*/*',
    };

    const req = getStreamWithRedirects(
      u,
      { headers },
      icyRes => {
        // follow-redirects ajoute souvent responseUrl (pas toujours)
        const finalUrl = icyRes.responseUrl || u;

        // Vérifier tout de suite la présence d'ICY
        const metaInt = icyRes.headers['icy-metaint'];
        if (!metaInt) {
          // Pas de métadonnées ICY -> fallback direct
          icyRes.destroy();
          return sendFallback(finalUrl, tryMp3OnFail);
        }

        // Attendre la première metadata ICY
        let timer = setTimeout(() => {
          icyRes.destroy();
          sendFallback(finalUrl, tryMp3OnFail);
        }, timeoutMs);

        icyRes.on('metadata', (metadata) => {
          clearTimeout(timer);
          const parsed = icy.parse(metadata);
          reply(parsed);
          icyRes.destroy();
        });

        icyRes.on('error', () => {
          clearTimeout(timer);
          icyRes.destroy();
          sendFallback(finalUrl, tryMp3OnFail);
        });
      },
      () => {
        // Erreur de connexion -> fallback
        sendFallback(u, tryMp3OnFail);
      }
    );
    return req;
  }

  try {
    tryIcy();
  } catch {
    sendFallback(url);
  }
});

// ---- Start
app.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
});
