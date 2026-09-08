import { useEffect, useRef, useState } from 'react'
import { Alert, Autocomplete, Box, Button, Chip, CircularProgress, Dialog, DialogContent, DialogTitle, FormControlLabel, IconButton, MenuItem, Switch, Snackbar, TextField, Typography, useMediaQuery } from '@mui/material'

const initialFilters = { name: '', tag: '', countrycode: '', language: '', bitrateMin: '', order: 'clickcount' }
const countryNames = new Intl.DisplayNames(['fr'], { type: 'region' })
const countryLabel = code => { try { return countryNames.of(code) || code } catch { return code } }
const urlOf = s => s.url_resolved || s.url
const detailsOf = s => [s.countrycode && countryLabel(s.countrycode), s.language, s.codec, s.bitrate > 0 ? `${s.bitrate} kb/s` : 'Débit inconnu'].filter(Boolean).join(' · ')

export default function RadioBrowser({ open, onClose, streams, categories, initialCategory, onAdded, onManual }) {
  const mobile = useMediaQuery('(max-width:600px)')
  const [filters, setFilters] = useState(initialFilters)
  const [expanded, setExpanded] = useState(false)
  const [category, setCategory] = useState(initialCategory || '')
  const [favorite, setFavorite] = useState(false)
  const [countries, setCountries] = useState([])
  const [stations, setStations] = useState([])
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [retry, setRetry] = useState(0)
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)
  const [edit, setEdit] = useState(null)
  const activeFilters = ['tag', 'countrycode', 'language', 'bitrateMin'].filter(k => filters[k])
  const change = (key, value) => { setFilters(prev => ({ ...prev, [key]: value })); setOffset(0); setStations([]) }
  useEffect(() => {
    if (!open) return
    const controller = new AbortController()
    fetch('/api/radio-browser/countries', { signal: controller.signal }).then(r => r.ok ? r.json() : []).then(rows => setCountries(Array.isArray(rows) ? rows.map(r => r.name).filter(c => /^[A-Z]{2}$/.test(c)).sort((a, b) => countryLabel(a).localeCompare(countryLabel(b))) : [])).catch(() => {})
    return () => controller.abort()
  }, [open])
  useEffect(() => {
    if (!open) return
    const controller = new AbortController()
    setLoading(true); setError('')
    const timer = setTimeout(async () => {
      try {
        const response = await fetch('/api/radio-browser/search?' + new URLSearchParams({ ...filters, offset }), { signal: controller.signal })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Recherche indisponible')
        if (controller.signal.aborted) return
        setStations(prev => offset ? [...prev, ...data.stations.filter(s => !prev.some(p => p.stationuuid === s.stationuuid))] : data.stations)
        setHasMore(data.hasMore)
      } catch (err) { if (!controller.signal.aborted) setError(err.message) }
      finally { if (!controller.signal.aborted) setLoading(false) }
    }, 350)
    return () => { clearTimeout(timer); controller.abort() }
  }, [open, filters, offset, retry])
  const isSaved = s => streams.some(row => row.radioBrowserId === s.stationuuid || row.url === urlOf(s) || row.url === s.url)
  async function add(s, overrides = {}) {
    if (savingRef.current) return
    savingRef.current = true; setSaving(true); setNotice(''); setError('')
    try {
      const response = await fetch('/api/streams/radio-browser', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ radioBrowserId: s.stationuuid, name: s.name.trim(), url: urlOf(s), format: s.hls ? 'hls' : (s.codec || '').toLowerCase().replace('aac+', 'aac'), bitrate: s.bitrate, notes: [detailsOf(s), s.tags].filter(Boolean).join(' — '), category: category.trim(), favorite, ...overrides }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Enregistrement impossible')
      onAdded(data.streams)
      setNotice(data.duplicate ? 'Cette radio est déjà enregistrée.' : `${overrides.name || s.name} ajoutée${(overrides.category ?? category).trim() ? ' dans « ' + (overrides.category ?? category).trim() + ' »' : ' à vos radios'}.`)
      setEdit(null)
    } catch (err) { setError(err.message) }
    finally { savingRef.current = false; setSaving(false) }
  }
  const categoryField = (value, onChange) => <Autocomplete freeSolo options={categories} inputValue={value} onInputChange={(_, v) => onChange(v)} onChange={(_, v) => onChange(v || '')} renderInput={params => <TextField {...params} label="Catégorie d’ajout" placeholder="Choisir ou créer une catégorie" helperText="Vide : sans catégorie" />} />
  return <Dialog open={open} onClose={saving ? undefined : onClose} fullScreen={mobile} fullWidth maxWidth="sm" aria-labelledby="radio-browser-title" PaperProps={{ sx: { borderRadius: mobile ? 0 : 4, height: mobile ? '100dvh' : '90vh', maxHeight: mobile ? '100dvh' : '90vh' } }}>
    <DialogTitle id="radio-browser-title" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pt: 'max(16px, env(safe-area-inset-top))' }}>Ajouter une radio<IconButton aria-label="Fermer la recherche" disabled={saving} onClick={onClose} sx={{ width: 44, height: 44 }}>×</IconButton></DialogTitle>
    <DialogContent sx={{ px: { xs: 2, sm: 3 }, pb: 'max(24px, env(safe-area-inset-bottom))' }}>
      <Box sx={{ position: 'sticky', top: 0, bgcolor: 'background.paper', zIndex: 1, pt: 1, pb: 1.5 }}>
        <TextField fullWidth label="Rechercher une radio" placeholder="FIP, Radio Nova, BBC…" type="search" value={filters.name} onChange={e => change('name', e.target.value)} />
        <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap', alignItems: 'center' }}>
          <Button onClick={() => setExpanded(!expanded)} aria-expanded={expanded} sx={{ minHeight: 44 }}>Filtres{activeFilters.length ? ` (${activeFilters.length})` : ''} {expanded ? '−' : '+'}</Button>
          {activeFilters.map(k => <Chip key={k} label={k === 'countrycode' ? countryLabel(filters[k]) : k === 'bitrateMin' ? `≥ ${filters[k]} kb/s` : filters[k]} onDelete={() => change(k, '')} />)}
        </Box>
      </Box>
      {expanded && <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, py: 1 }}>
        <Autocomplete options={countries} value={filters.countrycode || null} getOptionLabel={countryLabel} onChange={(_, v) => change('countrycode', v || '')} renderInput={params => <TextField {...params} label="Pays" />} />
        <TextField label="Style / mot-clé" placeholder="jazz, rock…" value={filters.tag} onChange={e => change('tag', e.target.value)} />
        <TextField select label="Langue" value={filters.language} onChange={e => change('language', e.target.value)}>{[['', 'Toutes'], ['french', 'Français'], ['english', 'Anglais'], ['german', 'Allemand'], ['spanish', 'Espagnol'], ['italian', 'Italien'], ['portuguese', 'Portugais']].map(([v, l]) => <MenuItem key={v} value={v}>{l}</MenuItem>)}</TextField>
        <TextField select label="Débit minimum" value={filters.bitrateMin} onChange={e => change('bitrateMin', e.target.value)}>{[['', 'Tous'], ['64', '64 kb/s'], ['128', '128 kb/s'], ['192', '192 kb/s'], ['256', '256 kb/s']].map(([v, l]) => <MenuItem key={v} value={v}>{l}</MenuItem>)}</TextField>
        <Button onClick={() => { setFilters(initialFilters); setOffset(0); setStations([]) }}>Effacer les filtres</Button>
      </Box>}
      <Box sx={{ bgcolor: '#f4f6fa', borderRadius: 3, p: 2, my: 1 }}>
        {categoryField(category, setCategory)}
        <FormControlLabel control={<Switch checked={favorite} onChange={e => setFavorite(e.target.checked)} />} label="Ajouter aux favoris" />
        <Typography variant="body2" color="text.secondary">Choisissez une catégorie, puis touchez + Ajouter sur les radios de votre choix.</Typography>
      </Box>

      {error && <Alert severity="error" sx={{ my: 1 }} action={<Button onClick={() => setRetry(r => r + 1)}>Réessayer</Button>}>{error}</Alert>}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1, my: 2 }}>
        <Typography component="h2" variant="subtitle1">{filters.name || activeFilters.length ? 'Résultats' : 'Radios populaires'}</Typography>
        <TextField select size="small" label="Trier par" value={filters.order} onChange={e => change('order', e.target.value)}><MenuItem value="clickcount">Popularité</MenuItem><MenuItem value="name">Nom</MenuItem><MenuItem value="bitrate">Débit</MenuItem></TextField>
      </Box>
      <Box aria-busy={loading} sx={{ display: 'grid', gap: 1.5 }}>
        {stations.map(s => <Box component="article" key={s.stationuuid} sx={{ border: '1px solid #e5e7eb', borderRadius: 3, p: 2, minWidth: 0 }}>
          <Typography component="h3" sx={{ fontWeight: 700, overflowWrap: 'anywhere' }}>{s.name}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ my: .5, overflowWrap: 'anywhere' }}>{detailsOf(s)}</Typography>
          {s.tags && <Typography variant="caption" color="text.secondary" sx={{ display: 'block', overflowWrap: 'anywhere' }}>{s.tags.split(',').slice(0, 5).join(' · ')}</Typography>}
          {urlOf(s)?.startsWith('http:') && <Typography variant="caption" color="text.secondary">Flux HTTP : lecture selon la compatibilité du navigateur.</Typography>}
          <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
            <Button variant={isSaved(s) ? 'outlined' : 'contained'} disabled={isSaved(s) || saving || !/^https?:\/\//i.test(urlOf(s))} onClick={() => add(s)} aria-label={`${isSaved(s) ? 'Déjà enregistrée' : 'Ajouter'} : ${s.name}`} sx={{ minHeight: 44, bgcolor: isSaved(s) ? undefined : 'var(--primary)' }}>{isSaved(s) ? '✓ Enregistrée' : '+ Ajouter'}</Button>
            {!isSaved(s) && <Button disabled={saving} onClick={() => setEdit({ station: s, name: s.name.trim(), category, favorite, notes: [detailsOf(s), s.tags].filter(Boolean).join(' — ') })} sx={{ minHeight: 44 }}>Personnaliser</Button>}
          </Box>
        </Box>)}
      </Box>
      {loading && <Box role="status" sx={{ p: 3, textAlign: 'center' }}><CircularProgress size={24} /><Typography>Recherche en cours…</Typography></Box>}
      {!loading && !error && !stations.length && <Typography sx={{ py: 3 }}>Aucune radio trouvée. Essayez un autre nom ou retirez un filtre.</Typography>}
      {hasMore && !loading && !error && <Button fullWidth onClick={() => setOffset(o => o + 30)} sx={{ minHeight: 48, mt: 2 }}>Voir plus de radios</Button>}
      <Button fullWidth onClick={onManual} disabled={saving} sx={{ minHeight: 48, mt: 2 }}>Ajouter une URL manuellement</Button>
      <Typography variant="caption" color="text.secondary">Annuaire communautaire <a href="https://www.radio-browser.info/" target="_blank" rel="noreferrer">Radio Browser</a></Typography>
    </DialogContent>
    <Snackbar open={!!notice} autoHideDuration={5000} onClose={() => setNotice('')} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}><Alert severity="success" role="status" onClose={() => setNotice('')} sx={{ width: '100%' }}>{notice}</Alert></Snackbar>
    <Dialog open={!!edit} onClose={saving ? undefined : () => setEdit(null)} fullWidth maxWidth="xs" aria-labelledby="radio-custom-title">
      <DialogTitle id="radio-custom-title">Personnaliser l’ajout</DialogTitle>
      {edit && <DialogContent><Box component="form" onSubmit={e => { e.preventDefault(); const { station, ...values } = edit; add(station, values) }} sx={{ display: 'grid', gap: 2, pt: 1 }}>
        <TextField required label="Nom" value={edit.name} onChange={e => setEdit({ ...edit, name: e.target.value })} />
        {categoryField(edit.category, value => setEdit({ ...edit, category: value }))}
        <TextField multiline label="Notes" value={edit.notes} onChange={e => setEdit({ ...edit, notes: e.target.value })} />
        <FormControlLabel control={<Switch checked={edit.favorite} onChange={e => setEdit({ ...edit, favorite: e.target.checked })} />} label="Favori" />
        {error && <Alert severity="error">{error}</Alert>}
        <Button type="submit" variant="contained" disabled={saving || !edit.name.trim()} sx={{ minHeight: 44 }}>{saving ? 'Enregistrement…' : 'Ajouter à mes radios'}</Button>
        <Button disabled={saving} onClick={() => setEdit(null)}>Annuler</Button>
      </Box></DialogContent>}
    </Dialog>
  </Dialog>
}
