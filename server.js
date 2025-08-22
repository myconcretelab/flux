/* eslint-disable no-console */
const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const icy = require('icy');
const { http, https } = require('follow-redirects');
const meta = require('./radio-metadata-utils'); // ← ta mini-lib centralisée (ICY, Icecast, RF, AzuraCast, etc.)

const app = express();
const PORT = process.env.PORT || 3000;
const STREAM_FILE = './streams.json';

app.use(cors());
app.use(express.json());
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
async function writeStreams(list) { await fs.writeFile(STREAM_FILE, JSON.stringify(list, null, 2)); }

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
  await writeStreams(streams);
  res.json({ ok: true });
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

/* -------------------------- Boot -------------------------- */
app.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
});
