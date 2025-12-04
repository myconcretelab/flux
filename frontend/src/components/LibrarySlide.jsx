import { useMemo, useState } from 'react'
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Box, Button, Card, CardContent, Typography, TextField, Select, MenuItem } from '../mui'

const glass = 'linear-gradient(145deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02))'
const pill = 'rgba(255,255,255,0.06)'
const accent = 'linear-gradient(120deg, var(--primary), var(--accent))'
const TRASH_ID = 'trash-dropzone'

function TrashDrop({ hot }) {
  const { setNodeRef, isOver } = useDroppable({ id: TRASH_ID })
  const active = hot || isOver
  return (
    <Box
      ref={setNodeRef}
      className="trash-drop"
      sx={{
        display: 'flex', alignItems: 'center', gap: '8px',
        padding: '10px 12px',
        borderRadius: '12px',
        border: '1px dashed var(--border)',
        background: active ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.05)',
        color: active ? 'var(--danger)' : 'inherit',
        transition: 'all .15s ease',
        flex: { xs: '1 1 100%', sm: '0 0 auto' }
      }}
    >
      <span role="img" aria-label="Corbeille">🗑</span>
      <Typography component="span" sx={{ fontSize: 13 }}>
        Déposez ici pour supprimer
      </Typography>
    </Box>
  )
}

function SortableStreamCard({
  stream,
  activeId,
  overId,
  draggingId,
  onToggleFav,
  onEdit,
}) {
  const { id } = stream
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const isActive = activeId === id
  const isOver = overId === id && draggingId && overId !== draggingId
  const finalTransform = CSS.Transform.toString(transform)
  const style = {
    transform: finalTransform ? `${finalTransform}${isOver ? ' scale(1.02)' : ''}` : (isOver ? 'scale(1.02)' : undefined),
    transition,
  }

  return (
    <Box
      ref={setNodeRef}
      component="div"
      role="button"
      tabIndex={0}
      aria-pressed={isActive}
      className={`stream-card${isActive ? ' active' : ''}${isDragging ? ' dragging' : ''}${isOver ? ' over' : ''}`}
      onClick={() => onEdit(stream)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onEdit(stream)
        }
      }}
      {...attributes}
      {...listeners}
      style={style}
      sx={{
        position: 'relative',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: '14px',
        background: glass,
        padding: '12px',
        textAlign: 'left',
        aspectRatio: '1',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        gap: '6px',
        cursor: 'grab',
        transition: 'border-color .15s ease, box-shadow .15s ease, transform .1s ease',
        boxShadow: '0 18px 36px rgba(0,0,0,0.32)',
        ...(isActive ? { borderColor: 'rgba(30,242,207,0.5)', boxShadow: '0 22px 44px rgba(0,0,0,.4)', background: 'linear-gradient(145deg, rgba(30,242,207,0.15), rgba(255,115,198,0.1))' } : {}),
        ...(isOver ? { borderColor: 'rgba(30,242,207,0.6)' } : {}),
        ...(isDragging ? { opacity: 0.7, cursor: 'grabbing' } : {}),
        '&:focus-visible': { outline: '2px solid var(--primary)' }
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
        <Box sx={{ fontSize: 12, color: 'var(--muted)' }}>⋮⋮</Box>
        <Button
          size="small"
          onClick={(e) => { e.stopPropagation(); onToggleFav(stream.id) }}
          aria-label={stream.favorite ? 'Retirer des favoris' : 'Marquer en favori'}
          sx={{ minWidth: 36, height: 32, borderRadius: '10px', border: '1px solid rgba(255,255,255,0.22)', background: pill, fontSize: 16, lineHeight: 1, color: '#fff', boxShadow: '0 12px 22px rgba(0,0,0,0.35)' }}
        >
          {stream.favorite ? '★' : '☆'}
        </Button>
      </Box>

      <Typography sx={{ fontWeight: 700, fontSize: 14, lineHeight: 1.2, wordBreak: 'break-word', flex: 1 }}>
        {stream.name}
      </Typography>

      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
        <Box sx={{ fontSize: 12, color: stream.category ? '#e7ecf5' : 'var(--muted)', background: 'rgba(255,255,255,0.08)', borderRadius: '999px', px: '8px', py: '4px', minWidth: 0, textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' }}>
          {stream.category || 'Sans catégorie'}
        </Box>
        {isActive ? <span role="img" aria-label="En édition">✏️</span> : null}
      </Box>
    </Box>
  )
}

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
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const resetDnD = () => { setDraggingId(''); setOverId(''); setTrashHot(false) }
  const handleDragStart = ({ active }) => {
    if (!active?.id) return
    setDraggingId(String(active.id))
    setOverId(String(active.id))
    setTrashHot(false)
  }
  const handleDragOver = ({ over }) => {
    const overKey = over?.id ? String(over.id) : ''
    setTrashHot(overKey === TRASH_ID)
    setOverId(overKey && overKey !== TRASH_ID ? overKey : '')
  }
  const handleDragEnd = ({ active, over }) => {
    const activeKey = active?.id ? String(active.id) : ''
    const overKey = over?.id ? String(over.id) : ''
    if (activeKey && overKey === TRASH_ID) {
      const stream = manageList.find((s) => s.id === activeKey)
      if (stream) onDelete(stream)
      resetDnD()
      return
    }
    if (activeKey && overKey) {
      const from = manageList.findIndex((s) => s.id === activeKey)
      const to = manageList.findIndex((s) => s.id === overKey)
      if (from !== -1 && to !== -1 && from !== to) onMove(from, to)
    }
    resetDnD()
  }
  const handleDragCancel = () => resetDnD()

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

      <Card sx={{ border: '1px solid rgba(255,255,255,0.12)', borderRadius: '24px', boxShadow: '0 28px 60px rgba(0,0,0,0.45)', mb: 2, background: 'var(--card)' }}>
        <CardContent>
          <Box className="card-head" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: '12px', gap: 1, flexWrap: 'wrap' }}>
            <Typography component="h2" sx={{ fontSize: 16, m: 0 }}>Flux enregistrés</Typography>
            <Box sx={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <Button size="small" onClick={onExport} sx={{ border: '1px solid rgba(255,255,255,0.2)', borderRadius: '12px', background: pill, color: '#fff', px: 1.5, py: 0.5, boxShadow: '0 14px 30px rgba(0,0,0,0.3)' }}>Exporter JSON</Button>
              <label className="file-btn" style={{ position: 'relative', overflow: 'hidden', display: 'inline-flex', alignItems: 'center', padding: '6px 10px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.22)', background: 'rgba(255,255,255,0.06)', cursor: 'pointer', color: '#fff', boxShadow: '0 14px 30px rgba(0,0,0,0.3)' }}>
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
              sx={{ minWidth: 200, background: pill, color: 'var(--fg)', borderRadius: '14px', '& fieldset': { borderRadius: '14px', borderColor: 'rgba(255,255,255,0.18)' }, '.MuiSvgIcon-root': { color: 'var(--muted)' } }}
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

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
          >
            <Box sx={{ display: 'flex', gap: '10px', alignItems: 'center', mb: 1, flexWrap: 'wrap' }}>
              <TrashDrop hot={trashHot} />
              <Button size="small" type="button" onClick={onClear} sx={{ border: '1px solid transparent', background: accent, color: '#0b1021', minWidth: 140, borderRadius: '12px', boxShadow: '0 18px 32px rgba(0,0,0,0.35)' }}>Nouveau flux</Button>
            </Box>
            <SortableContext items={filteredList.map((s) => s.id)} strategy={rectSortingStrategy}>
              <Box className="stream-card-grid" sx={{ display: 'grid', gap: '12px', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
                {filteredList.map((s) => (
                  <SortableStreamCard
                    key={s.id}
                    stream={s}
                    activeId={activeId}
                    overId={overId}
                    draggingId={draggingId}
                    onToggleFav={onToggleFav}
                    onEdit={onEdit}
                  />
                ))}
              </Box>
            </SortableContext>
          </DndContext>
        </CardContent>
      </Card>

      <Card sx={{ border: '1px solid rgba(255,255,255,0.12)', borderRadius: '24px', boxShadow: '0 28px 60px rgba(0,0,0,0.45)', background: 'var(--card)' }}>
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
              sx={{ background: 'rgba(255,255,255,0.06)', borderRadius: '14px', gridColumn: { xs: '1/-1', sm: 'span 2' } }}
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
              sx={{ background: 'rgba(255,255,255,0.06)', borderRadius: '14px' }}
            />
            <Select
              displayEmpty
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              renderValue={(value) => value || 'Choisir une catégorie'}
              size="small"
              fullWidth
              sx={{ background: pill, borderRadius: '14px', '& fieldset': { borderRadius: '14px', borderColor: 'rgba(255,255,255,0.18)' }, color: 'var(--fg)', '.MuiSvgIcon-root': { color: 'var(--muted)' } }}
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
                sx={{ background: 'rgba(255,255,255,0.06)', borderRadius: '14px' }}
              />
              <Button type="button" onClick={onPaste} size="small" sx={{ border: '1px solid rgba(255,255,255,0.2)', borderRadius: '12px', background: pill, flexShrink: 0, color: '#fff' }}>Coller</Button>
            </Box>

            <Select
              displayEmpty
              value={form.format}
              onChange={(e) => setForm({ ...form, format: e.target.value })}
              size="small"
              sx={{ background: pill, borderRadius: '14px', '& fieldset': { borderRadius: '14px', borderColor: 'rgba(255,255,255,0.18)' }, color: 'var(--fg)', '.MuiSvgIcon-root': { color: 'var(--muted)' } }}
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
              sx={{ background: 'rgba(255,255,255,0.06)', borderRadius: '14px', gridColumn: { xs: '1/-1', sm: 'span 2' } }}
            />

            <Box sx={{ display: 'flex', gap: '8px', flexWrap: 'wrap', gridColumn: '1/-1', justifyContent: { xs: 'stretch', sm: 'flex-start' } }}>
              <Button size="small" type="submit" variant="contained" sx={{ background: accent, color: '#0b1021', minWidth: 140, borderRadius: '12px', boxShadow: '0 20px 36px rgba(0,0,0,0.4)' }}>Enregistrer</Button>
              <Button size="small" type="button" onClick={onClear} sx={{ border: '1px solid rgba(255,255,255,0.2)', background: pill, color: '#fff', minWidth: 120, borderRadius: '12px' }}>Réinitialiser</Button>
              <Button size="small" type="button" onClick={() => form.id && onDelete(form)} disabled={!form.id} sx={{ background: 'var(--danger)', color: '#fff', minWidth: 120, borderRadius: '12px' }}>Supprimer</Button>
              <Button size="small" type="button" onClick={() => form.id && onPlay(form.id)} disabled={!form.id} sx={{ border: '1px solid rgba(255,255,255,0.2)', background: pill, color: '#fff', minWidth: 120, borderRadius: '12px' }}>Tester</Button>
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
