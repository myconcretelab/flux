/* eslint-disable no-console */
const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const fssync = require('fs');
const path = require('path');
const icy = require('icy');
const { http, https } = require('follow-redirects');
const meta = require('./radio-metadata-utils'); // ← ta mini-lib centralisée (ICY, Icecast, RF, AzuraCast, etc.)

const radioBrowser = require('./radio-browser');
const app = express();
const PORT = process.env.PORT || 3000;
const STREAM_FILE = './streams.json';
const HAS_DIST = fssync.existsSync(path.join(__dirname, 'frontend', 'dist', 'index.html'));

app.use(cors());
app.use(express.json());
// Servez en priorité le build React si présent, sinon les fichiers statiques racine
if (HAS_DIST) {
  app.use(express.static(path.join(__dirname, 'frontend', 'dist')));
}
app.use(express.static(__dirname));

/* -------------------------- Helpers -------------------------- */
function toAbsoluteHttp(url) {
  try { const u = new URL(url); if (u.protocol === 'https:') u.protocol = 'http:'; return u.toString(); }
  catch { return url; }
}
function maybeForceHttp(url, force) { return force ? toAbsoluteHttp(url) : url; }

async function readStreams() {
  try { const data = await fs.readFile(STREAM_FILE, 'utf8'); return JSON.parse(data); }
  catch (err) { if (err.code === 'ENOENT') return []; throw err; }
}
async function writeStreams(list) {
  await fs.writeFile(STREAM_FILE + '.tmp', JSON.stringify(list, null, 2));
  await fs.rename(STREAM_FILE + '.tmp', STREAM_FILE);
}
let streamWrites = Promise.resolve();
function mutateStreams(operation) {
  const result = streamWrites.then(operation);
  streamWrites = result.catch(() => {});
  return result;
}

function getStreamWithRedirects(u, options, onResponse, onError) {
  const mod = u.startsWith('https') ? https : http;
  const req = mod.get(u, options, res => onResponse(res));
  req.on('error', onError);
  return req;
}

/* -------------------------- REST: liste -------------------------- */
app.get('/api/streams', async (_req, res) => {
  res.json(await readStreams());
});

app.put('/api/streams', async (req, res) => {
  const streams = Array.isArray(req.body.streams) ? req.body.streams : [];
  try { await mutateStreams(() => writeStreams(streams)); res.json({ ok: true }); }
  catch { res.status(500).json({ error: 'Sauvegarde impossible' }); }
});

/* Radio Browser: same-origin proxy with mirror failover. */
app.get('/api/radio-browser/search', async (req, res) => {
  try {
    const rows = await radioBrowser.request('stations/search?' + radioBrowser.searchParams(req.query));
    if (!Array.isArray(rows)) throw new Error('Réponse inattendue de Radio Browser');
    res.json({ stations: rows.slice(0, 30), hasMore: rows.length > 30 });
  } catch (err) { res.status(502).json({ error: err.message }); }
});
let countryCache;
app.get('/api/radio-browser/countries', async (_req, res) => {
  try {
    if (!countryCache || countryCache.expires < Date.now()) countryCache = { rows: await radioBrowser.request('countrycodes?hidebroken=true'), expires: Date.now() + 86400000 };
    res.json(countryCache.rows);
  } catch (err) { res.status(502).json({ error: err.message }); }
});
app.post('/api/streams/radio-browser', async (req, res) => {
  const s = req.body;
  if (!/^[a-f0-9-]{36}$/i.test(s.radioBrowserId || '') || typeof s.name !== 'string' || !s.name.trim() || typeof s.url !== 'string' || !/^https?:\/\//i.test(s.url)) return res.status(400).json({ error: 'Radio invalide' });
  try {
    const result = await mutateStreams(async () => {
      const streams = await readStreams();
      const existing = streams.find(row => row.radioBrowserId === s.radioBrowserId || row.url === s.url);
      if (existing) return { streams, duplicate: true };
      const text = (v, max = 500) => typeof v === 'string' ? v.trim().slice(0, max) : '';
      streams.push({ id: require('node:crypto').randomUUID(), radioBrowserId: s.radioBrowserId, name: text(s.name), url: text(s.url, 4096), format: text(s.format, 30), category: text(s.category, 100) || null, notes: text(s.notes, 2000), favorite: !!s.favorite, bitrate: Number(s.bitrate) || null });
      await writeStreams(streams);
      return { streams, duplicate: false };
    });
    res.json(result);
  } catch { res.status(500).json({ error: 'Enregistrement impossible. Réessayez.' }); }
});
app.post('/api/radio-browser/click/:uuid', async (req, res) => {
  if (!/^[a-f0-9-]{36}$/i.test(req.params.uuid)) return res.sendStatus(400);
  try { await radioBrowser.request('url/' + req.params.uuid); res.sendStatus(204); }
  catch { res.sendStatus(502); }
});

/* -------------------------- One-shot: /api/metadata --------------------------
   Renvoie un objet normalisé depuis la “meilleure” source possible
   (ICY → RF livemeta → Icecast → AzuraCast → Radiojar → Shoutcast → générique) */
app.get('/api/metadata', async (req, res) => {
  const originalUrl = req.query.url;
  const forceHttp = String(req.query.forceHttp || 'false').toLowerCase() === 'true';
  const waitMs = Math.max(5000, Math.min(300000, Number(req.query.waitMs || 90000))); // 5s..5min, défaut 90s
  if (!originalUrl) return res.status(400).json({ ok: false, error: 'URL manquante' });

  const finalUrl = maybeForceHttp(originalUrl, forceHttp);

  try {
    const out = await meta.getBestMetadata(finalUrl, { waitMs, allowTryMp3: true });
    // Normalisation de la réponse
    return res.json({
      ok: out.ok,
      source: out.source,
      StreamTitle: out.StreamTitle || null,
      details: out.details || null,
      reason: out.reason || undefined,
      note: out.note || undefined,
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || 'metadata-failed' });
  }
});

/* -------------------------- SSE: /api/metadata/live --------------------------
   1) tente ICY en continu (mises à jour temps réel quand dispo)
   2) si pas d’ICY ou timeout initial, envoie un “status” + un fallback via la lib meta
   3) garde la connexion ouverte (le client peut basculer en polling si besoin)
------------------------------------------------------------------------------- */
app.get('/api/metadata/live', async (req, res) => {
  const originalUrl = req.query.url;
  const forceHttp = String(req.query.forceHttp || 'false').toLowerCase() === 'true';
  const waitMs = Math.max(5000, Math.min(300000, Number(req.query.waitMs || 90000))); // 5s..5min, défaut 90s
  if (!originalUrl) return res.status(400).end('Missing url');

  const url = maybeForceHttp(originalUrl, forceHttp);

  // Prépare le canal SSE
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

  // 1) Connexion ICY directe (réception des events 'metadata')
  const streamReq = getStreamWithRedirects(
    url,
    { headers },
    icyRes => {
      const finalUrl = icyRes.responseUrl || url;
      const metaInt = icyRes.headers['icy-metaint'];

      // Pas d’ICY: informer le client, tenter un fallback “informatif”
      if (!metaInt) {
        send('status', { connected: true, icyMeta: false, redirectedTo: finalUrl, reason: 'no-icy-meta' });
        try { icyRes.destroy(); } catch {}
        // 2) Fallback unique (RF / Icecast / autres via la lib) puis on reste ouvert
        meta.getBestMetadata(finalUrl, { waitMs, allowTryMp3: true })
          .then(out => {
            // status informatif
            send('status', {
              fallbackUsed: out.source || 'none',
              StreamTitle: out.StreamTitle || null,
              reason: out.reason || undefined
            });
            // si on a un titre, l’annoncer en tant que 'metadata'
            if (out?.StreamTitle) send('metadata', { StreamTitle: out.StreamTitle });
          })
          .catch(() => { /* silencieux */ });
        return; // on garde la connexion SSE ouverte
      }

      // ICY actif → on attend le premier bloc meta (avec un timeout)
      send('status', { connected: true, icyMeta: true, redirectedTo: finalUrl });

      let timer = setTimeout(() => {
        send('status', { connected: true, icyMeta: true, timedOut: true, redirectedTo: finalUrl, reason: 'timeout-first-metadata' });
        // 2) Si rien reçu à temps, proposer quand même un fallback informatif
        meta.getBestMetadata(finalUrl, { waitMs, allowTryMp3: true })
          .then(out => {
            send('status', {
              fallbackUsed: out.source || 'none',
              StreamTitle: out.StreamTitle || null,
              reason: out.reason || undefined
            });
            if (out?.StreamTitle) send('metadata', { StreamTitle: out.StreamTitle });
          })
          .catch(() => {});
      }, waitMs);

      icyRes.on('metadata', (metadata) => {
        clearTimeout(timer);
        const parsed = icy.parse(metadata);
        send('metadata', parsed); // peut se répéter tout au long de la session
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
      // Erreur de connexion ICY → on envoie une erreur + on ferme (le client pourra repasser en polling)
      send('error', { message: err?.message || 'connect error' });
      end();
    }
  );

  // Kill request si le client coupe avant d’avoir établi la réponse
  req.on('close', () => { try { streamReq.destroy(); } catch {} });
});

/* -------------------------- SPA fallback (Vite build) -------------------------- */
// Après les routes /api, servir l'index du build si présent.
// Si aucun build n'est présent, on renvoie un message explicite.
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  if (HAS_DIST) {
    return res.sendFile(path.join(__dirname, 'frontend', 'dist', 'index.html'));
  }
  return res.status(404).send('Build Vite manquant. Exécutez "npm run build" dans le dossier frontend.');
});

/* -------------------------- Boot -------------------------- */
app.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
});
