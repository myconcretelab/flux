const dns = require('node:dns').promises;
let mirrors = [];
let expires = 0;
let discovery;
async function servers() {
  if (Date.now() < expires && mirrors.length) return mirrors;
  if (!discovery) discovery = (async () => {
    try {
      const records = await dns.resolveSrv('_api._tcp.radio-browser.info');
      mirrors = records.map(r => r.name.replace(/\.$/, '')).filter(n => /^[a-z0-9-]+\.api\.radio-browser\.info$/.test(n)).sort(() => Math.random() - 0.5);
      expires = Date.now() + 3600000;
    } catch { /* Keep previously discovered mirrors on DNS failure. */ }
    if (!mirrors.length) mirrors = ['de1.api.radio-browser.info', 'at1.api.radio-browser.info'];
    return mirrors;
  })().finally(() => { discovery = null; });
  return discovery;
}
async function request(endpoint) {
  for (const host of (await servers()).slice(0, 3)) {
    try {
      const response = await fetch(`https://${host}/json/${endpoint}`, { headers: { 'User-Agent': 'Flux/1.4 (https://music.sebastienj.com)' }, signal: AbortSignal.timeout(6000) });
      if (!response.ok) throw new Error('upstream');
      return await response.json();
    } catch { /* Retry another mirror. */ }
  }
  throw new Error('Radio Browser est momentanément indisponible. Réessayez dans un instant.');
}
function searchParams(query) {
  const params = new URLSearchParams({ hidebroken: 'true', limit: '31', offset: String(Math.max(0, Math.min(10000, parseInt(query.offset, 10) || 0))), order: 'clickcount', reverse: 'true' });
  for (const key of ['name', 'tag', 'language', 'countrycode', 'bitrateMin']) {
    if (typeof query[key] === 'string' && query[key].trim()) params.set(key, query[key].trim().slice(0, 100));
  }
  if (query.order === 'name') { params.set('order', 'name'); params.set('reverse', 'false'); }
  if (query.order === 'bitrate') params.set('order', 'bitrate');
  return params;
}
module.exports = { request, searchParams };
