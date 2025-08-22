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

/* -------------------------- helpers génériques -------------------------- */

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

/* -------------------------- Radio France: mapping -------------------------- */

const RF_PULL = {
  // grandes antennes
  franceinter: 1, franceinfo: 2, franceculture: 3, francemusique: 4, mouv: 6, fip: 7,
  // FIP webradios
  fiprock: 64, fipjazz: 65, fipgroove: 66, fipmonde: 69, fipnouveau: 70, fipreggae: 71, fipelectro: 74, fipmetal: 77,
  // Mouv’ extra
  mouvxtra: 75,
  // France Musique webradios
  fmclassiqueeasy: 401, fmclassiqueplus: 402, fmconcertsradiofrance: 403,
  fmocoramonde: 404, fmlajazz: 405, fmlacontemporaine: 406, fmevenementielle: 407,
};

function rfGuessPullId(streamUrl) {
  let u;
  try { u = new URL(streamUrl); } catch { return null; }
  const host = u.host.toLowerCase();
  const path = u.pathname.toLowerCase();

  // cas forts FIP
  if (path.startsWith('/fip-') || path === '/fip' || host.includes('fipradio.fr')) {
    for (const key of ['fiprock','fipjazz','fipgroove','fipmonde','fipnouveau','fipreggae','fipelectro','fipmetal']) {
      if (path.includes('/' + key.replace('fip','fip')) || path.includes(key)) return RF_PULL[key];
    }
    return RF_PULL.fip;
  }

  if (path.startsWith('/franceinter') || host.includes('franceinter.fr')) return RF_PULL.franceinter;
  if (path.startsWith('/franceinfo')  || host.includes('franceinfo.fr'))  return RF_PULL.franceinfo;
  if (path.startsWith('/franceculture') || host.includes('franceculture.fr')) return RF_PULL.franceculture;

  if (path.includes('/francemusique') || host.includes('francemusique.fr')) {
    const fmKeys = {
      'classiqueeasy':'fmclassiqueeasy','classiqueplus':'fmclassiqueplus',
      'concertsradiofrance':'fmconcertsradiofrance','ocora':'fmocoramonde','monde':'fmocoramonde',
      'lajazz':'fmlajazz','lacontemporaine':'fmlacontemporaine','evenementielle':'fmevenementielle'
    };
    for (const [frag, key] of Object.entries(fmKeys)) {
      if (path.includes(frag) && RF_PULL[key]) return RF_PULL[key];
    }
    return RF_PULL.francemusique;
  }

  if (host.includes('mouv.fr') || path.startsWith('/mouv')) {
    if (path.includes('xtra')) return RF_PULL.mouvxtra;
    return RF_PULL.mouv;
  }

  if (host.includes('radiofrance.fr')) {
    const m = path.match(/^\/([a-z]+)/);
    if (m && RF_PULL[m[1]]) return RF_PULL[m[1]];
    if (/^\/fip[-_]/.test(path)) return RF_PULL.fip;
  }

  return null;
}

/* -------------------------- RF livemeta fetch + parse tolérant -------------------------- */

function coalesce(...vals) {
  for (const v of vals) if (v !== undefined && v !== null && String(v).trim()) return String(v).trim();
  return null;
}

function deepSearchArtistTitle(obj, depth = 0) {
  if (!obj || typeof obj !== 'object' || depth > 4) return null;
  // Cherche patterns usuels
  const artist = coalesce(obj.artist, obj.authors, obj.auteurs, obj.interpretes, obj.author);
  const title  = coalesce(obj.title, obj.titre, obj.subtitle, obj.name);
  const text   = coalesce(obj.text, obj.texte, obj.song?.text);
  if (text) return text;
  if (artist && title) return `${artist} - ${title}`;
  // explore enfants
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    if (v && typeof v === 'object') {
      const hit = deepSearchArtistTitle(v, depth + 1);
      if (hit) return hit;
    }
  }
  return null;
}

async function fetchRadioFranceByPullId(pullId) {
  if (!pullId) return null;

  const bases = [
    'https://api.radiofrance.fr',
    'https://www.francemusique.fr', // pour webradios FM
  ];
  const headers = { 'User-Agent': 'VLC/3.0 libVLC', 'Accept': 'application/json' };

  for (const base of bases) {
    const url = `${base}/livemeta/pull/${pullId}`;
    try {
      console.log('[RF] GET', url);
      const r = await fetch(url, { headers, redirect: 'follow' });
      console.log('[RF] status', r.status, r.ok ? 'OK' : 'FAIL');
      const body = await r.text();
      if (!r.ok) { console.log('[RF] body(first 200):', body.slice(0,200)); continue; }
      if (!body || !body.trim().startsWith('{')) {
        console.log('[RF] non-JSON payload(first 200):', (body||'').slice(0,200));
        continue;
      }
      const j = JSON.parse(body);

      // 1) steps/levels
      if (Array.isArray(j.steps) && j.steps.length) {
        let idx = null;
        try {
          const lastLevel = j.levels?.[j.levels.length - 1];
          if (lastLevel?.items?.length) {
            const pick = lastLevel.items[lastLevel.items.length - 1];
            if (typeof pick === 'number' && j.steps[pick]) idx = pick;
          }
        } catch {}
        if (idx == null) idx = Math.max(0, j.steps.length - 2);
        const cur = j.steps[idx] || j.steps[j.steps.length - 1];
        const artist = coalesce(cur?.authors, cur?.artist, cur?.song?.artist, cur?.interpretes);
        const title  = coalesce(cur?.title, cur?.song?.title, cur?.subtitle, cur?.titre);
        const textNP = coalesce(cur?.song?.text, artist && title ? `${artist} - ${title}` : null, title, artist);
        if (textNP) { console.log('[RF] parsed from steps:', textNP); return textNP; }
      }
      // 2) now/current
      const now = j.now || j.current || j.now_playing;
      if (now) {
        const artist = coalesce(now.artist, now.authors, now.interpretes);
        const title  = coalesce(now.title, now.titre, now.subtitle);
        const textNP = coalesce(now.text, artist && title ? `${artist} - ${title}` : null, title, artist);
        if (textNP) { console.log('[RF] parsed from now:', textNP); return textNP; }
      }
      // 3) scan large récursif
      const deep = deepSearchArtistTitle(j);
      if (deep) { console.log('[RF] parsed by deep scan:', deep); return deep; }

      console.log('[RF] no usable fields at', url);
    } catch (e) {
      console.log('[RF] fetch error for', base, e?.message);
    }
  }
  return null;
}

async function fetchRadioFranceFromStreamUrl(streamUrl) {
  const pullId = rfGuessPullId(streamUrl);
  if (!pullId) return null;
  console.log('[RF] candidate pullId =', pullId, 'for', streamUrl);
  try { return await fetchRadioFranceByPullId(pullId); }
  catch (e) { console.log('[RF] error', e?.message); return null; }
}

/* -------------------------- REST: liste -------------------------- */

app.get('/api/streams', async (_req, res) => res.json(await readStreams()));
app.put('/api/streams', async (req, res) => {
  const streams = Array.isArray(req.body.streams) ? req.body.streams : [];
  await writeStreams(streams);
  res.json({ ok: true });
});

/* -------------------------- One-shot: /api/metadata -------------------------- */

app.get('/api/metadata', async (req, res) => {
  const originalUrl = req.query.url;
  const forceHttp = String(req.query.forceHttp || 'false').toLowerCase() === 'true';
  const waitMs = Math.max(5000, Math.min(300000, Number(req.query.waitMs || 90000))); // 5s..5min, défaut 90s
  if (!originalUrl) return res.status(400).json({ ok: false, error: 'URL manquante' });

  const url = maybeForceHttp(originalUrl, forceHttp);
  let answered = false;

  const finish = (obj) => { if (!answered) { answered = true; res.json(obj); } };

  const sendFallback = async (currentUrl, tryMp3 = true, diag = {}) => {
    try {
      // 0) Radio France
      try {
        const t = await fetchRadioFranceFromStreamUrl(currentUrl);
        if (t) return finish({ ok: true, source: 'fallback-rf-livemeta', StreamTitle: t, fallbackUsed: 'rf-livemeta', ...diag });
      } catch(_) {}

      const u = new URL(currentUrl);
      const origin = `${u.protocol}//${u.host}`;
      const mount = guessMount(currentUrl);

      // 1) Icecast status
      try {
        const j = await fetchIcecastStatus(origin, mount);
        const title = extractTitleFromIcecastJson(j, mount);
        if (title) return finish({ ok: true, source: 'fallback-icecast', StreamTitle: title, fallbackUsed: 'icecast-status', ...diag });
      } catch (_) {}

      // 2) essai MP3
      if (tryMp3 && /\.(aac|aacp)\b/i.test(u.pathname)) {
        const mp3Url = currentUrl.replace(/\.(aac|aacp)\b/i, '.mp3');
        return tryIcy(mp3Url, waitMs, false, { ...diag, fallbackUsed: 'try-mp3' });
      }

      // 3) nowplaying générique
      try {
        const j = await fetchGenericNowPlaying(origin);
        const title = j?.now_playing?.song?.text || j?.now_playing?.song?.title || j?.song || j?.title;
        if (title) return finish({ ok: true, source: 'fallback-nowplaying', StreamTitle: title, fallbackUsed: 'nowplaying', ...diag });
      } catch (_) {}
    } catch (_) {}

    finish({ ok: false, source: 'fallback', StreamTitle: null, reason: 'no-title-from-fallbacks', ...diag });
  };

  function tryIcy(u = url, timeoutMs = waitMs, tryMp3OnFail = true, diag = {}) {
    const headers = { 'Icy-MetaData': '1', 'User-Agent': 'VLC/3.0 libVLC', 'Accept': '*/*' };
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
          const parsed = icy.parse(metadata);
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

/* -------------------------- SSE: /api/metadata/live -------------------------- */

app.get('/api/metadata/live', async (req, res) => {
  const originalUrl = req.query.url;
  const forceHttp = String(req.query.forceHttp || 'false').toLowerCase() === 'true';
  const waitMs = Math.max(5000, Math.min(300000, Number(req.query.waitMs || 90000)));
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

  const headers = { 'Icy-MetaData': '1', 'User-Agent': 'VLC/3.0 libVLC', 'Accept': '*/*' };

  const streamReq = getStreamWithRedirects(
    url,
    { headers },
    icyRes => {
      const finalUrl = icyRes.responseUrl || url;
      const metaInt = icyRes.headers['icy-metaint'];
      if (!metaInt) {
        send('status', { connected: true, icyMeta: false, redirectedTo: finalUrl, reason: 'no-icy-meta' });
        icyRes.destroy();
        // Fallback RF/others informatif (et on RESTE ouvert)
        doFallback(finalUrl).then(x => {
          send('status', x);
          if (x?.StreamTitle) send('metadata', { StreamTitle: x.StreamTitle });
        }).catch(()=>{});
        return;
      }

      send('status', { connected: true, icyMeta: true, redirectedTo: finalUrl });
      let timer = setTimeout(() => {
        send('status', { connected: true, icyMeta: true, timedOut: true, redirectedTo: finalUrl, reason: 'timeout-first-metadata' });
        doFallback(finalUrl).then(x => {
          send('status', x);
          if (x?.StreamTitle) send('metadata', { StreamTitle: x.StreamTitle });
        }).catch(()=>{});
      }, waitMs);

      icyRes.on('metadata', (metadata) => {
        clearTimeout(timer);
        const parsed = icy.parse(metadata);
        send('metadata', parsed);
      });

      icyRes.on('error', (err) => {
        clearTimeout(timer);
        send('error', { message: err?.message || 'icy error' });
        end();
      });

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
      // 0) Radio France
      try {
        const t = await fetchRadioFranceFromStreamUrl(currentUrl);
        if (t) return { fallbackUsed: 'rf-livemeta', StreamTitle: t };
      } catch (_) {}

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
          const probe = await probeIcyOnce(mp3Url, Math.min(8000, waitMs));
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

/* -------------------------- Start -------------------------- */
app.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
});
