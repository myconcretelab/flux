const RETRY_DELAYS = [1000, 3000, 7000]
const STALL_TIMEOUT = 15000

// One media element owns playback, including previews and system controls.
export class RadioPlayer {
  constructor(audio, { onChange, onSelect, onLog = () => {}, environment = globalThis }) {
    this.audio = audio
    this.env = environment
    this.onChange = onChange
    this.onSelect = onSelect
    this.log = onLog
    this.station = null
    this.selection = null
    this.playlist = []
    this.previewing = false
    this.active = false
    this.status = 'idle'
    this.error = ''
    this.title = ''
    this.url = ''
    this.sequence = 0
    this.retryAttempt = 0
    this.retryTimer = null
    this.stallTimer = null
    this.resetting = false
    this.disposed = false
    this.options = { showLockInfo: true, tryHttp: false }
    this.listeners = []
    this.actions = new Set()

    this.listen(audio, 'play', () => {
      if (this.active) this.publish('loading')
    })
    this.listen(audio, 'playing', () => {
      if (!this.active || audio.paused || audio.readyState < 3) return
      this.clearTimers()
      this.lastTime = audio.currentTime
      this.playingSince = Date.now()
      this.log('Lecture en cours', { url: this.url })
      this.publish('playing')
    })
    this.listen(audio, 'timeupdate', () => {
      if (this.active && !audio.paused && audio.readyState >= 3 && audio.currentTime > this.lastTime) {
        this.clearTimers()
        if (this.status !== 'playing') this.publish('playing')
      }
      this.lastTime = audio.currentTime
      if (this.status === 'playing' && Date.now() - this.playingSince > 30000) this.retryAttempt = 0
    })
    this.listen(audio, 'pause', () => {
      // load() may queue a pause for the previous source after play() has begun.
      if (this.resetting || !audio.paused || !this.active) return
      if (audio.ended) return
      // An OS interruption is a pause, never an instruction to fight for focus.
      this.pause()
    })
    for (const event of ['waiting', 'stalled']) {
      this.listen(audio, event, () => {
        if (!this.active) return
        this.publish('loading')
        this.watchForStall()
      })
    }
    this.listen(audio, 'error', () => { if (audio.error) this.recover(audio.error) })
    this.listen(audio, 'ended', () => { if (audio.ended) this.recover(new Error('Le flux en direct a été interrompu')) })
    this.listen(this.env.navigator?.audioSession, 'statechange', () => {
      if (this.active && this.env.navigator.audioSession.state === 'interrupted') this.pause()
    })
    this.listen(this.env, 'offline', () => {
      if (!this.active) return
      this.clearTimers()
      this.publish('reconnecting')
    })
    this.listen(this.env, 'online', () => {
      if (this.active && this.status !== 'playing') this.recover(new Error('Connexion rétablie'))
    })
    this.listen(this.env.document, 'visibilitychange', () => {
      if (this.env.document.visibilityState !== 'visible' || !this.active) return
      if (audio.error || audio.ended) this.recover(audio.error || new Error('Flux interrompu'))
      else if (!audio.paused && audio.readyState < 3) this.watchForStall()
    })
    this.action('play', () => { void this.play() })
    this.action('pause', () => this.pause())
    this.action('stop', () => this.stop())
    for (const name of ['seekbackward', 'seekforward', 'seekto']) this.action(name, null)
    this.updateSession()
  }

  listen(target, event, handler) {
    if (!target?.addEventListener) return
    target.addEventListener(event, handler)
    this.listeners.push(() => target.removeEventListener(event, handler))
  }

  action(name, handler) {
    try {
      this.env.navigator?.mediaSession?.setActionHandler(name, handler)
      this.actions.add(name)
    } catch (error) {
      // Safari versions support different subsets of Media Session actions.
      this.log('Commande système indisponible', { action: name, message: error.message })
    }
  }

  configure(options) {
    this.options = { ...this.options, ...options }
    this.updateSession()
  }

  setPlaylist(stations) {
    this.playlist = stations
    this.updateSession()
  }

  restore(station, prepare = true) {
    this.selection = station
    if (this.previewing) return
    const resume = this.active && this.station?.id === station?.id
    const changed = this.setStation(station, false, prepare)
    if (changed && resume && station) void this.play()
  }

  setStation(station, previewing = false, prepare = true) {
    const changed = this.station?.id !== station?.id || this.station?.url !== station?.url || this.previewing !== previewing
    if (changed) {
      this.stop()
      this.station = station
      this.previewing = previewing
      this.url = station?.url || ''
      this.title = ''
      this.triedAlternate = false
      if (station && prepare) this.audio.src = this.url
    } else {
      this.station = station
    }
    this.publish()
    return changed
  }

  select(station, { preview = false } = {}) {
    if (!preview) {
      this.selection = station
      this.onSelect?.(station.id)
    }
    this.setStation(station, preview)
    return this.play()
  }

  stopPreview() {
    if (this.previewing) this.setStation(this.selection, false, false)
  }

  skip(direction) {
    if (this.previewing || this.playlist.length < 2) return
    const index = this.playlist.findIndex(s => s.id === this.station?.id)
    const next = index < 0 ? (direction > 0 ? 0 : this.playlist.length - 1) : (index + direction + this.playlist.length) % this.playlist.length
    void this.select(this.playlist[next])
  }

  setTitle(url, title) {
    if (url !== this.url) return
    this.title = title
    this.updateSession()
  }

  play() {
    if (!this.station || this.disposed) return Promise.resolve(false)
    if (this.active && !this.audio.paused && this.status === 'playing') return Promise.resolve(true)
    this.retryAttempt = 0
    this.active = true
    // A radio resumes at the live edge by opening a new connection, not seeking.
    return this.start()
  }

  async start() {
    const sequence = ++this.sequence
    this.clearTimers()
    this.error = ''
    this.publish('loading')
    try {
      this.resetting = true
      this.audio.pause()
      this.audio.src = this.url
      this.audio.load()
      this.resetting = false
      try {
        if (this.env.navigator?.audioSession) this.env.navigator.audioSession.type = 'playback'
      } catch (error) { this.log('Session audio indisponible', error) }
      // Keep play() in the user gesture; no timeout or network await before it.
      const playing = this.audio.play()
      this.watchForStall()
      await playing
      return !this.disposed && sequence === this.sequence && this.active
    } catch (error) {
      this.resetting = false
      if (this.disposed || sequence !== this.sequence || !this.active) return false
      if (error.name === 'NotAllowedError') {
        this.active = false
        this.clearTimers()
        this.error = 'Touchez Lecture pour reprendre la radio.'
        this.log('Lecture à autoriser', error)
        this.publish('paused')
      } else this.recover(error)
      return false
    }
  }

  pause() {
    this.active = false
    ++this.sequence
    this.clearTimers()
    this.audio.pause()
    this.error = ''
    this.log('Lecture en pause')
    this.publish('paused')
  }

  stop() {
    this.active = false
    ++this.sequence
    this.clearTimers()
    this.resetting = true
    this.audio.pause()
    this.audio.removeAttribute('src')
    this.audio.load()
    this.resetting = false
    this.error = ''
    this.publish('idle')
  }

  watchForStall() {
    if (this.stallTimer !== null || this.retryTimer !== null || !this.active || this.status === 'playing') return
    const position = this.audio.currentTime
    this.stallTimer = this.env.setTimeout(() => {
      this.stallTimer = null
      // stalled concerns downloading; buffered audio may still be progressing.
      if (!this.audio.paused && this.audio.readyState >= 3 && this.audio.currentTime > position) {
        this.publish('playing')
        return
      }
      this.recover(new Error('Le flux ne répond plus'))
    }, STALL_TIMEOUT)
  }

  recover(error) {
    if (!this.active || this.disposed || this.retryTimer !== null) return
    if (error.code === 1) { this.pause(); return }
    this.clearTimers()
    this.log('Reconnexion du direct', { message: error.message, code: error.code })
    this.publish('reconnecting')
    if (this.env.navigator?.onLine === false) return

    // Preserve the optional protocol fallback without attempting mixed content.
    if (this.options.tryHttp && !this.triedAlternate && /^https?:\/\//i.test(this.url)) {
      this.triedAlternate = true
      const alternate = this.url.startsWith('https:') ? this.url.replace(/^https:/, 'http:') : this.url.replace(/^http:/, 'https:')
      if (!(this.env.location?.protocol === 'https:' && alternate.startsWith('http:'))) {
        this.url = alternate
        this.retryTimer = this.env.setTimeout(() => { this.retryTimer = null; void this.start() }, 0)
        return
      }
    }
    if (this.retryAttempt >= RETRY_DELAYS.length || error.code === 4 || error.name === 'NotSupportedError') {
      this.active = false
      ++this.sequence
      this.audio.pause()
      this.error = 'Lecture interrompue. Touchez Lecture pour réessayer.'
      this.publish('error')
      return
    }
    const delay = RETRY_DELAYS[this.retryAttempt++]
    this.retryTimer = this.env.setTimeout(() => {
      this.retryTimer = null
      if (this.active && !this.disposed) void this.start()
    }, delay)
  }

  clearTimers() {
    for (const key of ['retryTimer', 'stallTimer']) {
      if (this[key] !== null) this.env.clearTimeout(this[key])
      this[key] = null
    }
  }

  publish(status = this.status) {
    this.status = status
    this.updateSession()
    if (!this.disposed) this.onChange({ station: this.station, previewing: this.previewing, url: this.url, active: this.active, status, error: this.error })
  }

  updateSession() {
    const session = this.env.navigator?.mediaSession
    if (!session) return
    try {
      session.playbackState = this.active ? 'playing' : this.status === 'idle' ? 'none' : 'paused'
      const Metadata = this.env.MediaMetadata
      session.metadata = this.station && this.options.showLockInfo && Metadata
        ? new Metadata({ title: this.title || this.station.name, artist: this.title ? this.station.name : this.station.notes || '', album: this.previewing ? 'Aperçu radio' : 'Flux · En direct' })
        : null
      // A live radio has no finite seekable timeline.
      session.setPositionState?.()
    } catch (error) { this.log('Informations écran verrouillé indisponibles', error) }
    const canSkip = !this.previewing && this.playlist.length > 1
    this.action('previoustrack', canSkip ? () => this.skip(-1) : null)
    this.action('nexttrack', canSkip ? () => this.skip(1) : null)
  }

  dispose() {
    this.disposed = true
    this.listeners.forEach(remove => remove())
    this.stop()
    for (const action of this.actions) this.action(action, null)
    const session = this.env.navigator?.mediaSession
    if (session) {
      try { session.metadata = null; session.playbackState = 'none' } catch { /* Optional API. */ }
    }
  }
}
