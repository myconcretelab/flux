import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import RadioBrowser from './components/RadioBrowser'
import { Fab } from '@mui/material'
import Slides from './components/Slides'
import AppFooter from './components/AppFooter'
import { pickReadableText } from './color-utils'
import { guessStreamFormat } from './format-utils'
import { useRadioPlayer } from './use-radio-player'

// Utils
const VERSION = '1.4.4'

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function useLocalStorage(key, initialValue) {
  const [state, setState] = useState(() => {
    try {
      const v = localStorage.getItem(key)
      if (!v) return initialValue
      const parsed = JSON.parse(v)
      if (isPlainObject(initialValue) && isPlainObject(parsed)) {
        return { ...initialValue, ...parsed }
      }
      return parsed
    } catch {
      return initialValue
    }
  })
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(state)) } catch {}
  }, [key, state])
  return [state, setState]
}

function useLogs() {
  const [entries, setEntries] = useState([])
  const add = useCallback((msg, obj) => {
    const time = new Date().toLocaleTimeString()
    let detail = obj
    try {
      // Normalise quelques objets natifs (Error/MediaError)
      if (obj instanceof Error) detail = { name: obj.name, message: obj.message, stack: obj.stack }
      else if (obj && typeof obj === 'object' && 'code' in obj && 'message' in obj && 'name' in obj) detail = { name: obj.name, message: obj.message, code: obj.code }
    } catch {}
    setEntries((e) => [...e.slice(-299), { time, msg, obj: detail }])
  }, [])
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
  const [loaded, setLoaded] = useState(false)

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
      finally { if (mounted) setLoaded(true) }
    })()
    return () => { mounted = false }
  }, [])

  async function save(next) {
    try { await fetch('/api/streams', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ streams: next }) }) }
    catch (err) { console.error('Sauvegarde des flux échouée', err) }
  }
  function replaceAll(next) {
    const normalized = Array.isArray(next) ? next.map(normalizeStream) : []
    setStreams(normalized)
    save(normalized)
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

  return { streams, setStreams, upsert, remove, move, toggleFav, replaceAll, loaded }
}

function useSleepTimer(pause) {
  const [minutes, setMinutes] = useState(0)
  const [label, setLabel] = useState('')
  const etaRef = useRef(0)
  useEffect(() => {
    let timer = null
    if (minutes > 0) {
      let expired = false
      etaRef.current = Date.now() + minutes * 60 * 1000
      const tick = () => {
        if (expired) return
        const left = Math.max(0, etaRef.current - Date.now())
        const m = Math.floor(left / 60000)
        const s = Math.floor((left % 60000) / 1000)
        setLabel(`Extinction dans ${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`)
        if (left <= 0) {
          expired = true
          clearInterval(timer); timer = null; setLabel('Extinction effectuée.')
          document.removeEventListener('visibilitychange', tick)
          pause()
        }
      }
      tick()
      timer = setInterval(tick, 500)
      document.addEventListener('visibilitychange', tick)
      return () => { clearInterval(timer); document.removeEventListener('visibilitychange', tick) }
    } else { setLabel('') }
  }, [minutes, pause])
  return { minutes, setMinutes, label }
}

export default function App() {
  const [discoveryOpen, setDiscoveryOpen] = useState(false)
  const [discoveryKey, setDiscoveryKey] = useState(0)
  function openDiscovery() { setDiscoveryKey(k => k + 1); setDiscoveryOpen(true) }
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
    playerCategory: '',
    categoryColors: {},
  })
  useEffect(() => { document.body.classList.toggle('compact', !!settings.compactList) }, [settings.compactList])

  const { streams, upsert, remove, move, toggleFav, replaceAll, setStreams, loaded: streamsLoaded } = useStreams(addLog)
  const [lastId, setLastId] = useLocalStorage('lastId_v1', null)
  const UNCATEGORIZED = '__UNCATEGORIZED__'
  const FAVORITES = '__FAVORITES__'
  const categoryFilter = settings.playerCategory || ''
  const categoryColors = settings.categoryColors || {}
  const setCategoryFilter = useCallback((value) => {
    setSettings((prev) => ({ ...prev, playerCategory: value }))
  }, [setSettings])
  const categoryMigratedRef = useRef(false)
  useEffect(() => {
    if (categoryMigratedRef.current || categoryFilter) return
    categoryMigratedRef.current = true
    try {
      const stored = localStorage.getItem('categoryFilter_v1')
      if (stored) {
        const parsed = JSON.parse(stored)
        if (typeof parsed === 'string') setCategoryFilter(parsed)
        localStorage.removeItem('categoryFilter_v1')
      }
    } catch {}
  }, [categoryFilter, setCategoryFilter])

  const activeCategory = categoryFilter && categoryFilter !== UNCATEGORIZED && categoryFilter !== FAVORITES ? categoryFilter : ''
  const categoryBg = activeCategory ? categoryColors[activeCategory] : null
  const effectivePlayerBg = categoryBg || settings.playerBg

  // Apply player background via CSS variables
  useEffect(() => {
    const root = document.documentElement
    if (effectivePlayerBg) {
      root.style.setProperty('--player-bg', effectivePlayerBg)
      const fg = pickReadableText(effectivePlayerBg)
      root.style.setProperty('--player-fg', fg)
      const muted = fg === '#ffffff' ? 'rgba(255,255,255,0.8)' : '#6b7280'
      root.style.setProperty('--player-muted', muted)
    } else {
      root.style.removeProperty('--player-bg')
      root.style.removeProperty('--player-fg')
      root.style.removeProperty('--player-muted')
    }
  }, [effectivePlayerBg])
  const [libraryCategoryFilter, setLibraryCategoryFilter] = useState('')
  useEffect(() => {
    if (!streamsLoaded || libraryCategoryFilter === UNCATEGORIZED || libraryCategoryFilter === FAVORITES) return
    if (libraryCategoryFilter && !streams.some((s) => (s.category || '') === libraryCategoryFilter)) setLibraryCategoryFilter('')
  }, [streamsLoaded, streams, libraryCategoryFilter, setLibraryCategoryFilter])

  const setCategoryColor = useCallback((category, color) => {
    if (!category) return
    setSettings((prev) => ({
      ...prev,
      categoryColors: { ...(prev.categoryColors || {}), [category]: color },
    }))
  }, [setSettings])

  const clearCategoryColor = useCallback((category) => {
    if (!category) return
    setSettings((prev) => {
      const next = { ...(prev.categoryColors || {}) }
      if (Object.prototype.hasOwnProperty.call(next, category)) delete next[category]
      return { ...prev, categoryColors: next }
    })
  }, [setSettings])

  const renameCategory = useCallback((from, to) => {
    const trimmed = String(to || '').trim()
    if (!from || !trimmed || from === trimmed) return
    const nextStreams = streams.map((s) => ((s.category || '') === from ? { ...s, category: trimmed } : s))
    replaceAll(nextStreams)
    setSettings((prev) => {
      const nextColors = { ...(prev.categoryColors || {}) }
      if (Object.prototype.hasOwnProperty.call(nextColors, from)) {
        if (!Object.prototype.hasOwnProperty.call(nextColors, trimmed)) {
          nextColors[trimmed] = nextColors[from]
        }
        delete nextColors[from]
      }
      const nextPlayerCategory = prev.playerCategory === from ? trimmed : prev.playerCategory
      return { ...prev, playerCategory: nextPlayerCategory, categoryColors: nextColors }
    })
    setLibraryCategoryFilter((prev) => (prev === from ? trimmed : prev))
  }, [streams, replaceAll, setSettings, setLibraryCategoryFilter])

  const deleteCategory = useCallback((category) => {
    if (!category) return
    const nextStreams = streams.map((s) => ((s.category || '') === category ? { ...s, category: null } : s))
    replaceAll(nextStreams)
    setSettings((prev) => {
      const nextColors = { ...(prev.categoryColors || {}) }
      if (Object.prototype.hasOwnProperty.call(nextColors, category)) delete nextColors[category]
      const nextPlayerCategory = prev.playerCategory === category ? '' : prev.playerCategory
      return { ...prev, playerCategory: nextPlayerCategory, categoryColors: nextColors }
    })
    setLibraryCategoryFilter((prev) => (prev === category ? '' : prev))
  }, [streams, replaceAll, setSettings, setLibraryCategoryFilter])

  // Derived lists
  const availableCategories = useMemo(() => Array.from(new Set(streams.map((s) => (s.category || '').trim()).filter(Boolean))).sort(), [streams])
  const playerList = useMemo(() => {
    if (categoryFilter === FAVORITES) return streams.filter((s) => s.favorite)
    const filtered = categoryFilter === UNCATEGORIZED
      ? streams.filter((s) => !s.category)
      : categoryFilter
        ? streams.filter((s) => (s.category || '') === categoryFilter)
        : streams
    return filtered
  }, [streams, categoryFilter])

  const current = useMemo(() => streams.find((s) => s.id === lastId) || null, [streams, lastId])
  const { audioRef, playback, title, select, pause, toggle: onPlayPause, preview, stopPreview } = useRadioPlayer({
    current, playlist: playerList, settings, onSelect: setLastId, log: addLog,
  })
  const playing = playback.active
  const nowName = playback.station?.name || 'Aucun flux'
  const nowMeta = title
  const deezerHref = title ? 'https://www.deezer.com/search/' + encodeURIComponent(title) : ''
  const playbackMessage = playback.error || (playback.status === 'reconnecting' ? 'Reconnexion au direct…' : playback.status === 'loading' ? 'Connexion au direct…' : '')
  const { minutes: sleepMinutes, setMinutes: setSleepMinutes, label: sleepLeft } = useSleepTimer(pause)

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
      if (discoveryOpen || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || e.target.isContentEditable) return
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        const target = e.key === 'ArrowLeft' ? Math.max(0, currentSlide - 1) : Math.min(2, currentSlide + 1)
        goTo(target)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [currentSlide, discoveryOpen])

  // Actions
  function buzz() { try { if (settings.haptics && 'vibrate' in navigator) navigator.vibrate(10) } catch {} }
  function selectAndPlay(id) {
    const stream = streams.find((s) => s.id === id)
    if (!stream) return
    if (stream.radioBrowserId) fetch('/api/radio-browser/click/' + stream.radioBrowserId, { method: 'POST' }).catch(() => {})
    addLog('Sélection du flux', { id: stream.id, name: stream.name, url: stream.url })
    void select(stream)
  }

  // Form state
  const emptyForm = { id: '', name: '', url: '', format: '', favorite: false, notes: '', category: '' }
  const [form, setForm] = useState(emptyForm)
  function loadToForm(s) { setForm({ ...s, id: s.id, name: s.name, url: s.url, format: s.format || '', favorite: !!s.favorite, notes: s.notes || '', category: s.category || '' }) }
  function clearForm() { setForm(emptyForm) }
  async function submitForm(e) {
    e.preventDefault()
    const detectedFormat = form.format || guessStreamFormat(form.url)
    const data = { ...form, id: form.id || (globalThis.crypto?.randomUUID?.() || ('id-' + Math.random().toString(36).slice(2) + Date.now().toString(36))), name: form.name.trim(), url: form.url.trim(), format: detectedFormat || null, favorite: !!form.favorite, notes: form.notes || null, category: form.category?.trim() || null }
    if (!data.name || !data.url) return
    await upsert(data); clearForm(); buzz()
  }
  async function pasteFromClipboard() {
    if (!navigator.clipboard) return
    try { const txt = (await navigator.clipboard.readText()).trim(); if (txt) setForm((f) => ({ ...f, url: txt })) } catch {}
  }

  // Import / Export
  function exportJson() {
    const blob = new Blob([JSON.stringify(streams, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'streams.json'; a.click(); URL.revokeObjectURL(url)
  }
  async function importJson(file) {
    try {
      const txt = await file.text()
      const arr = JSON.parse(txt)
      if (Array.isArray(arr)) replaceAll(arr)
    } catch (e) { addLog('Import JSON invalide', e) }
  }

  const consolidateFormats = useCallback(() => {
    if (!streams.length) {
      alert('Aucun flux à consolider.')
      return
    }
    if (!confirm('Consolider les formats à partir des URLs ?')) return
    let changed = 0
    const next = streams.map((s) => {
      const detected = guessStreamFormat(s.url)
      if (!detected || (s.format || '') === detected) return s
      changed += 1
      return { ...s, format: detected }
    })
    if (!changed) {
      alert('Aucun format à mettre à jour.')
      return
    }
    replaceAll(next)
    addLog('Formats consolidés', { updated: changed })
    alert(`${changed} flux mis à jour.`)
  }, [streams, replaceAll, addLog])

  useEffect(() => {
    if (!streamsLoaded || categoryFilter === UNCATEGORIZED || categoryFilter === FAVORITES) return
    if (categoryFilter && !streams.some((s) => (s.category || '') === categoryFilter)) setCategoryFilter('')
  }, [streamsLoaded, streams, categoryFilter, setCategoryFilter])

  return (
    <>
      <Slides
        slidesRef={slidesRef}
        playerProps={{
          nowName, nowMeta, playing, playbackMessage, previewing: playback.previewing, canPlay: !!playback.station,
          onPlayPause, audioRef,
          deezerHref,
          logOpen, setLogOpen, logEntries, copyLog,
          sleepMinutes, setSleepMinutes, sleepLeft,
          playerList, lastId,
          categoryColors,
          categories: availableCategories,
          categoryFilter, setCategoryFilter, uncategorizedValue: UNCATEGORIZED, favoritesValue: FAVORITES,
          onPlayItem: (id) => { if (id === lastId && !playback.previewing) onPlayPause(); else selectAndPlay(id) },
          onToggleFav: (id) => { toggleFav(id); buzz() },
          onAddQuick: openDiscovery,
        }}
        libraryProps={{
          form, setForm,
          onSubmit: submitForm, onClear: clearForm, onPaste: pasteFromClipboard,
          manageList: streams,
          categories: availableCategories,
          categoryColors,
          onRenameCategory: renameCategory,
          onDeleteCategory: deleteCategory,
          onSetCategoryColor: setCategoryColor,
          onClearCategoryColor: clearCategoryColor,
          categoryFilter: libraryCategoryFilter,
          onChangeCategoryFilter: setLibraryCategoryFilter,
          uncategorizedValue: UNCATEGORIZED,
          favoritesValue: FAVORITES,
          onMove: move,
          onToggleFav: (id) => { toggleFav(id); buzz() },
          onEdit: loadToForm,
          onDelete: async (s) => { if (confirm(`Supprimer “${s.name}” ?`)) { await remove(s.id); if (lastId === s.id) setLastId(null); buzz() } },
          onPlay: selectAndPlay,
          onExport: exportJson,
          onImport: importJson,
          onConsolidateFormats: consolidateFormats,
        }}
        settingsProps={{
          settings,
          setSettings,
          version: VERSION,
          onSeed: () => { setStreams((prev) => prev.length ? prev : prev); alert('Exemples ajoutés.') },
          onNuke: () => {
            if (confirm('Tout réinitialiser (flux + réglages) ?')) {
              localStorage.clear(); setStreams([]); setSettings({ autoResume: true, showLockInfo: true, tryHttp: false, compactList: false, haptics: true, useSSE: true, playerBg: null, playerCategory: '', categoryColors: {} }); setLastId(null); location.reload()
            }
          }
        }}
      />

      <Fab aria-label="Ajouter une radio" onClick={openDiscovery} sx={{ position: 'fixed', right: 'max(16px, env(safe-area-inset-right))', bottom: 'calc(82px + env(safe-area-inset-bottom))', zIndex: 1100, bgcolor: 'var(--primary)', color: '#fff', '&:hover': { bgcolor: '#232b50' }, fontSize: 32 }}>+</Fab>
      <RadioBrowser key={discoveryKey} open={discoveryOpen} onClose={() => setDiscoveryOpen(false)} streams={streams} categories={availableCategories} initialCategory={activeCategory} onAdded={setStreams} onPreview={preview} onStopPreview={stopPreview} playback={playback} onManual={() => { setDiscoveryOpen(false); clearForm(); goTo(1) }} />
      <AppFooter
        activeIndex={currentSlide}
        onToPlayer={() => goTo(0)}
        onToLibrary={() => goTo(1)}
        onToSettings={() => goTo(2)}
      />
    </>
  )
}
