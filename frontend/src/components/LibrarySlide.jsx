import { useEffect, useMemo, useState } from 'react'
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
        background: active ? '#fef2f2' : '#fff',
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
      component="button"
      type="button"
      aria-pressed={isActive}
      className={`stream-card${isActive ? ' active' : ''}${isDragging ? ' dragging' : ''}${isOver ? ' over' : ''}`}
      onClick={() => onEdit(stream)}
      {...attributes}
      {...listeners}
      style={style}
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
        ...(isOver ? { borderColor: 'var(--primary)' } : {}),
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
          sx={{ minWidth: 36, height: 32, borderRadius: '10px', border: '1px solid var(--border)', background: '#fff', fontSize: 16, lineHeight: 1 }}
        >
          {stream.favorite ? '★' : '☆'}
        </Button>
      </Box>

      <Typography sx={{ fontWeight: 700, fontSize: 14, lineHeight: 1.2, wordBreak: 'break-word', flex: 1 }}>
        {stream.name}
      </Typography>

      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
        <Box sx={{ fontSize: 12, color: stream.category ? '#0f172a' : 'var(--muted)', background: '#f2f4f7', borderRadius: '999px', px: '8px', py: '4px', minWidth: 0, textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' }}>
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
  categories, categoryColors, onRenameCategory, onDeleteCategory, onSetCategoryColor, onClearCategoryColor,
  categoryFilter, onChangeCategoryFilter, uncategorizedValue,
}) {
  const [draggingId, setDraggingId] = useState('')
  const [overId, setOverId] = useState('')
  const [trashHot, setTrashHot] = useState(false)
  const [categoryDrafts, setCategoryDrafts] = useState({})
  const activeId = form.id
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  useEffect(() => {
    setCategoryDrafts((prev) => {
      const next = { ...prev }
      const known = new Set(categories)
      categories.forEach((cat) => {
        if (!Object.prototype.hasOwnProperty.call(next, cat)) next[cat] = cat
      })
      Object.keys(next).forEach((key) => {
        if (!known.has(key)) delete next[key]
      })
      return next
    })
  }, [categories])

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
  const colorMap = categoryColors || {}

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
              <Button size="small" type="button" onClick={onClear} sx={{ border: '1px solid var(--border)', background: '#fff', minWidth: 140, borderRadius: '12px' }}>Nouveau flux</Button>
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

      <Card sx={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', mb: 2 }}>
        <CardContent>
          <Typography component="h2" sx={{ fontSize: 16, m: 0, mb: 1 }}>Catégories</Typography>
          <Typography sx={{ color: 'var(--muted)', fontSize: 13, mb: 2 }}>
            Renommez une catégorie ou changez la couleur du lecteur quand elle est active.
          </Typography>
          {categories.length ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {categories.map((cat) => {
                const draft = categoryDrafts[cat] ?? cat
                const trimmed = String(draft || '').trim()
                const canRename = !!trimmed && trimmed !== cat
                const hasColor = !!colorMap[cat]
                const colorValue = colorMap[cat] || '#f7f8fa'
                return (
                  <Box
                    key={cat}
                    sx={{
                      display: 'grid',
                      gap: '8px',
                      gridTemplateColumns: { xs: '1fr', sm: '1.5fr 1fr auto' },
                      alignItems: 'center',
                      padding: '8px',
                      border: '1px solid var(--border)',
                      borderRadius: '12px',
                      background: '#fff'
                    }}
                  >
                    <TextField
                      label="Nom"
                      value={draft}
                      onChange={(e) => setCategoryDrafts((prev) => ({ ...prev, [cat]: e.target.value }))}
                      size="small"
                      fullWidth
                      sx={{ background: '#fff', borderRadius: '12px' }}
                    />
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        Couleur lecteur {hasColor ? '' : '(auto)'}
                        <input type="color" value={colorValue} onChange={(e) => onSetCategoryColor(cat, e.target.value)} />
                      </label>
                      <Button
                        size="small"
                        onClick={() => onClearCategoryColor(cat)}
                        disabled={!hasColor}
                        sx={{ border: '1px solid var(--border)', background: '#fff', minWidth: 90 }}
                      >
                        Auto
                      </Button>
                    </Box>
                    <Box sx={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: { xs: 'flex-start', sm: 'flex-end' } }}>
                      <Button
                        size="small"
                        onClick={() => onRenameCategory(cat, trimmed)}
                        disabled={!canRename}
                        sx={{ border: '1px solid var(--border)', background: '#fff', minWidth: 100 }}
                      >
                        Renommer
                      </Button>
                      <Button
                        size="small"
                        onClick={() => confirm(`Supprimer la catégorie “${cat}” ?`) && onDeleteCategory(cat)}
                        sx={{ background: 'var(--danger)', color: '#fff', minWidth: 100 }}
                      >
                        Supprimer
                      </Button>
                    </Box>
                  </Box>
                )
              })}
            </Box>
          ) : (
            <Typography sx={{ color: 'var(--muted)', fontSize: 13 }}>
              Aucune catégorie pour le moment.
            </Typography>
          )}
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
