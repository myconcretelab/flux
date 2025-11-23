import { Box, Button, Card, CardContent, Typography, TextField, Select, MenuItem } from '../mui'

export default function LibrarySlide({
  form, setForm, onSubmit, onClear, onPaste,
  manageList, onMove, onToggleFav, onEdit, onDelete, onPlay,
  onExport, onImport,
  categories,
}) {
  return (
    <Box component="section" aria-labelledby="library-title" sx={{ scrollSnapAlign: 'start', flex: '0 0 100%', px: { xs: '8px', sm: '16px' }, pb: '64px' }}>
      <Typography id="library-title" component="h1" sx={{ fontSize: 20, my: '8px', mx: '4px' }}>Gestion des flux</Typography>

      <Card sx={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', mb: 2 }}>
        <CardContent>
          <Typography component="h2" sx={{ fontSize: 16, m: 0, mb: 1 }}>Ajouter ou éditer</Typography>
          <Typography sx={{ color: 'var(--muted)', fontSize: 13, mb: 1 }}>Formulaire optimisé pour le tactile : champs larges, actions visibles et suggestions de catégories.</Typography>
          <Box component="form" onSubmit={onSubmit} className="grid" sx={{ display: 'grid', gap: '12px', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>

            <TextField
              label="Nom"
              placeholder="ex. FIP hifi"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              size="small"
              fullWidth
              sx={{ background: '#fff', borderRadius: '12px', gridColumn: { xs: '1/-1', sm: 'span 1' } }}
            />

            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: '8px', gridColumn: { xs: '1/-1', sm: 'span 1' } }}>
              <TextField
                label="URL"
                type="url"
                required
                placeholder="http(s)://..."
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
                size="small"
                fullWidth
                sx={{ background: '#fff', borderRadius: '12px' }}
              />
              <Button type="button" onClick={onPaste} size="small" sx={{ border: '1px solid var(--border)', borderRadius: '12px', background: '#fff', flexShrink: 0 }}>Coller</Button>
            </Box>

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
              sx={{ background: '#fff', borderRadius: '12px', gridColumn: { xs: '1/-1', sm: 'span 1' } }}
            />

            <Box sx={{ display: 'flex', gap: '8px', flexWrap: 'wrap', gridColumn: '1/-1', justifyContent: { xs: 'stretch', sm: 'flex-start' } }}>
              <Button size="small" type="submit" variant="contained" sx={{ background: 'var(--primary)', minWidth: 140 }}>Enregistrer</Button>
              <Button size="small" type="button" onClick={onClear} sx={{ border: '1px solid var(--border)', background: '#fff', minWidth: 120 }}>Nouveau</Button>
              <Button size="small" type="button" onClick={() => form.id && onDelete(form)} disabled={!form.id} sx={{ background: 'var(--danger)', color: '#fff', minWidth: 120 }}>Supprimer</Button>
            </Box>
            <datalist id="categoryOptions">
              {categories.map((cat) => <option value={cat} key={cat} />)}
            </datalist>
          </Box>
        </CardContent>
      </Card>

      <Card sx={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)' }}>
        <CardContent>
          <Box className="card-head" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: '12px' }}>
            <Typography component="h2" sx={{ fontSize: 16, m: 0 }}>Liste & organisation</Typography>
            <Box sx={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <Button size="small" onClick={onExport} sx={{ border: '1px solid var(--border)', borderRadius: '12px', background: '#fff', px: 1.5, py: 0.5 }}>Exporter JSON</Button>
              <label className="file-btn" style={{ position: 'relative', overflow: 'hidden', display: 'inline-flex', alignItems: 'center', padding: '4px 8px', borderRadius: '12px', border: '1px solid var(--border)', background: '#fff', cursor: 'pointer' }}>
                Importer JSON
                <input type="file" accept="application/json" hidden onChange={(e) => e.target.files?.[0] && onImport(e.target.files[0])} />
              </label>
            </Box>
          </Box>
          <Box component="ul" className="manage-list" sx={{ listStyle: 'none', m: 0, p: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {manageList.map((s, idx) => (
              <Box key={s.id} component="li" className="item" sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: { xs: 'flex-start', sm: 'center' }, justifyContent: 'space-between', gap: '12px', p: '12px', background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
                <Box className="left" sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: { xs: 'flex-start', sm: 'center' }, gap: '10px', width: '100%' }}>
                  <Box sx={{ display: 'flex', gap: '6px' }}>
                    <Button className="up-btn" onClick={() => onMove(idx, Math.max(0, idx - 1))} sx={{ background: '#fff', border: '1px solid var(--border)', borderRadius: '8px', p: '6px', minWidth: 36 }}>↑</Button>
                    <Button className="down-btn" onClick={() => onMove(idx, Math.min(manageList.length - 1, idx + 1))} sx={{ background: '#fff', border: '1px solid var(--border)', borderRadius: '8px', p: '6px', minWidth: 36 }}>↓</Button>
                    <Button className="fav-btn" onClick={() => onToggleFav(s.id)} title="Favori" sx={{ background: '#fff', border: '1px solid var(--border)', borderRadius: '8px', p: '6px', minWidth: 36 }}>{s.favorite ? '★' : '☆'}</Button>
                  </Box>
                  <Box className="meta" sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, flex: 1, minWidth: 0 }}>
                    <Box className="name" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      {s.name}
                      {s.category ? <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: '4px', px: '8px', py: '2px', borderRadius: 999, background: '#f2f4f7', color: '#111827', fontSize: 12 }}>📁 {s.category}</Box> : null}
                      {s.format ? <Box component="span" sx={{ px: '8px', py: '2px', borderRadius: 999, background: '#eef2ff', color: '#312e81', fontSize: 12 }}>{String(s.format).toUpperCase()}</Box> : null}
                    </Box>
                    <Box className="sub" sx={{ fontSize: 12, color: 'var(--muted)', wordBreak: 'break-word' }}>
                      {s.url}
                      {s.notes ? <Box component="span" sx={{ display: 'inline-block', ml: 1 }}>{`· ${s.notes}`}</Box> : null}
                    </Box>
                  </Box>
                </Box>
                <Box className="actions" sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(3, minmax(0,1fr))', sm: 'repeat(3, auto)' }, gap: '8px', width: { xs: '100%', sm: 'auto' } }}>
                  <Button className="play-btn" title="Lire" onClick={() => onPlay(s.id)} sx={{ background: '#fff', border: '1px solid var(--border)', width: '100%', height: 36, borderRadius: '10px', p: 0, minWidth: 36, lineHeight: 1 }}>▶︎</Button>
                  <Button className="edit-btn" title="Éditer" onClick={() => onEdit(s)} sx={{ background: '#fff', border: '1px solid var(--border)', borderRadius: '10px', p: '6px', minWidth: 36 }}>✎</Button>
                  <Button className="del-btn" title="Supprimer" onClick={() => onDelete(s)} sx={{ background: '#fff', border: '1px solid var(--border)', borderRadius: '10px', p: '6px', minWidth: 36 }}>🗑</Button>
                </Box>
              </Box>
            ))}
          </Box>
        </CardContent>
      </Card>
    </Box>
  )
}
