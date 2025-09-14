import { Box, Button, Card, CardContent, Typography } from '../mui'

export default function LibrarySlide({
  form, setForm, onSubmit, onClear, onPaste,
  manageList, onMove, onToggleFav, onEdit, onDelete, onPlay,
  onExport, onImport,
}) {
  return (
    <Box component="section" aria-labelledby="library-title" sx={{ scrollSnapAlign: 'start', flex: '0 0 100%', px: { xs: '8px', sm: '16px' }, pb: '64px' }}>
      <Typography id="library-title" component="h1" sx={{ fontSize: 20, my: '8px', mx: '4px' }}>Gestion des flux</Typography>

      <Card sx={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', mb: 2 }}>
        <CardContent>
          <Box component="form" onSubmit={onSubmit} className="grid" sx={{ display: 'grid', gap: '12px', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>

            <label>Nom
              <input type="text" placeholder="ex. FIP hifi" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                     style={{ padding: '12px', border: '1px solid var(--border)', borderRadius: '12px', background: '#fff', fontSize: 16 }} />
            </label>

            <label>URL
              <Box className="url-row" sx={{ display: 'flex', gap: '12px' }}>
                <input type="url" placeholder="http(s)://..." required value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })}
                       style={{ flex: 1, padding: '12px', border: '1px solid var(--border)', borderRadius: '12px', background: '#fff', fontSize: 16 }} />
                <Button type="button" onClick={onPaste} size="small" sx={{ border: '1px solid var(--border)', borderRadius: '12px', background: '#fff' }}>Coller</Button>
              </Box>
            </label>

            <label>Format (optionnel)
              <select value={form.format} onChange={(e) => setForm({ ...form, format: e.target.value })} style={{ padding: '12px', border: '1px solid var(--border)', borderRadius: '12px', background: '#fff', fontSize: 16 }}>
                <option value="">Auto</option>
                <option value="mp3">MP3</option>
                <option value="aac">AAC</option>
              </select>
            </label>

            <label className="mui-switch" style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={!!form.favorite} onChange={(e) => setForm({ ...form, favorite: e.target.checked })} /> Favori
            </label>

            <label>Notes
              <input type="text" placeholder="bitrate, origine..." value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                     style={{ padding: '12px', border: '1px solid var(--border)', borderRadius: '12px', background: '#fff', fontSize: 16 }} />
            </label>

            <Box sx={{ display: 'flex', gap: '8px', flexWrap: 'wrap', gridColumn: '1/-1' }}>
              <Button size="small" type="submit" variant="contained" sx={{ background: 'var(--primary)' }}>Enregistrer</Button>
              <Button size="small" type="button" onClick={onClear} sx={{ border: '1px solid var(--border)', background: '#fff' }}>Nouveau</Button>
              <Button size="small" type="button" onClick={() => form.id && onDelete(form)} disabled={!form.id} sx={{ background: 'var(--danger)', color: '#fff' }}>Supprimer</Button>
            </Box>
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
              <Box key={s.id} component="li" className="item" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', p: '12px', background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
                <Box className="left" sx={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Button className="up-btn" onClick={() => onMove(idx, Math.max(0, idx - 1))} sx={{ background: '#fff', border: '1px solid var(--border)', borderRadius: '8px', p: '6px', minWidth: 32 }}>↑</Button>
                  <Button className="down-btn" onClick={() => onMove(idx, Math.min(manageList.length - 1, idx + 1))} sx={{ background: '#fff', border: '1px solid var(--border)', borderRadius: '8px', p: '6px', minWidth: 32 }}>↓</Button>
                  <Button className="fav-btn" onClick={() => onToggleFav(s.id)} title="Favori" sx={{ background: '#fff', border: '1px solid var(--border)', borderRadius: '8px', p: '6px', minWidth: 32 }}>{s.favorite ? '★' : '☆'}</Button>
                  <Box className="meta" sx={{ display: 'flex', flexDirection: 'column' }}>
                    <Box className="name" sx={{ fontWeight: 600 }}>{s.name}</Box>
                    <Box className="sub" sx={{ fontSize: 12, color: 'var(--muted)' }}>
                      {s.url} {s.format ? `· ${String(s.format).toUpperCase()}` : ''} {s.notes ? `· ${s.notes}` : ''}
                    </Box>
                  </Box>
                </Box>
                <Box className="actions" sx={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  <Button className="play-btn" title="Lire" onClick={() => onPlay(s.id)} sx={{ background: '#fff', border: '1px solid var(--border)', width: 32, height: 32, borderRadius: '50%', p: 0, minWidth: 32, lineHeight: 1 }}>▶︎</Button>
                  <Button className="edit-btn" title="Éditer" onClick={() => onEdit(s)} sx={{ background: '#fff', border: '1px solid var(--border)', borderRadius: '8px', p: '6px', minWidth: 32 }}>✎</Button>
                  <Button className="del-btn" title="Supprimer" onClick={() => onDelete(s)} sx={{ background: '#fff', border: '1px solid var(--border)', borderRadius: '8px', p: '6px', minWidth: 32 }}>🗑</Button>
                </Box>
              </Box>
            ))}
          </Box>
        </CardContent>
      </Card>
    </Box>
  )
}
