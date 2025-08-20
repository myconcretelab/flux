/* eslint-disable no-console */
const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const icy = require('icy');
const { http, https } = require('follow-redirects');

const app = express();
const PORT = process.env.PORT || 3000;
const STREAM_FILE = './streams.json';

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

function toAbsoluteHttp(url) {
  try { const u = new URL(url); if (u.protocol === 'https:') u.protocol = 'http:'; return u.toString(); }
  catch { return url; }
}
function maybeForceHttp(url, force) { return force ? toAbsoluteHttp(url) : url; }
function guessMount(u) {
  try { const { pathname } = new URL(u); return pathname && pathname !== '/' ? pathname : null; }
  catch { return null; }
}
async function readStreams() {
  try { const data = await fs.readFile(STREAM_FILE, 'utf8'); return JSON.parse(data); }
  catch (err) { if (err.code === 'ENOENT') return []; throw err; }
}
async function writeStreams(list) { await fs.writeFile(STREAM_FILE, JSON.stringify(list, null, 2)); }

async function fetchIcecastStatus(origin, mount) {
  const qs = mount ? `?mount=${encodeURIComponent(mount)}` : '';
  const res = await fetch(`${origin}/status-json.xsl${qs}`, {
    headers: { 'User-Agent': 'VLC/3.0 libVLC' }, redirect: 'follow'
  });
  if (!res.ok) throw new Error(`status-json not ok (${res.status})`);
  return res.json();
}
async function fetchGenericNowPlaying(origin) {
  const res = await fetch(`${origin}/nowplaying`, {
    headers: { 'User-Agent': 'VLC/3.0 libVLC' }, redirect: 'follow'
  });
  if (!res.ok) throw new Error(`nowplaying not ok (${res.status})`);
  return res.json();
}
function extractTitleFromIcecastJson(json, mount) {
  const srcs = [].concat(json?.icestats?.source || []).filter(Boolean);
  if (!srcs.length) return null;
  let source = null;
  if (mount) {
    source = srcs.find(s => (s.listenurl || '').includes(mount)) ||
             srcs.find(s => (s.server_name || '').toLowerCase().includes(mount.toLowerCase())) || null;
  }
  if (!source) source = srcs[0];
  const t = source?.title || source?.server_name || source?.stream_title;
  const artist = source?.artist || source?.song_artist;
  const song = source?.song || source?.song_title || source?.title;
  if (artist && song) return `${artist} - ${song}`;
  if (t) return t;
  if (song) return song;
  return null;
}
function getStreamWithRedirects(u, options, onResponse, onError) {
  const mod = u.startsWith('https') ? https : http;
  const req = mod.get(u, options, res => onResponse(res));
  req.on('error', onError);
  return req;
}

/* ---------- REST: list/save streams ---------- */
app.get('/api/streams', async (_req, res) => res.json(await readStreams()));
app.put('/api/streams', async (req, res) => {
  const streams = Array.isArray(req.body.streams) ? req.body.streams : [];
  await writeStreams(streams);
  res.json({ ok: true });
});

/* ---------- One-shot endpoint with diagnostics ---------- */
app.get('/api/metadata', async (req, res) => {
  const originalUrl = req.query.url;
  const forceHttp = String(req.query.forceHttp || 'false').toLowerCase() === 'true';
  if (!originalUrl) return res.status(400).json({ ok: false, error: 'URL manquante' });

  const url = maybeForceHttp(originalUrl, forceHttp);
  let answered = false;

  const finish = (obj) => {
    if (!answered) {
      answered = true;
      res.json(obj);
    }
  };

  const sendFallback = async (currentUrl, tryMp3 = true, diag = {}) => {
    try {
      const u = new URL(currentUrl);
      const origin = `${u.protocol}//${u.host}`;
      const mount = guessMount(currentUrl);

      try {
        const j = await fetchIcecastStatus(origin, mount);
        const title = extractTitleFromIcecastJson(j, mount);
        if (title) return finish({ ok: true, source: 'fallback-icecast', StreamTitle: title, fallbackUsed: 'icecast-status', ...diag });
      } catch (_) {}

      if (tryMp3 && /\.(aac|aacp)\b/i.test(u.pathname)) {
        const mp3Url = currentUrl.replace(/\.(aac|aacp)\b/i, '.mp3');
        return tryIcy(mp3Url, 15000, false, { ...diag, fallbackUsed: 'try-mp3' });
      }

      try {
        const j = await fetchGenericNowPlaying(origin);
        const title = j?.now_playing?.song?.text || j?.now_playing?.song?.title || j?.song || j?.title;
        if (title) return finish({ ok: true, source: 'fallback-nowplaying', StreamTitle: title, fallbackUsed: 'nowplaying', ...diag });
      } catch (_) {}
    } catch (_) {}

    finish({ ok: false, source: 'fallback', StreamTitle: null, reason: 'no-title-from-fallbacks', ...diag });
  };

  function tryIcy(u = url, timeoutMs = 25000, tryMp3OnFail = true, diag = {}) {
    const headers = {
      'Icy-MetaData': '1',
      'User-Agent': 'VLC/3.0 libVLC',
      'Accept': '*/*',
    };

    getStreamWithRedirects(
      u,
      { headers },
      icyRes => {
        const finalUrl = icyRes.responseUrl || u;
        const metaInt = icyRes.headers['icy-metaint'];
        if (!metaInt) {
          console.warn('[ICY] No icy-metaint -> fallback');
          icyRes.destroy();
          return sendFallback(finalUrl, tryMp3OnFail, { connected: true, icyMeta: false, redirectedTo: finalUrl, ...diag });
        }

        let timer = setTimeout(() => {
          console.warn('[ICY] Timeout waiting for metadata');
          icyRes.destroy();
          sendFallback(finalUrl, tryMp3OnFail, { connected: true, icyMeta: true, timedOut: true, redirectedTo: finalUrl, ...diag });
        }, timeoutMs);

        icyRes.on('metadata', (metadata) => {
          clearTimeout(timer);
          const parsed = icy.parse(metadata); // ex: { StreamTitle: 'Artist - Title' }
          console.log('[ICY] metadata:', parsed);
          finish({ ok: true, source: 'icy', redirectedTo: finalUrl, ...parsed });
          icyRes.destroy();
        });

        icyRes.on('error', (err) => {
          clearTimeout(timer);
          console.warn('[ICY] error:', err?.message);
          icyRes.destroy();
          sendFallback(finalUrl, tryMp3OnFail, { connected: true, icyMeta: !!metaInt, error: err?.message, redirectedTo: finalUrl, ...diag });
        });
      },
      (err) => {
        console.warn('[ICY] connect error:', err?.message);
        sendFallback(u, tryMp3OnFail, { connected: false, icyMeta: false, error: err?.message, redirectedTo: null, ...diag });
      }
    );
  }

  try { tryIcy(); } catch (e) {
    console.warn('[ICY] exception:', e?.message);
    sendFallback(url, true, { error: e?.message });
  }
});

/* ---------- SSE endpoint: pushes status/metadata ---------- */
app.get('/api/metadata/live', async (req, res) => {
  const originalUrl = req.query.url;
  const forceHttp = String(req.query.forceHttp || 'false').toLowerCase() === 'true';
  if (!originalUrl) return res.status(400).end('Missing url');

  const url = maybeForceHttp(originalUrl, forceHttp);

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  let ended = false;
  const send = (event, payload) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };
  const end = () => { if (!ended) { ended = true; send('end', { bye: true }); res.end(); } };

  const headers = {
    'Icy-MetaData': '1',
    'User-Agent': 'VLC/3.0 libVLC',
    'Accept': '*/*',
  };

  const streamReq = getStreamWithRedirects(
    url,
    { headers },
    icyRes => {
      const finalUrl = icyRes.responseUrl || url;
      const metaInt = icyRes.headers['icy-metaint'];
      if (!metaInt) {
        send('status', { connected: true, icyMeta: false, redirectedTo: finalUrl, reason: 'no-icy-meta' });
        icyRes.destroy();
        // Fallback unique (one-shot) pour fournir au moins une info
        return doFallback(finalUrl).then(x => { send('status', x); end(); });
      }

      send('status', { connected: true, icyMeta: true, redirectedTo: finalUrl });
      let timer = setTimeout(() => {
        send('status', { connected: true, icyMeta: true, timedOut: true, redirectedTo: finalUrl, reason: 'timeout-first-metadata' });
        // on peut tenter un fallback informatif sans fermer la SSE
        doFallback(finalUrl).then(x => send('status', x)).catch(()=>{});
      }, 25000);

      icyRes.on('metadata', (metadata) => {
        clearTimeout(timer);
        const parsed = icy.parse(metadata);
        send('metadata', parsed);
        // on garde la connexion ouverte pour les prochaines métadatas
      });

      icyRes.on('error', (err) => {
        clearTimeout(timer);
        send('error', { message: err?.message || 'icy error' });
        end();
      });

      // fermeture côté client (Express)
      req.on('close', () => { clearTimeout(timer); try { icyRes.destroy(); } catch {} end(); });
      res.on('close', () => { clearTimeout(timer); try { icyRes.destroy(); } catch {} end(); });
    },
    (err) => {
      send('error', { message: err?.message || 'connect error' });
      end();
    }
  );

  async function doFallback(currentUrl) {
    try {
      const u = new URL(currentUrl);
      const origin = `${u.protocol}//${u.host}`;
      const mount = guessMount(currentUrl);

      try {
        const j = await fetchIcecastStatus(origin, mount);
        const title = extractTitleFromIcecastJson(j, mount);
        if (title) return { fallbackUsed: 'icecast-status', StreamTitle: title };
      } catch (_) {}

      if (/\.(aac|aacp)\b/i.test(u.pathname)) {
        const mp3Url = currentUrl.replace(/\.(aac|aacp)\b/i, '.mp3');
        try {
          const probe = await probeIcyOnce(mp3Url, 8000);
          if (probe?.StreamTitle) return { fallbackUsed: 'try-mp3', ...probe };
        } catch (_) {}
      }

      try {
        const j = await fetchGenericNowPlaying(origin);
        const title = j?.now_playing?.song?.text || j?.now_playing?.song?.title || j?.song || j?.title;
        if (title) return { fallbackUsed: 'nowplaying', StreamTitle: title };
      } catch (_) {}
    } catch (_) {}

    return { fallbackUsed: 'none', StreamTitle: null, reason: 'no-title-from-fallbacks' };
  }

  function probeIcyOnce(u, timeoutMs) {
    return new Promise((resolve) => {
      const headers = { 'Icy-MetaData': '1', 'User-Agent': 'VLC/3.0 libVLC' };
      const r = getStreamWithRedirects(u, { headers },
        res2 => {
          const metaInt = res2.headers['icy-metaint'];
          if (!metaInt) { res2.destroy(); return resolve(null); }
          let timer = setTimeout(() => { res2.destroy(); resolve(null); }, timeoutMs);
          res2.on('metadata', m => {
            clearTimeout(timer);
            resolve(icy.parse(m));
            res2.destroy();
          });
          res2.on('error', () => { clearTimeout(timer); resolve(null); });
        },
        () => resolve(null)
      );
      setTimeout(() => { try { r.destroy(); } catch {} resolve(null); }, timeoutMs + 2000);
    });
  }
});

/* ---------- Start ---------- */
app.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
});
