import { useCallback, useEffect, useRef, useState } from 'react'
import { RadioPlayer } from './radio-player'

export function useRadioPlayer({ current, playlist, settings, onSelect, log }) {
  const audioRef = useRef(null)
  const playerRef = useRef(null)
  const [playback, setPlayback] = useState({ station: null, status: 'idle', active: false, error: '', url: '' })
  const [metadata, setMetadata] = useState({ url: '', title: '' })

  useEffect(() => {
    const player = new RadioPlayer(audioRef.current, { onChange: setPlayback, onSelect, onLog: log })
    playerRef.current = player
    return () => { player.dispose(); playerRef.current = null }
  }, [onSelect, log])

  useEffect(() => { playerRef.current?.configure({ showLockInfo: settings.showLockInfo, tryHttp: settings.tryHttp }) }, [settings.showLockInfo, settings.tryHttp])
  useEffect(() => { playerRef.current?.setPlaylist(playlist) }, [playlist])
  // Updating names, notes or favorites must not reset an unchanged audio source.
  useEffect(() => { playerRef.current?.restore(current, settings.autoResume) }, [current, settings.autoResume])

  const { url, active } = playback
  useEffect(() => {
    if (!url || !active) return
    const controller = new AbortController()
    let source = null
    let interval = null
    let refreshing = false
    const query = new URLSearchParams({ url, forceHttp: String(!!settings.tryHttp) })
    const show = (info) => {
      const title = info?.StreamTitle || info?.title || info?.['icy-name']
      if (!controller.signal.aborted && typeof title === 'string' && title.trim()) {
        setMetadata({ url, title: title.trim() })
        playerRef.current?.setTitle(url, title.trim())
      }
    }
    const refresh = async () => {
      if (refreshing || controller.signal.aborted) return
      refreshing = true
      try {
        const response = await fetch('/api/metadata?' + query, { signal: controller.signal })
        if (response.ok) {
          const info = await response.json()
          if (info.ok) show(info)
        }
      } catch (error) { if (!controller.signal.aborted) log('Métadonnées indisponibles', error) }
      finally { refreshing = false }
    }
    const poll = () => {
      if (interval !== null || controller.signal.aborted) return
      source?.close()
      source = null
      void refresh()
      interval = setInterval(refresh, 30000)
    }
    if (settings.useSSE && typeof EventSource !== 'undefined') {
      source = new EventSource('/api/metadata/live?' + query)
      for (const type of ['status', 'metadata']) source.addEventListener(type, event => {
        try { show(JSON.parse(event.data)) } catch { /* Ignore malformed metadata. */ }
      })
      source.addEventListener('end', poll)
      source.onerror = poll
    } else poll()
    const onVisible = () => { if (document.visibilityState === 'visible') void refresh() }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      controller.abort()
      source?.close()
      if (interval !== null) clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [url, active, settings.useSSE, settings.tryHttp, log])

  const select = useCallback(stream => playerRef.current?.select(stream), [])
  const pause = useCallback(() => playerRef.current?.pause(), [])
  const toggle = useCallback(() => {
    const player = playerRef.current
    if (player?.active) player.pause()
    else void player?.play()
  }, [])
  const preview = useCallback(station => playerRef.current?.select({ id: station.stationuuid, name: station.name, url: station.url_resolved || station.url }, { preview: true }), [])
  const stopPreview = useCallback(() => playerRef.current?.stopPreview(), [])
  const title = metadata.url === playback.url ? metadata.title : ''

  return { audioRef, playback, title, select, pause, toggle, preview, stopPreview }
}
