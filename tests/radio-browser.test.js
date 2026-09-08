const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtemp, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { searchParams } = require('../radio-browser');

test('search bounds pagination and only forwards allowed filters', () => {
  const p = searchParams({ name: ' FIP ', offset: '-5', limit: '9999', order: 'name', countrycode: 'FR', url: 'https://example.com' });
  assert.equal(p.get('name'), 'FIP'); assert.equal(p.get('offset'), '0');
  assert.equal(p.get('limit'), '31'); assert.equal(p.get('reverse'), 'false');
  assert.equal(p.get('countrycode'), 'FR'); assert.equal(p.has('url'), false);
  assert.equal(p.get('hidebroken'), 'true');
});
test('add preserves existing radios, serializes concurrent writes and rejects duplicates', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'flux-test-'));
  const server = spawn(process.execPath, [path.resolve(__dirname, '../server.js')], { cwd: dir, env: { ...process.env, PORT: '3118' }, stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    await new Promise((resolve, reject) => { server.stdout.once('data', resolve); server.once('error', reject); server.once('exit', c => reject(new Error('Server exited ' + c))); });
    const base = 'http://localhost:3118';
    const send = (route, method, body) => fetch(base + route, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    await send('/api/streams', 'PUT', { streams: [{ id: 'original', name: 'Existing', url: 'https://example.com/original', category: 'Jazz' }] });
    const radio = i => ({ radioBrowserId: `12345678-1234-1234-1234-${String(i).padStart(12, '0')}`, name: 'Radio ' + i, url: 'https://example.com/' + i, category: 'Découverte', bitrate: 192, favorite: true, notes: 'Test' });
    const results = await Promise.all([1, 2, 3].map(i => send('/api/streams/radio-browser', 'POST', radio(i))));
    assert.ok(results.every(r => r.ok));
    const duplicate = await (await send('/api/streams/radio-browser', 'POST', radio(1))).json();
    assert.equal(duplicate.duplicate, true); assert.equal(duplicate.streams.length, 4);
    assert.equal(duplicate.streams[0].id, 'original'); assert.equal(duplicate.streams[1].bitrate, 192);
    const urlDuplicate = await (await send('/api/streams/radio-browser', 'POST', { ...radio(9), url: radio(1).url })).json();
    assert.equal(urlDuplicate.duplicate, true);
    assert.equal((await send('/api/streams/radio-browser', 'POST', { ...radio(4), url: 'javascript:alert(1)' })).status, 400);
    assert.equal((await (await fetch(base + '/api/streams')).json()).length, 4);
  } finally { server.kill(); await new Promise(resolve => server.once('exit', resolve)); await rm(dir, { recursive: true, force: true }); }
});
