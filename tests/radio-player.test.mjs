import { test } from 'node:test'
import assert from 'node:assert/strict'
import { RadioPlayer } from '../frontend/src/radio-player.js'

const fip = { id: 'fip', name: 'FIP', url: 'https://radio.test/fip', notes: 'Radio France' }
const jazz = { id: 'jazz', name: 'Jazz', url: 'https://radio.test/jazz' }
const rock = { id: 'rock', name: 'Rock', url: 'https://radio.test/rock' }

class Audio extends EventTarget {
  paused = true
  ended = false
  readyState = 4
  currentTime = 72
  loads = 0
  plays = 0
  load() { this.loads++; this.error = null; this.ended = false; this.pause() }
  pause() { if (!this.paused) { this.paused = true; this.dispatchEvent(new Event('pause')) } }
  play() {
    this.plays++
    if (this.pending) return this.pending()
    this.paused = false
    this.dispatchEvent(new Event('play'))
    this.dispatchEvent(new Event('playing'))
    return Promise.resolve()
  }
  removeAttribute(name) { if (name === 'src') this.src = '' }
}

function setup(t, { unsupported = [], noSession = false } = {}) {
  const audio = new Audio()
  const environment = new EventTarget()
  const handlers = new Map()
  const timers = new Map()
  let timerId = 0
  const states = []
  const selected = []
  environment.document = new EventTarget()
  environment.document.visibilityState = 'visible'
  environment.location = { protocol: 'https:' }
  environment.navigator = { onLine: true, audioSession: noSession ? undefined : Object.assign(new EventTarget(), { state: 'inactive' }), mediaSession: noSession ? undefined : {
    setActionHandler(name, handler) {
      if (unsupported.includes(name)) throw new Error('Unsupported action')
      handlers.set(name, handler)
    },
    setPositionState(...args) { assert.equal(args.length, 0) },
  } }
  environment.MediaMetadata = class { constructor(info) { Object.assign(this, info) } }
  environment.setTimeout = (fn, delay) => { const id = ++timerId; timers.set(id, { fn, delay }); return id }
  environment.clearTimeout = id => timers.delete(id)
  const player = new RadioPlayer(audio, { environment, onChange: s => states.push(s), onSelect: id => selected.push(id) })
  t.after(() => player.dispose())
  const nextTimer = () => {
    const [id, { fn, delay }] = [...timers.entries()].sort((a, b) => a[1].delay - b[1].delay)[0]
    timers.delete(id)
    fn()
    return delay
  }
  return { player, audio, environment, handlers, timers, states, selected, nextTimer }
}

test('selection starts synchronously and editing favorites never reloads the source', async t => {
  const { player, audio } = setup(t)
  const result = player.select(fip)
  assert.equal(audio.plays, 1, 'play stays in the initiating user gesture')
  assert.equal(await result, true)
  const loads = audio.loads
  player.restore({ ...fip, favorite: true, category: 'Jazz', name: 'FIP hifi' })
  assert.equal(audio.loads, loads)
  assert.equal(audio.paused, false)
  assert.equal(player.station.name, 'FIP hifi')
})

test('lock-screen pause preserves position and play reconnects at the live edge', async t => {
  const { player, audio, handlers, environment } = setup(t)
  await player.select(fip)
  const loads = audio.loads
  handlers.get('pause')()
  assert.equal(audio.currentTime, 72)
  assert.equal(player.status, 'paused')
  assert.equal(environment.navigator.mediaSession.playbackState, 'paused')
  handlers.get('play')()
  assert.equal(audio.loads, loads + 1)
  assert.equal(audio.src, fip.url)
  assert.equal(environment.navigator.audioSession.type, 'playback')
  assert.equal(player.status, 'playing')
})

test('OS interruptions and explicit pauses cancel reconnection, including offline/online', async t => {
  const { player, audio, environment, timers } = setup(t)
  await player.select(fip)
  audio.pause() // A call, headphones, or another app takes audio focus.
  environment.dispatchEvent(new Event('online'))
  environment.document.dispatchEvent(new Event('visibilitychange'))
  assert.equal(audio.plays, 1)
  assert.equal(player.active, false)
  assert.equal(timers.size, 0)
  await player.play()
  audio.error = { code: 2, message: 'Network lost' }
  audio.dispatchEvent(new Event('error'))
  assert.equal(timers.size, 1)
  player.pause()
  environment.dispatchEvent(new Event('online'))
  assert.equal(timers.size, 0)
  assert.equal(audio.plays, 2)
})

test('network errors reconnect with bounded backoff and a usable retry state', async t => {
  const { player, audio, nextTimer, timers } = setup(t)
  await player.select(fip)
  for (const delay of [1000, 3000, 7000]) {
    audio.error = { code: 2, message: 'Connection closed' }
    audio.dispatchEvent(new Event('error'))
    assert.equal(player.status, 'reconnecting')
    assert.equal(nextTimer(), delay)
  }
  audio.error = { code: 2, message: 'Connection closed' }
  audio.dispatchEvent(new Event('error'))
  assert.equal(player.status, 'error')
  assert.equal(player.active, false)
  assert.match(player.error, /Lecture/)
  assert.equal(timers.size, 0)
  assert.equal(await player.play(), true)
  assert.equal(player.status, 'playing')
})

test('an OS pause during a network failure cancels the queued reconnection', async t => {
  const { player, audio, timers } = setup(t)
  await player.select(fip)
  audio.error = { code: 2, message: 'Connection closed' }
  audio.dispatchEvent(new Event('error'))
  audio.pause()
  assert.equal(player.active, false)
  assert.equal(timers.size, 0)
})

test('Audio Session interruptions stop pending recovery without autoplay on focus return', async t => {
  const { player, audio, environment, timers } = setup(t)
  await player.select(fip)
  audio.dispatchEvent(new Event('waiting'))
  const session = environment.navigator.audioSession
  session.state = 'interrupted'
  session.dispatchEvent(new Event('statechange'))
  assert.equal(player.status, 'paused')
  assert.equal(timers.size, 0)
  session.state = 'active'
  session.dispatchEvent(new Event('statechange'))
  assert.equal(audio.paused, true)
  assert.equal(audio.plays, 1)
})

test('an abort requested by the browser is respected without reconnecting', async t => {
  const { player, audio, timers } = setup(t)
  await player.select(fip)
  audio.error = { code: 1, message: 'User aborted' }
  audio.dispatchEvent(new Event('error'))
  assert.equal(player.status, 'paused')
  assert.equal(timers.size, 0)
})

test('offline recovery waits for connectivity without overriding a user pause', async t => {
  const { player, audio, environment, timers, nextTimer } = setup(t)
  await player.select(fip)
  environment.navigator.onLine = false
  environment.dispatchEvent(new Event('offline'))
  audio.error = { code: 2 }
  audio.dispatchEvent(new Event('error'))
  assert.equal(timers.size, 0)
  assert.equal(player.active, true)
  environment.navigator.onLine = true
  environment.dispatchEvent(new Event('online'))
  nextTimer()
  assert.equal(audio.plays, 2)
  environment.dispatchEvent(new Event('offline'))
  player.pause()
  environment.dispatchEvent(new Event('online'))
  assert.equal(timers.size, 0)
})

test('a stalled stream reconnects, but a stream which resumes cancels the watchdog', async t => {
  const { player, audio, timers, nextTimer } = setup(t)
  await player.select(fip)
  audio.dispatchEvent(new Event('waiting'))
  assert.equal(nextTimer(), 15000)
  assert.equal(player.status, 'reconnecting')
  audio.dispatchEvent(new Event('playing'))
  assert.equal(timers.size, 0)
  audio.dispatchEvent(new Event('stalled'))
  nextTimer()
  nextTimer()
  assert.equal(audio.plays, 2)
})

test('download stalls do not interrupt audio that is still progressing from its buffer', async t => {
  const { player, audio, timers, nextTimer } = setup(t)
  await player.select(fip)
  audio.dispatchEvent(new Event('stalled'))
  audio.currentTime++
  nextTimer()
  assert.equal(audio.plays, 1)
  assert.equal(player.status, 'playing')
  audio.dispatchEvent(new Event('waiting'))
  audio.currentTime++
  audio.dispatchEvent(new Event('timeupdate'))
  assert.equal(timers.size, 0)
  assert.equal(player.status, 'playing')
})

test('rapid station changes ignore old play failures, errors, and metadata', async t => {
  const { player, audio, environment, timers } = setup(t)
  let rejectOld
  audio.pending = () => new Promise((resolve, reject) => { rejectOld = reject })
  const old = player.select(fip)
  audio.pending = null
  await player.select(jazz)
  rejectOld(new Error('Old source failed'))
  assert.equal(await old, false)
  audio.dispatchEvent(new Event('error')) // Already queued before load cleared error.
  audio.dispatchEvent(new Event('ended'))
  player.setTitle(fip.url, 'Old title')
  assert.equal(player.status, 'playing')
  assert.equal(player.station.id, jazz.id)
  assert.equal(environment.navigator.mediaSession.metadata.title, jazz.name)
  assert.equal(timers.size, 0)
})

test('metadata and next/previous commands use the currently filtered station list', async t => {
  const { player, handlers, environment, selected } = setup(t)
  player.setPlaylist([fip, jazz])
  await player.select(fip)
  player.setTitle(fip.url, 'Nina Simone — Feeling Good')
  assert.equal(environment.navigator.mediaSession.metadata.title, 'Nina Simone — Feeling Good')
  assert.equal(environment.navigator.mediaSession.metadata.artist, 'FIP')
  handlers.get('nexttrack')()
  assert.equal(player.station.id, jazz.id)
  handlers.get('nexttrack')()
  assert.equal(player.station.id, fip.id)
  handlers.get('previoustrack')()
  assert.equal(player.station.id, jazz.id)
  player.setPlaylist([rock])
  assert.equal(handlers.get('nexttrack'), null)
  assert.equal(handlers.get('seekto'), null)
  assert.deepEqual(selected, ['fip', 'jazz', 'fip', 'jazz'])
  player.configure({ showLockInfo: false })
  assert.equal(environment.navigator.mediaSession.metadata, null)
})

test('unsupported system actions cannot prevent playback or other controls', async t => {
  const { player, handlers, audio } = setup(t, { unsupported: ['stop', 'seekto'] })
  assert.equal(await player.select(fip), true)
  assert.equal(typeof handlers.get('pause'), 'function')
  handlers.get('pause')()
  assert.equal(audio.paused, true)
  handlers.get('play')()
  assert.equal(player.active, true)
})

test('previews share the main element and system controls, then restore selection paused', async t => {
  const { player, audio, handlers, selected } = setup(t)
  await player.select(fip)
  await player.select(jazz, { preview: true })
  assert.equal(audio.src, jazz.url)
  assert.equal(player.previewing, true)
  handlers.get('pause')()
  assert.equal(audio.paused, true)
  player.stopPreview()
  assert.equal(player.station.id, fip.id)
  assert.equal(player.previewing, false)
  assert.equal(player.active, false)
  assert.deepEqual(selected, ['fip'])
  assert.equal(await player.play(), true)
  assert.equal(audio.src, fip.url)
})

test('autoplay denial is visible and does not produce retry loops', async t => {
  const { player, audio, timers } = setup(t)
  audio.pending = () => Promise.reject(Object.assign(new Error('Gesture required'), { name: 'NotAllowedError' }))
  assert.equal(await player.select(fip), false)
  assert.equal(player.status, 'paused')
  assert.match(player.error, /Touchez Lecture/)
  assert.equal(timers.size, 0)
})

test('optional APIs may be absent and a restored station can start with preparation disabled', async t => {
  const { player, audio } = setup(t, { noSession: true })
  player.restore(fip, false)
  assert.equal(audio.src, '')
  assert.equal(await player.play(), true)
  assert.equal(audio.src, fip.url)
  player.restore(null)
  assert.equal(player.active, false)
  assert.equal(audio.src, '')
})

test('protocol fallback never downgrades a stream on an HTTPS page', async t => {
  const { player, audio, nextTimer } = setup(t)
  player.configure({ tryHttp: true })
  await player.select(fip)
  audio.error = { code: 2 }
  audio.dispatchEvent(new Event('error'))
  nextTimer()
  assert.equal(audio.src, fip.url)
})

test('stop and disposal release playback, cancel timers and remove system handlers', async t => {
  const { player, audio, handlers, timers, environment } = setup(t)
  await player.select(fip)
  audio.dispatchEvent(new Event('waiting'))
  handlers.get('stop')()
  assert.equal(audio.src, '')
  assert.equal(audio.currentTime, 72)
  assert.equal(player.active, false)
  assert.equal(timers.size, 0)
  await player.play()
  player.dispose()
  assert.equal(environment.navigator.mediaSession.metadata, null)
  assert.equal(handlers.get('play'), null)
  assert.equal(audio.paused, true)
  environment.dispatchEvent(new Event('online'))
  assert.equal(timers.size, 0)
})
