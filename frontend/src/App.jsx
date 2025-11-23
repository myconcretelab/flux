import { useEffect, useMemo, useRef, useState } from 'react'
import Slides from './components/Slides'
import AppFooter from './components/AppFooter'

// Utils
const VERSION = '1.3.0'

function useLocalStorage(key, initialValue) {
  const [state, setState] = useState(() => {
    try {
      const v = localStorage.getItem(key)
      return v ? JSON.parse(v) : initialValue
    } catch {
      return initialValue
    }
  })
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(state)) } catch {}
  }, [key, state])
  return [state, setState]
}

function hexToRgb(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(String(hex).trim())
  if (!m) return null
  return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) }
}
function srgbToLinear(c) {
  const s = c / 255
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
}
function luminance(rgb) {
  const r = srgbToLinear(rgb.r), g = srgbToLinear(rgb.g), b = srgbToLinear(rgb.b)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
function contrastRatio(L1, L2) {
  const a = Math.max(L1, L2) + 0.05
  const b = Math.min(L1, L2) + 0.05
  return a / b
}
function pickReadableText(bgHex) {
  const bg = hexToRgb(bgHex)
  if (!bg) return '#111827'
  const contrastBlack = contrastRatio(luminance(bg), luminance({ r: 0, g: 0, b: 0 }))
  const contrastWhite = contrastRatio(luminance(bg), luminance({ r: 255, g: 255, b: 255 }))
  return contrastWhite >= contrastBlack ? '#ffffff' : '#111827'
}

function useLogs() {
  const [entries, setEntries] = useState([])
  const add = (msg, obj) => {
    const time = new Date().toLocaleTimeString()
    let detail = obj
    try {
      // Normalise quelques objets natifs (Error/MediaError)
      if (obj instanceof Error) detail = { name: obj.name, message: obj.message, stack: obj.stack }
      else if (obj && typeof obj === 'object' && 'code' in obj && 'message' in obj && 'name' in obj) detail = { name: obj.name, message: obj.message, code: obj.code }
    } catch {}
    setEntries((e) => [...e, { time, msg, obj: detail }])
  }
  const clear = () => setEntries([])
  const copy = async () => {
    const txt = entries.map((e) => `[${e.time}] ${e.msg}\n${e.obj ? JSON.stringify(e.obj, null, 2) : ''}`).join('\n')
    try { await navigator.clipboard.writeText(txt) } catch {
      const ta = document.createElement('textarea')
      ta.value = txt
      ta.style.position = 'fixed'
      ta.style.top = '-9999px'
      document.body.appendChild(ta)
      ta.focus(); ta.select();
      try { document.execCommand('copy') } catch {}
      ta.remove()
    }
  }
  return { entries, add, clear, copy }
}

function useStreams(log) {
  const [streams, setStreams] = useState([])

  const normalizeStream = (stream) => ({
    ...stream,
    category: stream?.category || null,
  })

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const res = await fetch('/api/streams')
        const arr = await res.json()
        if (!mounted) return
        if (Array.isArray(arr) && arr.length) setStreams(arr.map(normalizeStream))
        else { const seeded = seedDemo(); setStreams(seeded); await save(seeded) }
      } catch (err) { console.error('Chargement des flux impossible', err) }
    })()
    return () => { mounted = false }
  }, [])

  async function save(next) {
    try { await fetch('/api/streams', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ streams: next }) }) }
    catch (err) { console.error('Sauvegarde des flux échouée', err) }
  }
  function seedDemo() {
    const presets = [
      { id: cryptoRandom(), name: 'FIP hifi', url: 'http://icecast.radiofrance.fr/fip-hifi.aac', format: 'aac', favorite: true, notes: 'Radio France', category: 'Découverte' },
      { id: cryptoRandom(), name: 'FIP Rock', url: 'http://icecast.radiofrance.fr/fiprock-midfi.mp3', format: 'mp3', favorite: false, notes: 'Thématique', category: 'Rock' },
      { id: cryptoRandom(), name: 'Radio Swiss Jazz', url: 'https://stream.srg-ssr.ch/m/rsj/aacp_96', format: 'aac', favorite: false, notes: 'AAC 96k', category: 'Jazz' },
    ]
    return presets.map(normalizeStream)
  }
  function cryptoRandom() { return (globalThis.crypto?.randomUUID?.() || ('id-' + Math.random().toString(36).slice(2) + Date.now().toString(36))) }

  async function upsert(stream) {
    setStreams((prev) => {
      const idx = prev.findIndex((s) => s.id === stream.id)
      const nextStream = normalizeStream(stream)
      const next = idx === -1 ? [...prev, nextStream] : prev.map((s, i) => i === idx ? nextStream : s)
      save(next)
      return next
    })
  }
  async function remove(id) {
    setStreams((prev) => { const next = prev.filter((s) => s.id !== id); save(next); return next })
  }
  async function move(from, to) {
    setStreams((prev) => {
      if (from === to) return prev
      const arr = prev.slice()
      const [it] = arr.splice(from, 1)
      arr.splice(to, 0, it)
      save(arr)
      return arr
    })
  }
  function toggleFav(id) {
    setStreams((prev) => { const arr = prev.map((s) => s.id === id ? { ...s, favorite: !s.favorite } : s); save(arr); return arr })
  }

  return { streams, setStreams, upsert, remove, move, toggleFav }
}

function useSleepTimer(audioRef) {
  const [minutes, setMinutes] = useState(0)
  const [label, setLabel] = useState('')
  const etaRef = useRef(0)
  useEffect(() => {
    let timer = null
    if (minutes > 0) {
      etaRef.current = Date.now() + minutes * 60 * 1000
      timer = setInterval(() => {
        const left = Math.max(0, etaRef.current - Date.now())
        const m = Math.floor(left / 60000)
        const s = Math.floor((left % 60000) / 1000)
        setLabel(`Extinction dans ${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`)
        if (left <= 0) {
          clearInterval(timer); timer = null; setLabel('Extinction effectuée.')
          const a = audioRef.current; if (a) { a.pause(); a.currentTime = 0 }
        }
      }, 500)
    } else { setLabel('') }
    return () => { if (timer) clearInterval(timer) }
  }, [minutes])
  return { minutes, setMinutes, label }
}

export default function App() {
  const [currentSlide, setCurrentSlide] = useState(0)
  const slidesRef = useRef(null)

  const { entries: logEntries, add: addLog, copy: copyLog } = useLogs()
  const [logOpen, setLogOpen] = useState(false)

  const [settings, setSettings] = useLocalStorage('settings_v1', {
    autoResume: true,
    showLockInfo: true,
    tryHttp: false,
    compactList: false,
    haptics: true,
    useSSE: true,
    playerBg: null,
  })
  useEffect(() => { document.body.classList.toggle('compact', !!settings.compactList) }, [settings.compactList])

  // Apply player background via CSS variables
  useEffect(() => {
    const root = document.documentElement
    if (settings.playerBg) {
      root.style.setProperty('--player-bg', settings.playerBg)
      const fg = pickReadableText(settings.playerBg)
      root.style.setProperty('--player-fg', fg)
      const muted = fg === '#ffffff' ? 'rgba(255,255,255,0.8)' : '#6b7280'
      root.style.setProperty('--player-muted', muted)
    } else {
      root.style.removeProperty('--player-bg')
      root.style.removeProperty('--player-fg')
      root.style.removeProperty('--player-muted')
    }
  }, [settings.playerBg])

  const { streams, upsert, remove, move, toggleFav, setStreams } = useStreams(addLog)
  const [lastId, setLastId] = useLocalStorage('lastId_v1', null)
  const UNCATEGORIZED = '__UNCATEGORIZED__'
  const [categoryFilter, setCategoryFilter] = useLocalStorage('categoryFilter_v1', '')

  // Player state
  const audioRef = useRef(null)
  const [playing, setPlaying] = useState(false)
  const [nowName, setNowName] = useState('Aucun flux')
  const [nowMeta, setNowMeta] = useState('')
  const [deezerHref, setDeezerHref] = useState('')

  const current = useMemo(() => streams.find((s) => s.id === lastId) || null, [streams, lastId])

  // Auto-resume on load
  useEffect(() => {
    const a = audioRef.current
    if (!a) return
    if (settings.autoResume && current) {
      setNowName(current.name)
      a.src = current.url
    }
  }, [settings.autoResume, current])

  // Audio events
  useEffect(() => {
    const a = audioRef.current
    if (!a) return
    const onPlay = () => {
      setPlaying(true); setNowMeta(''); setDeezerHref(''); addLog('Lecture démarrée')
      setMediaSession()
      try { if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing' } catch {}
      const effUrl = (audioRef.current && audioRef.current.src) || (current && current.url) || ''
      if (settings.useSSE) startSSEFor(effUrl); else startPollingFor(effUrl)
    }
    const onPause = () => { setPlaying(false); stopSSE(); stopPolling(); addLog('Lecture stoppée'); try { if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused' } catch {} }
    const onError = () => { const err = a.error; addLog('Erreur audio', err ? { code: err.code } : {}) }
    const onLoadedMeta = () => addLog('Meta audio chargées', { duration: a.duration })
    const onCanPlay = () => addLog('Prêt à lire (canplay)')
    const onCanPlayThrough = () => addLog('Prêt à lire (canplaythrough)')
    const onWaiting = () => addLog('Attente buffer (waiting)')
    const onStalled = () => addLog('Flux bloqué (stalled)')
    const onPlaying = () => addLog('Lecture en cours (playing)')
    const onEnded = () => addLog('Lecture terminée (ended)')
    a.addEventListener('play', onPlay)
    a.addEventListener('pause', onPause)
    a.addEventListener('error', onError)
    a.addEventListener('loadedmetadata', onLoadedMeta)
    a.addEventListener('canplay', onCanPlay)
    a.addEventListener('canplaythrough', onCanPlayThrough)
    a.addEventListener('waiting', onWaiting)
    a.addEventListener('stalled', onStalled)
    a.addEventListener('playing', onPlaying)
    a.addEventListener('ended', onEnded)
    return () => {
      a.removeEventListener('play', onPlay)
      a.removeEventListener('pause', onPause)
      a.removeEventListener('error', onError)
      a.removeEventListener('loadedmetadata', onLoadedMeta)
      a.removeEventListener('canplay', onCanPlay)
      a.removeEventListener('canplaythrough', onCanPlayThrough)
      a.removeEventListener('waiting', onWaiting)
      a.removeEventListener('stalled', onStalled)
      a.removeEventListener('playing', onPlaying)
      a.removeEventListener('ended', onEnded)
    }
  }, [settings.useSSE, current])

  function setMediaSession() {
    const a = audioRef.current
    if (!('mediaSession' in navigator) || !a || !current) return
    if (settings.showLockInfo) {
      // eslint-disable-next-line no-undef
      navigator.mediaSession.metadata = new window.MediaMetadata({ title: current.name, artist: current.notes || '', album: 'StreamDeck' })
    } else { navigator.mediaSession.metadata = null }
    navigator.mediaSession.setActionHandler('play', () => a.play().catch(() => {}))
    navigator.mediaSession.setActionHandler('pause', () => a.pause())
    navigator.mediaSession.setActionHandler('stop', () => { a.pause(); a.currentTime = 0 })
    navigator.mediaSession.setActionHandler('previoustrack', null)
    navigator.mediaSession.setActionHandler('nexttrack', null)
  }

  // Enregistre les handlers Media Session dès qu’un flux est sélectionné
  useEffect(() => {
    setMediaSession()
  }, [current, settings.showLockInfo])

  // Metadata (SSE / Polling)
  const sseRef = useRef(null)
  const pollRef = useRef(null)
  function stopSSE() { try { sseRef.current?.close?.() } catch {}; sseRef.current = null }
  function stopPolling() { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null } }

  function getWaitMsForCurrent() { return 0 }
  async function refreshMetadataOnceFor(url) {
    if (!url) return
    try {
      const q = new URLSearchParams({ url, forceHttp: String(!!settings.tryHttp) })
      const res = await fetch('/api/metadata?' + q.toString())
      const info = await res.json()
      handleMetadataResponse(info)
    } catch (err) { setNowMeta('erreur'); addLog('Erreur de requête', err) }
  }
  function handleMetadataResponse(info) {
    if (info?.ok) {
      const meta = info.StreamTitle || info.title || info['icy-name']
      if (meta) { showMeta(meta); addLog('Diag (one-shot OK)', info) }
      else { setNowMeta('Aucune information trouvée'); addLog('Aucune information trouvée (one-shot)', info) }
    } else { setNowMeta('Aucune info (diag dans le journal)'); addLog('Diag (one-shot)', info) }
  }
  function startPollingFor(url) {
    stopPolling(); refreshMetadataOnceFor(url); pollRef.current = setInterval(() => refreshMetadataOnceFor(url), 30000)
  }
  function startSSEFor(url) {
    stopSSE(); if (!url) return
    const wait = getWaitMsForCurrent();
    const q = new URLSearchParams({ url, forceHttp: String(!!settings.tryHttp) })
    if (wait) q.set('waitMs', String(wait))
    const sseUrl = '/api/metadata/live?' + q.toString(); addLog('Connexion SSE : ' + sseUrl)
    const es = new EventSource(sseUrl); sseRef.current = es
    es.addEventListener('open', () => addLog('SSE ouvert'))
    es.addEventListener('status', (e) => { try { const data = JSON.parse(e.data); addLog('SSE status', data); if (data?.StreamTitle) showMeta(data.StreamTitle); else setNowMeta((v) => v || '…') } catch {} })
    es.addEventListener('metadata', (e) => { try { const data = JSON.parse(e.data); const meta = data?.StreamTitle || data?.title || data?.['icy-name']; if (meta) showMeta(meta) } catch {} })
    es.addEventListener('end', () => { addLog('SSE terminé'); stopSSE(); startPollingFor(url) })
    es.onerror = () => { addLog('SSE erreur (bascule en polling)'); stopSSE(); startPollingFor(url) }
  }
  function showMeta(meta) {
    setNowMeta(meta)
    try { setDeezerHref('https://www.deezer.com/search/' + encodeURIComponent(meta)) } catch {}
  }

  // Sleep timer
  const { minutes: sleepMinutes, setMinutes: setSleepMinutes, label: sleepLeft } = useSleepTimer(audioRef)

  // Pager / slides
  useEffect(() => {
    const el = slidesRef.current
    if (!el) return
    let prev = 0
    const onScroll = () => {
      const idx = Math.round(el.scrollLeft / el.clientWidth)
      if (idx !== prev) { prev = idx; setCurrentSlide(idx) }
    }
    el.addEventListener('scroll', onScroll)
    return () => el.removeEventListener('scroll', onScroll)
  }, [])
  function goTo(idx) {
    const el = slidesRef.current; if (!el) return
    el.scrollTo({ left: el.clientWidth * idx, behavior: 'smooth' })
  }
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        const target = e.key === 'ArrowLeft' ? Math.max(0, currentSlide - 1) : Math.min(2, currentSlide + 1)
        goTo(target)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [currentSlide])

  // Actions
  function buzz() { try { if (settings.haptics && 'vibrate' in navigator) navigator.vibrate(10) } catch {} }
  const triedAltRef = useRef(false)
  function toggleProtocol(url) {
    if (!/^https?:\/\//i.test(url)) return url
    return url.startsWith('https://') ? 'http://' + url.slice('https://'.length) : 'https://' + url.slice('http://'.length)
  }
  const switchingRef = useRef(false)
  async function playUrl(url) {
    const a = audioRef.current; if (!a) return
    if (switchingRef.current) return
    switchingRef.current = true
    // Arrête toute lecture et nettoyage SSE/polling pendant le switch
    try { a.pause() } catch {}
    stopSSE(); stopPolling()
    a.src = url
    try { a.load() } catch {}

    // Fallback: relance play dès que le flux devient lisible
    const onCanPlay = async () => {
      try {
        if (a.paused) { addLog('Relance après canplay'); await a.play() }
      } catch (e) {
        if (!(e && e.name === 'AbortError')) addLog('Lecture impossible (canplay)', e || {})
      } finally {
        a.removeEventListener('canplay', onCanPlay)
        switchingRef.current = false
      }
    }
    a.addEventListener('canplay', onCanPlay, { once: true })

    // Tentative immédiate (léger délai pour laisser load() initialiser)
    try {
      await new Promise(r => setTimeout(r, 25))
      addLog('Tentative lecture', { url, readyState: a.readyState, paused: a.paused })
      a.currentTime = 0
      await a.play()
      a.removeEventListener('canplay', onCanPlay)
      switchingRef.current = false
    } catch (e) {
      if (e && e.name === 'AbortError') {
        // canplay s’en chargera
        return
      }
      addLog('Lecture impossible', e || {})
      a.removeEventListener('canplay', onCanPlay)
      if (settings.tryHttp && !triedAltRef.current) {
        const alt = toggleProtocol(url)
        if (alt && alt !== url) {
          triedAltRef.current = true
          addLog('Essai protocole alternatif', { from: url.slice(0, 5), to: alt.slice(0, 5) })
          switchingRef.current = false
          return playUrl(alt)
        }
      }
      alert('Lecture impossible. Voir journal.')
      switchingRef.current = false
    }
  }
  function selectAndPlay(id) {
    const s = streams.find((x) => x.id === id); if (!s) return
    triedAltRef.current = false
    setLastId(s.id); setNowName(s.name); addLog('Sélection du flux', { id: s.id, name: s.name, url: s.url })
    playUrl(s.url)
  }
  function onPlayPause() {
    const a = audioRef.current; if (!a) return
    if (a.paused) { if (a.ended || a.readyState === 0) a.load(); a.play().catch((e) => { addLog('Lecture impossible', e); alert('Lecture impossible. Voir journal.') }) }
    else { a.pause(); a.currentTime = 0 }
  }

  // Form state
  const emptyForm = { id: '', name: '', url: '', format: '', favorite: false, notes: '', category: '' }
  const [form, setForm] = useState(emptyForm)
  function loadToForm(s) { setForm({ id: s.id, name: s.name, url: s.url, format: s.format || '', favorite: !!s.favorite, notes: s.notes || '', category: s.category || '' }) }
  function clearForm() { setForm(emptyForm) }
  async function submitForm(e) {
    e.preventDefault()
    const data = { id: form.id || (globalThis.crypto?.randomUUID?.() || ('id-' + Math.random().toString(36).slice(2) + Date.now().toString(36))), name: form.name.trim(), url: form.url.trim(), format: form.format || null, favorite: !!form.favorite, notes: form.notes || null, category: form.category?.trim() || null }
    if (!data.name || !data.url) return
    await upsert(data); clearForm(); buzz()
  }
  async function pasteFromClipboard() {
    if (!navigator.clipboard) return
    try { const txt = (await navigator.clipboard.readText()).trim(); if (txt) setForm((f) => ({ ...f, url: txt })) } catch {}
  }
  function addQuickFromClipboard() { pasteFromClipboard(); goTo(1) }

  // Import / Export
  function exportJson() {
    const blob = new Blob([JSON.stringify(streams, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'streams.json'; a.click(); URL.revokeObjectURL(url)
  }
  async function importJson(file) {
    try { const txt = await file.text(); const arr = JSON.parse(txt); if (Array.isArray(arr)) { setStreams(arr) } } catch (e) { addLog('Import JSON invalide', e) }
  }

  // Derived lists
  const availableCategories = useMemo(() => Array.from(new Set(streams.map((s) => (s.category || '').trim()).filter(Boolean))).sort(), [streams])
  const playerList = useMemo(() => {
    const filtered = categoryFilter === UNCATEGORIZED
      ? streams.filter((s) => !s.category)
      : categoryFilter
        ? streams.filter((s) => (s.category || '') === categoryFilter)
        : streams
    return filtered.slice().sort((a, b) => (Number(!!b.favorite) - Number(!!a.favorite)) || a.name.localeCompare(b.name))
  }, [streams, categoryFilter])

  useEffect(() => {
    if (categoryFilter === UNCATEGORIZED) return
    if (categoryFilter && !streams.some((s) => (s.category || '') === categoryFilter)) setCategoryFilter('')
  }, [streams, categoryFilter])

  return (
    <>
      <Slides
        slidesRef={slidesRef}
        playerProps={{
          nowName, nowMeta, playing,
          onPlayPause, audioRef,
          deezerHref,
          logOpen, setLogOpen, logEntries, copyLog,
          sleepMinutes, setSleepMinutes, sleepLeft,
          playerList, lastId,
          categories: availableCategories,
          categoryFilter, setCategoryFilter, uncategorizedValue: UNCATEGORIZED,
          onPlayItem: (id) => { if (id === lastId && playing) { const a = audioRef.current; a.pause(); a.currentTime = 0 } else { selectAndPlay(id) } },
          onAddQuick: addQuickFromClipboard,
        }}
        libraryProps={{
          form, setForm,
          onSubmit: submitForm, onClear: clearForm, onPaste: pasteFromClipboard,
          manageList: streams,
          categories: availableCategories,
          onMove: move,
          onToggleFav: (id) => { toggleFav(id); buzz() },
          onEdit: loadToForm,
          onDelete: async (s) => { if (confirm(`Supprimer “${s.name}” ?`)) { await remove(s.id); if (lastId === s.id) setLastId(null); buzz() } },
          onPlay: selectAndPlay,
          onExport: exportJson,
          onImport: importJson,
        }}
        settingsProps={{
          settings,
          setSettings,
          version: VERSION,
          onSeed: () => { setStreams((prev) => prev.length ? prev : prev); alert('Exemples ajoutés.') },
          onNuke: () => {
            if (confirm('Tout réinitialiser (flux + réglages) ?')) {
              localStorage.clear(); setStreams([]); setSettings({ autoResume: true, showLockInfo: true, tryHttp: false, compactList: false, haptics: true, useSSE: true, playerBg: null }); setLastId(null); location.reload()
            }
          }
        }}
      />

      <AppFooter
        activeIndex={currentSlide}
        onToPlayer={() => goTo(0)}
        onToLibrary={() => goTo(1)}
        onToSettings={() => goTo(2)}
      />
    </>
  )
}
