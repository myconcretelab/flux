import { useMemo, useState } from 'react'
import { Box, Button, Card, CardContent, Typography, TextField, Select, MenuItem } from '../mui'

export default function LibrarySlide({
  form, setForm, onSubmit, onClear, onPaste,
  manageList, onMove, onToggleFav, onEdit, onDelete, onPlay,
  onExport, onImport,
  categories, categoryFilter, onChangeCategoryFilter, uncategorizedValue,
}) {
  const [draggingId, setDraggingId] = useState('')
  const [overId, setOverId] = useState('')
  const [trashHot, setTrashHot] = useState(false)
  const activeId = form.id

  const resetDnD = () => { setDraggingId(''); setOverId(''); setTrashHot(false) }
  const handleDragStart = (stream) => (e) => {
    setDraggingId(stream.id)
    setOverId(stream.id)
    setTrashHot(false)
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move'
      e.dataTransfer.setData('text/plain', stream.id)
    }
  }
  const handleDragEnter = (stream) => (e) => {
    if (!draggingId) return
    e.preventDefault()
    if (stream.id !== draggingId) setOverId(stream.id)
  }
  const handleDropOnCard = (stream) => (e) => {
    e.preventDefault()
    if (!draggingId) return resetDnD()
    const from = manageList.findIndex((s) => s.id === draggingId)
    const to = manageList.findIndex((s) => s.id === stream.id)
    if (from !== -1 && to !== -1 && from !== to) onMove(from, to)
    resetDnD()
  }
  const handleDragOver = (e) => { if (draggingId) e.preventDefault() }
  const handleDragEnd = () => resetDnD()
  const handleDragEnterTrash = (e) => {
    if (!draggingId) return
    e.preventDefault()
    setTrashHot(true)
    setOverId('')
  }
  const handleDropTrash = (e) => {
    e.preventDefault()
    if (!draggingId) return resetDnD()
    const stream = manageList.find((s) => s.id === draggingId)
    if (stream) onDelete(stream)
    resetDnD()
  }
  const filteredList = useMemo(() => {
    if (categoryFilter === uncategorizedValue) return manageList.filter((s) => !s.category)
    if (categoryFilter) return manageList.filter((s) => (s.category || '') === categoryFilter)
    return manageList
  }, [manageList, categoryFilter, uncategorizedValue])

  const guessFormat = () => {
    if (form.format) return
    const lower = (form.url || '').toLowerCase()
    const isAac = lower.includes('aac')
    const isMp3 = lower.includes('mp3')
    const guess = isAac ? 'aac' : isMp3 ? 'mp3' : ''
    if (guess) setForm((prev) => ({ ...prev, format: guess }))
  }

  return (
    <Box component="section" aria-labelledby="library-title" sx={{ scrollSnapAlign: 'start', flex: '0 0 100%', px: { xs: '8px', sm: '16px' }, pb: '64px' }}>
      <Typography id="library-title" component="h1" sx={{ fontSize: 20, my: '8px', mx: '4px' }}>Gestion des flux</Typography>

      <Card sx={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', mb: 2 }}>
        <CardContent>
          <Box className="card-head" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: '12px', gap: 1, flexWrap: 'wrap' }}>
            <Typography component="h2" sx={{ fontSize: 16, m: 0 }}>Flux enregistrés</Typography>
            <Box sx={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <Button size="small" onClick={onExport} sx={{ border: '1px solid var(--border)', borderRadius: '12px', background: '#fff', px: 1.5, py: 0.5 }}>Exporter JSON</Button>
              <label className="file-btn" style={{ position: 'relative', overflow: 'hidden', display: 'inline-flex', alignItems: 'center', padding: '4px 8px', borderRadius: '12px', border: '1px solid var(--border)', background: '#fff', cursor: 'pointer' }}>
                Importer JSON
                <input type="file" accept="application/json" hidden onChange={(e) => e.target.files?.[0] && onImport(e.target.files[0])} />
              </label>
            </Box>
          </Box>
          <Typography sx={{ color: 'var(--muted)', fontSize: 13, mb: 2 }}>Glissez-déposez pour réordonner, cliquez pour éditer. Déposez sur la corbeille pour supprimer sans polluer l’interface.</Typography>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', mb: 1.5 }}>
            <Select
              displayEmpty
              value={categoryFilter}
              onChange={(e) => onChangeCategoryFilter(e.target.value)}
              size="small"
              sx={{ minWidth: 200, background: '#fff', borderRadius: '12px', '& fieldset': { borderRadius: '12px' } }}
            >
              <MenuItem value=""><em>Toutes les catégories</em></MenuItem>
              <MenuItem value={uncategorizedValue}>Sans catégorie</MenuItem>
              {categories.map((cat) => (
                <MenuItem value={cat} key={cat}>{cat}</MenuItem>
              ))}
            </Select>
            <Typography component="span" sx={{ color: 'var(--muted)', fontSize: 12 }}>
              {filteredList.length} / {manageList.length} flux
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', gap: '10px', alignItems: 'center', mb: 1, flexWrap: 'wrap' }}>
            <Box
              className="trash-drop"
              onDragOver={handleDragEnterTrash}
              onDragEnter={handleDragEnterTrash}
              onDragLeave={() => setTrashHot(false)}
              onDrop={handleDropTrash}
              sx={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '10px 12px',
                borderRadius: '12px',
                border: '1px dashed var(--border)',
                background: trashHot ? '#fef2f2' : '#fff',
                color: trashHot ? 'var(--danger)' : 'inherit',
                transition: 'all .15s ease',
                flex: { xs: '1 1 100%', sm: '0 0 auto' }
              }}
            >
              <span role="img" aria-label="Corbeille">🗑</span>
              <Typography component="span" sx={{ fontSize: 13 }}>
                Déposez ici pour supprimer
              </Typography>
            </Box>
            <Button size="small" type="button" onClick={onClear} sx={{ border: '1px solid var(--border)', background: '#fff', minWidth: 140, borderRadius: '12px' }}>Nouveau flux</Button>
          </Box>

          <Box className="stream-card-grid" sx={{ display: 'grid', gap: '12px', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
            {filteredList.map((s) => {
              const isActive = activeId === s.id
              const isDragging = draggingId === s.id
              const isOver = overId === s.id && draggingId && overId !== draggingId
              return (
                <Box
                  key={s.id}
                  component="button"
                  type="button"
                  draggable
                  onDragStart={handleDragStart(s)}
                  onDragEnter={handleDragEnter(s)}
                  onDragOver={handleDragOver}
                  onDragEnd={handleDragEnd}
                  onDrop={handleDropOnCard(s)}
                  onClick={() => onEdit(s)}
                  aria-pressed={isActive}
                  className={`stream-card${isActive ? ' active' : ''}${isDragging ? ' dragging' : ''}${isOver ? ' over' : ''}`}
                  sx={{
                    position: 'relative',
                    border: '1px solid var(--border)',
                    borderRadius: '14px',
                    background: '#fff',
                    padding: '12px',
                    textAlign: 'left',
                    aspectRatio: '1',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '6px',
                    cursor: 'grab',
                    transition: 'border-color .15s ease, box-shadow .15s ease, transform .1s ease',
                    ...(isActive ? { borderColor: 'var(--primary)', boxShadow: '0 8px 24px rgba(10,14,39,.15)', background: '#f8fafc' } : {}),
                    ...(isOver ? { borderColor: 'var(--primary)', transform: 'scale(1.02)' } : {}),
                    ...(isDragging ? { opacity: 0.7 } : {}),
                    '&:focus-visible': { outline: '2px solid var(--primary)' }
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                    <Box sx={{ fontSize: 12, color: 'var(--muted)' }}>⋮⋮</Box>
                    <Button
                      size="small"
                      onClick={(e) => { e.stopPropagation(); onToggleFav(s.id) }}
                      aria-label={s.favorite ? 'Retirer des favoris' : 'Marquer en favori'}
                      sx={{ minWidth: 36, height: 32, borderRadius: '10px', border: '1px solid var(--border)', background: '#fff', fontSize: 16, lineHeight: 1 }}
                    >
                      {s.favorite ? '★' : '☆'}
                    </Button>
                  </Box>

                  <Typography sx={{ fontWeight: 700, fontSize: 14, lineHeight: 1.2, wordBreak: 'break-word', flex: 1 }}>
                    {s.name}
                  </Typography>

                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                    <Box sx={{ fontSize: 12, color: s.category ? '#0f172a' : 'var(--muted)', background: '#f2f4f7', borderRadius: '999px', px: '8px', py: '4px', minWidth: 0, textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' }}>
                      {s.category || 'Sans catégorie'}
                    </Box>
                    {isActive ? <span role="img" aria-label="En édition">✏️</span> : null}
                  </Box>
                </Box>
              )
            })}
          </Box>
        </CardContent>
      </Card>

      <Card sx={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)' }}>
        <CardContent>
          <Typography component="h2" sx={{ fontSize: 16, m: 0, mb: 1 }}>Ajouter ou éditer</Typography>
          <Typography sx={{ color: 'var(--muted)', fontSize: 13, mb: 1 }}>Les champs se déploient en plein écran tactile. Choisissez une catégorie existante ou saisissez la vôtre. Le format est auto-détecté si l’URL le laisse deviner.</Typography>
          <Box component="form" onSubmit={onSubmit} className="grid" sx={{ display: 'grid', gap: '12px', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>

            <TextField
              label="Nom"
              placeholder="ex. FIP hifi"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              size="small"
              fullWidth
              sx={{ background: '#fff', borderRadius: '12px', gridColumn: { xs: '1/-1', sm: 'span 2' } }}
            />

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '2fr 1fr' }, gap: '8px', gridColumn: { xs: '1/-1', sm: 'span 2' } }}>
              <TextField
                label="Catégorie"
                placeholder="ex. Rock, Infos..."
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                size="small"
                fullWidth
                inputProps={{ list: 'categoryOptions' }}
                sx={{ background: '#fff', borderRadius: '12px' }}
              />
              <Select
                displayEmpty
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                renderValue={(value) => value || 'Choisir une catégorie'}
                size="small"
                fullWidth
                sx={{ background: '#fff', borderRadius: '12px', '& fieldset': { borderRadius: '12px' } }}
              >
                <MenuItem value="">Sans catégorie</MenuItem>
                {categories.map((cat) => (
                  <MenuItem value={cat} key={cat}>{cat}</MenuItem>
                ))}
              </Select>
            </Box>

            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: '8px', gridColumn: { xs: '1/-1', sm: 'span 2' } }}>
              <TextField
                label="URL"
                type="url"
                required
                placeholder="http(s)://..."
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
                onBlur={guessFormat}
                size="small"
                fullWidth
                sx={{ background: '#fff', borderRadius: '12px' }}
              />
              <Button type="button" onClick={onPaste} size="small" sx={{ border: '1px solid var(--border)', borderRadius: '12px', background: '#fff', flexShrink: 0 }}>Coller</Button>
            </Box>

            <Select
              displayEmpty
              value={form.format}
              onChange={(e) => setForm({ ...form, format: e.target.value })}
              size="small"
              sx={{ background: '#fff', borderRadius: '12px', '& fieldset': { borderRadius: '12px' } }}
            >
              <MenuItem value="">Auto</MenuItem>
              <MenuItem value="mp3">MP3</MenuItem>
              <MenuItem value="aac">AAC</MenuItem>
            </Select>

            <label className="mui-switch" style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={!!form.favorite} onChange={(e) => setForm({ ...form, favorite: e.target.checked })} /> Favori
            </label>

            <TextField
              label="Notes"
              placeholder="bitrate, origine..."
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              size="small"
              fullWidth
              sx={{ background: '#fff', borderRadius: '12px', gridColumn: { xs: '1/-1', sm: 'span 2' } }}
            />

            <Box sx={{ display: 'flex', gap: '8px', flexWrap: 'wrap', gridColumn: '1/-1', justifyContent: { xs: 'stretch', sm: 'flex-start' } }}>
              <Button size="small" type="submit" variant="contained" sx={{ background: 'var(--primary)', minWidth: 140 }}>Enregistrer</Button>
              <Button size="small" type="button" onClick={onClear} sx={{ border: '1px solid var(--border)', background: '#fff', minWidth: 120 }}>Réinitialiser</Button>
              <Button size="small" type="button" onClick={() => form.id && onDelete(form)} disabled={!form.id} sx={{ background: 'var(--danger)', color: '#fff', minWidth: 120 }}>Supprimer</Button>
              <Button size="small" type="button" onClick={() => form.id && onPlay(form.id)} disabled={!form.id} sx={{ border: '1px solid var(--border)', background: '#fff', minWidth: 120 }}>Tester</Button>
            </Box>
            <datalist id="categoryOptions">
              {categories.map((cat) => <option value={cat} key={cat} />)}
            </datalist>
          </Box>
        </CardContent>
      </Card>
    </Box>
  )
}
