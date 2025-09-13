/* radio-metadata-utils.js
 * Dépendances: npm i icy follow-redirects
 * Node 18+ (fetch global)
 */
/* eslint-disable no-console */
const icy = require('icy');
const { http, https } = require('follow-redirects');

/* -------------------- Helpers HTTP -------------------- */

const UA = 'VLC/3.0 libVLC (+https://example.local)';
function clamp(n, a, b){ return Math.max(a, Math.min(b, n)); }

function toOrigin(u){
  const x = new URL(u);
  return `${x.protocol}//${x.host}`;
}
function guessMount(u){
  try {
    const x = new URL(u);
    return x.pathname && x.pathname !== '/' ? x.pathname : null;
  } catch { return null; }
}
function trySwapToMp3(u){
  try {
    const x = new URL(u);
    if (/\.(aac|aacp)(\?.*)?$/i.test(x.pathname)) {
      x.pathname = x.pathname.replace(/\.(aac|aacp)$/i, '.mp3');
      return x.toString();
    }
  } catch {}
  return null;
}
function getStreamWithRedirects(u, options, onResponse, onError) {
  const mod = u.startsWith('https') ? https : http;
  const req = mod.get(u, options, res => onResponse(res));
  req.on('error', onError);
  return req;
}

/* -------------------- Radio France mapping -------------------- */

const RF_PULL = {
  // Antennes principales
  franceinter: 1, franceinfo: 2, franceculture: 3, francemusique: 4, mouv: 6, fip: 7,
  // FIP webradios
  fiprock: 64, fipjazz: 65, fipgroove: 66, fipmonde: 69, fipnouveau: 70, fipreggae: 71, fipelectro: 74, fipmetal: 77,
  // Mouv’
  mouvxtra: 75,
  // France Musique webradios (exemples, étends si besoin)
  fmclassiqueeasy: 401, fmclassiqueplus: 402, fmconcertsradiofrance: 403,
  fmocoramonde: 404, fmlajazz: 405, fmlacontemporaine: 406, fmevenementielle: 407,
};

function rfGuessPullId(streamUrl) {
  let u;
  try { u = new URL(streamUrl); } catch { return null; }
  const host = u.host.toLowerCase();
  const path = u.pathname.toLowerCase();

  if (path.startsWith('/fip') || host.includes('fipradio.fr')) {
    for (const k of Object.keys(RF_PULL)) {
      if (k.startsWith('fip') && (path.includes(k) || host.includes(k))) return RF_PULL[k];
    }
    return RF_PULL.fip;
  }
  if (path.startsWith('/franceinter') || host.includes('franceinter.fr')) return RF_PULL.franceinter;
  if (path.startsWith('/franceinfo')  || host.includes('franceinfo.fr'))  return RF_PULL.franceinfo;
  if (path.startsWith('/franceculture') || host.includes('franceculture.fr')) return RF_PULL.franceculture;

  if (path.includes('/francemusique') || host.includes('francemusique.fr')) {
    const map = {
      'classiqueeasy':'fmclassiqueeasy','classiqueplus':'fmclassiqueplus',
      'concertsradiofrance':'fmconcertsradiofrance','ocora':'fmocoramonde',
      'lajazz':'fmlajazz','lacontemporaine':'fmlacontemporaine','evenementielle':'fmevenementielle'
    };
    for (const [frag, key] of Object.entries(map)) if (path.includes(frag) && RF_PULL[key]) return RF_PULL[key];
    return RF_PULL.francemusique;
  }
  if (host.includes('mouv.fr') || path.startsWith('/mouv')) return path.includes('xtra') ? RF_PULL.mouvxtra : RF_PULL.mouv;

  if (host.includes('radiofrance.fr')) {
    const m = path.match(/^\/([a-z]+)/);
    if (m && RF_PULL[m[1]]) return RF_PULL[m[1]];
    if (/^\/fip[-_]/.test(path)) return RF_PULL.fip;
  }
  return null;
}

/* -------------------- JSON utils -------------------- */

function coalesce(...vals){ for (const v of vals) if (v != null && String(v).trim()) return String(v).trim(); return null; }

function deepSearchArtistTitle(node, depth = 0) {
  if (node == null || depth > 5) return null;

  if (Array.isArray(node)) {
    for (const it of node) { const hit = deepSearchArtistTitle(it, depth + 1); if (hit) return hit; }
    return null;
  }
  if (typeof node !== 'object') return null;

  const artist = coalesce(node.artist, node.authors, node.auteurs, node.interpretes, node.author, node.performer);
  const title  = coalesce(node.title, node.titre, node.subtitle, node.name, node.label);
  const text   = coalesce(node.text, node.texte, node.song?.text, node.now?.text, node.current?.text);

  if (text) return text;
  if (artist && title) return `${artist} - ${title}`;
  if (title) return title;

  const common = coalesce(
    node?.song?.title, node?.song?.name,
    node?.track?.title, node?.track?.name,
    node?.now_playing?.song?.text, node?.now_playing?.song?.title
  );
  if (common) return common;

  for (const k of Object.keys(node)) {
    const v = node[k];
    if (v && typeof v === 'object') {
      const hit = deepSearchArtistTitle(v, depth + 1);
      if (hit) return hit;
    }
  }
  return null;
}

/* -------------------- Fetchers spécifiques -------------------- */

async function fetchJSON(url, { headers = {}, timeoutMs = 8000 } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept': 'application/json', ...headers }, redirect: 'follow', signal: ctrl.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}

/** Icecast /status-json.xsl (option mount) */
async function getIcecastStatus(url) {
  const origin = toOrigin(url);
  const mount = guessMount(url);
  const qs = mount ? `?mount=${encodeURIComponent(mount)}` : '';
  try {
    const json = await fetchJSON(`${origin}/status-json.xsl${qs}`);
    const srcs = [].concat(json?.icestats?.source || []).filter(Boolean);
    if (!srcs.length) return { ok:false, source:'icecast', reason:'no-source' };
    let s = srcs[0];
    if (mount) {
      s = srcs.find(x => (x.listenurl || '').includes(mount)) || s;
    }
    const t = s?.title || s?.server_name || s?.stream_title || s?.song;
    const artist = s?.artist || s?.song_artist;
    const song = s?.song || s?.song_title || s?.title;
    const StreamTitle = coalesce(artist && song ? `${artist} - ${song}` : null, t, song);
    if (StreamTitle) return { ok:true, source:'icecast', StreamTitle, details:{ mount, listenurl: s.listenurl } };
    return { ok:false, source:'icecast', reason:'no-title' };
  } catch (e) {
    return { ok:false, source:'icecast', reason:e.message };
  }
}

/** AzuraCast (très courant) : /api/nowplaying ou /nowplaying */
async function getAzuraCast(url) {
  const origin = toOrigin(url);
  for (const path of ['/api/nowplaying', '/nowplaying']) {
    try {
      const j = await fetchJSON(origin + path);
      const title = j?.now_playing?.song?.text || j?.now_playing?.song?.title || j?.song || j?.title;
      if (title) return { ok:true, source:'azuracast', StreamTitle: title };
    } catch { /* continue */ }
  }
  return { ok:false, source:'azuracast', reason:'no-endpoint' };
}

/** Radiojar/Revma : tentative (souvent ICY activé sinon /nowplaying) */
async function getRadiojar(url) {
  const origin = toOrigin(url);
  try {
    const j = await fetchJSON(origin + '/nowplaying');
    const title = j?.now_playing?.song?.text || j?.now_playing?.song?.title || j?.song || j?.title;
    if (title) return { ok:true, source:'radiojar', StreamTitle: title };
  } catch {}
  return { ok:false, source:'radiojar', reason:'no-nowplaying' };
}

/** Shoutcast v2 (certains serveurs exposent /stats?json=1) */
async function getShoutcast(url) {
  const origin = toOrigin(url);
  try {
    const j = await fetchJSON(origin + '/stats?json=1');
    const title = j?.songtitle || j?.current_song || j?.song || j?.title;
    if (title) return { ok:true, source:'shoutcast', StreamTitle: title };
  } catch {}
  return { ok:false, source:'shoutcast', reason:'no-stats' };
}

/** Radio France livemeta (programme/morceau) */
async function getRadioFrance(url) {
  const pullId = rfGuessPullId(url);
  if (!pullId) return { ok:false, source:'rf', reason:'no-pullid' };

  for (const base of ['https://api.radiofrance.fr', 'https://www.francemusique.fr']) {
    const endpoint = `${base}/livemeta/pull/${pullId}`;
    try {
      const r = await fetch(endpoint, { headers: { 'User-Agent': UA, 'Accept':'application/json' }, redirect:'follow' });
      if (!r.ok) continue;
      const text = await r.text();
      if (!text || !/^[{\[]/.test(text.trim())) continue;
      const j = JSON.parse(text);

      // A) steps/levels + position (cf. JSON que tu as partagé)
      const levels = j.levels || [];
      if (levels.length && levels[levels.length-1]?.items?.length) {
        const L = levels[levels.length-1];
        const items = L.items;
        let idx = Number.isInteger(L.position) ? clamp(L.position, 0, items.length-1) : items.length - 1;
        const now = Math.floor(Date.now()/1000);
        let step = j.steps?.[items[idx]];
        if (step && now < step.start && idx > 0) step = j.steps[items[--idx]];
        if (step && now >= step.end && idx < items.length-1) step = j.steps[items[++idx]];

        const textNP = coalesce(
          step?.song?.text,
          step?.authors && step?.title ? `${step.authors} - ${step.title}` : null,
          step?.title,
          step?.expressionDescription,
          step?.titleConcept
        );
        if (textNP) return { ok:true, source:'rf-livemeta', StreamTitle: textNP, details:{ pullId, stepId: step?.stepId } };
      }

      // B) plan B généraliste
      const deep = deepSearchArtistTitle(j);
      if (deep) return { ok:true, source:'rf-livemeta', StreamTitle: deep, details:{ pullId } };

    } catch {/* try next base */}
  }
  return { ok:false, source:'rf', reason:'no-usable-fields' };
}

/* -------------------- ICY (stream direct) -------------------- */

function getIcyOnce(url, { timeoutMs = 15000 } = {}) {
  return new Promise(resolve => {
    const headers = { 'Icy-MetaData': '1', 'User-Agent': UA, 'Accept': '*/*' };
    const req = getStreamWithRedirects(
      url,
      { headers },
      res => {
        const metaInt = res.headers['icy-metaint'];
        if (!metaInt) { res.destroy(); return resolve({ ok:false, source:'icy', reason:'no-icy-meta' }); }
        let timer = setTimeout(() => { try { res.destroy(); } catch {} resolve({ ok:false, source:'icy', reason:'timeout' }); }, timeoutMs);
        res.on('metadata', m => {
          clearTimeout(timer);
          const parsed = icy.parse(m);
          const title = parsed?.StreamTitle || parsed?.title || parsed?.['icy-name'];
          if (title) resolve({ ok:true, source:'icy', StreamTitle: title, details: parsed });
          else resolve({ ok:false, source:'icy', reason:'no-title' });
          try { res.destroy(); } catch {}
        });
        res.on('error', () => { clearTimeout(timer); try { res.destroy(); } catch {} resolve({ ok:false, source:'icy', reason:'stream-error' }); });
      },
      () => resolve({ ok:false, source:'icy', reason:'connect-error' })
    );
    setTimeout(() => { try { req.destroy?.(); } catch {} }, timeoutMs + 2000);
  });
}

/* -------------------- Routeur “meilleure chance” -------------------- */

function isLikelyAzura(url){
  const h = new URL(url).host.toLowerCase();
  return h.includes('azura') || h.includes('azuracast');
}
function isLikelyRadiojar(url){
  const h = new URL(url).host.toLowerCase();
  return h.includes('revma') || h.includes('radiojar');
}
function isLikelyShoutcast(url){
  const h = new URL(url).host.toLowerCase();
  return h.includes('shoutcast') || h.startsWith('sc.') || h.startsWith('streaming.') || h.includes('shout');
}

async function getBestMetadata(url, { waitMs = 90000, allowTryMp3 = true } = {}) {
  // 1) ICY direct
  const icyFirst = await getIcyOnce(url, { timeoutMs: Math.min(15000, waitMs) });
  if (icyFirst.ok) return icyFirst;

  // 2) Fallback spécifiques par hébergeur
  // Radio France
  const rf = await getRadioFrance(url);
  if (rf.ok) return rf;

  // Icecast status-json
  const ice = await getIcecastStatus(url);
  if (ice.ok) return ice;

  // AzuraCast
  if (isLikelyAzura(url)) {
    const az = await getAzuraCast(url);
    if (az.ok) return az;
  }

  // Radiojar/Revma
  if (isLikelyRadiojar(url)) {
    const rj = await getRadiojar(url);
    if (rj.ok) return rj;
  }

  // Shoutcast v2 (au cas où)
  if (isLikelyShoutcast(url)) {
    const sc = await getShoutcast(url);
    if (sc.ok) return sc;
  }

  // 3) Essayer une variante .mp3 si .aac
  if (allowTryMp3) {
    const mp3 = trySwapToMp3(url);
    if (mp3 && mp3 !== url) {
      const icyMp3 = await getIcyOnce(mp3, { timeoutMs: Math.min(12000, waitMs) });
      if (icyMp3.ok) return { ...icyMp3, details: { ...(icyMp3.details||{}), triedMp3:true }, note:'mp3-variant' };
    }
  }

  // 4) Fallback générique: /nowplaying (certains serveurs non Azura le proposent)
  try {
    const j = await fetchJSON(toOrigin(url) + '/nowplaying');
    const title = j?.now_playing?.song?.text || j?.now_playing?.song?.title || j?.song || j?.title;
    if (title) return { ok:true, source:'generic-nowplaying', StreamTitle: title };
  } catch {}

  return { ok:false, source:'auto', reason:'no-title-from-all' };
}

/* -------------------- Exports -------------------- */

module.exports = {
  // primitives
  getIcyOnce,
  getIcecastStatus,
  getAzuraCast,
  getRadiojar,
  getShoutcast,
  getRadioFrance,
  // routeur
  getBestMetadata,
};
