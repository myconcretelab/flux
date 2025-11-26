import deezerLogo from '../assets/Logo_Deezer_2023.svg'
import { Box, Button, Card, CardContent, Typography, IconButton, Select, MenuItem } from '../mui'

export default function PlayerSlide({
  nowName, nowMeta, playing, onPlayPause, audioRef, deezerHref,
  logOpen, setLogOpen, logEntries, copyLog,
  sleepMinutes, setSleepMinutes, sleepLeft,
  playerList, lastId, onPlayItem, onAddQuick,
  categories, categoryFilter, setCategoryFilter, uncategorizedValue,
}) {
  return (
    <Box
      component="section"
      aria-labelledby="player-title"
      sx={{ scrollSnapAlign: 'start', flex: '0 0 100%', px: { xs: '8px', sm: '16px' }, pb: '64px' }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: '8px', sm: '16px' }, mb: '24px' }}>
        <Card
          sx={{
            position: 'relative',
            background: 'var(--player-bg)', color: 'var(--player-fg)',
            border: '1px solid var(--border)', borderRadius: 'var(--radius)',
            boxShadow: 'var(--shadow)'
          }}
        >
          <CardContent sx={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            textAlign: 'center', gap: '16px', minHeight: '50vh', pb: '64px'
          }}>
            <Button id="toggleLog" aria-label="Afficher le journal" variant="contained"
              onClick={() => setLogOpen(!logOpen)}
              sx={{ position: 'absolute', top: 8, right: 8, borderRadius: 999, background: 'var(--primary)', color: '#fff', py: '2px', px: '8px', minWidth: 'auto', fontSize: 11,
                ...(logOpen ? { backgroundColor: '#3b82f6' } : {}) }}>
              journal
            </Button>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: '4px', mb: '10px', alignItems: 'center' }}>
              <Typography sx={{ fontWeight: 700 }}>{nowName}</Typography>
              <Typography className="muted" sx={{ color: 'var(--player-muted)', fontSize: 12 }}>{nowMeta}</Typography>
            </Box>

            <audio id="audio" ref={audioRef} preload="none" playsInline x-webkit-airplay="allow"></audio>

            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '10px', my: '8px' }}>
              <Button id="playPause" aria-label={playing ? 'Stop' : 'Lecture'} variant="contained" onClick={onPlayPause}
                disabled={!playerList.find((s) => s.id === lastId)}
                sx={{ width: 80, height: 80, borderRadius: '50%', p: 0, fontSize: 32, background: 'var(--primary)', borderColor: 'var(--primary)' }}>
                {playing ? '■' : '▶︎'}
              </Button>
            </Box>

            <Box
              component="a"
              id="deezerBtn"
              href={deezerHref || '#'}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Ouvrir dans Deezer"
              hidden={!deezerHref}
              sx={{
                position: 'absolute', left: '50%', bottom: 8, transform: 'translateX(-50%)',
                display: 'inline-flex', alignItems: 'center', gap: 1,
                border: '1px solid var(--border)', background: '#fff', borderRadius: '12px', px: '10px', py: '6px'
              }}
            >
              <img src={deezerLogo} alt="Deezer" style={{ display: 'block', height: 20 }} />
            </Box>
          </CardContent>
        </Card>

        {logOpen && (
          <Card sx={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)' }}>
            <CardContent sx={{ fontSize: 12, maxHeight: 180, overflow: 'auto', overflowWrap: 'anywhere', p: 2 }}>
              <Typography component="h2" sx={{ m: 0, mb: 1, fontSize: 14 }}>Journal</Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {logEntries.map((e, i) => (
                  <Box key={i}>
                    [{e.time}] {e.msg}
                    {e.obj ? <pre>{JSON.stringify(e.obj, null, 2)}</pre> : null}
                  </Box>
                ))}
              </Box>
              <Button size="small" onClick={copyLog} sx={{ mt: 1, border: '1px solid var(--border)', borderRadius: '12px', background: '#fff' }}>Copier</Button>
            </CardContent>
          </Card>
        )}
      </Box>

      <Box sx={{ mt: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap', mb: '12px', p: { xs: '8px 10px', sm: 0 }, background: { xs: '#fff', sm: 'transparent' }, borderRadius: '14px', border: { xs: '1px solid var(--border)', sm: 'none' } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <label htmlFor="sleepMinutes">Sleep</label>
            <input id="sleepMinutes" type="range" min="0" max="90" step="5" value={sleepMinutes} onChange={(e) => setSleepMinutes(Number(e.target.value || 0))} list="sleepMarks" />
            <datalist id="sleepMarks">
              <option value="0"></option>
              <option value="15"></option>
              <option value="30"></option>
              <option value="45"></option>
              <option value="60"></option>
              <option value="75"></option>
              <option value="90"></option>
            </datalist>
            <Box component="span" sx={{ color: 'var(--muted)', fontSize: 12 }}>{sleepLeft}</Box>
          </Box>
          <Button id="addQuick" onClick={onAddQuick} size="small" sx={{ border: '1px solid var(--border)', borderRadius: '12px', background: '#fff' }}>+ ajout rapide</Button>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap', mb: '10px' }}>
          <Typography component="h2" sx={{ fontSize: 16, m: 0 }}>Vos flux</Typography>
          <Select size="small" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} displayEmpty
            sx={{ minWidth: 180, background: '#fff', borderRadius: '12px', '& fieldset': { borderRadius: '12px' } }}>
            <MenuItem value=""><em>Toutes les catégories</em></MenuItem>
            <MenuItem value={uncategorizedValue}>Sans catégorie</MenuItem>
            {categories.map((cat) => (
              <MenuItem key={cat} value={cat}>{cat}</MenuItem>
            ))}
          </Select>
        </Box>
        <Box
          component="ul"
          aria-live="polite"
          sx={{
            listStyle: 'none',
            m: 0,
            p: 0,
            display: 'grid',
            gap: '12px',
            gridTemplateColumns: { xs: 'repeat(auto-fit, minmax(140px, 1fr))', sm: 'repeat(auto-fit, minmax(160px, 1fr))' }
          }}
        >
          {playerList.map((s) => {
            const isCurrent = s.id === lastId
            const isPlaying = isCurrent && playing
            return (
              <Box
                key={s.id}
                component="li"
                sx={{
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  p: '14px',
                  background: '#fff',
                  border: '1px solid var(--border)',
                  borderRadius: '10px',
                  aspectRatio: '1',
                  ...(isCurrent ? { backgroundColor: '#e6ecf5', borderColor: '#cbd5e1' } : {})
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                  <Typography sx={{ fontWeight: 700, lineHeight: 1.2, wordBreak: 'break-word', flex: 1 }}>{s.name}</Typography>
                  {s.favorite ? <Box component="span" className="badge" sx={{ fontSize: 11, px: '8px', py: '2px', borderRadius: 999, background: 'var(--primary)', color: '#fff', display: 'inline-block' }}>★</Box> : null}
                </Box>

                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '6px', rowGap: '6px', color: 'var(--muted)', fontSize: 12 }}>
                  {s.category ? (
                    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: '6px', px: '10px', py: '4px', borderRadius: 999, background: '#f2f4f7', color: '#111827' }}>
                      📁 {s.category}
                    </Box>
                  ) : null}
                  {s.format ? (
                    <Box component="span" sx={{ px: '10px', py: '4px', borderRadius: 999, background: '#eef2ff', color: '#312e81' }}>
                      {String(s.format).toUpperCase()}
                    </Box>
                  ) : null}
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px', mt: 'auto' }}>
                  {isPlaying ? (
                    <Box aria-hidden="true" sx={{ display: 'flex', alignItems: 'flex-end', gap: '2px', width: 16, height: 16, mr: '4px' }}>
                      <Box sx={{ flex: 1, background: 'var(--primary)', transformOrigin: 'bottom', animation: 'eq 1s infinite ease-in-out' }} />
                      <Box sx={{ flex: 1, background: 'var(--primary)', transformOrigin: 'bottom', animation: 'eq 1s infinite ease-in-out .2s' }} />
                      <Box sx={{ flex: 1, background: 'var(--primary)', transformOrigin: 'bottom', animation: 'eq 1s infinite ease-in-out .4s' }} />
                    </Box>
                  ) : null}
                  <IconButton className="play-btn" title={isPlaying ? 'Stop' : 'Lire'} aria-label={isPlaying ? 'Stop' : 'Lire'} onClick={() => onPlayItem(s.id)}
                    sx={{ width: 44, height: 44, borderRadius: '12px', p: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, background: '#fff', border: '1px solid var(--border)' }}>
                    {isPlaying ? '■' : '▶︎'}
                  </IconButton>
                </Box>
              </Box>
            )
          })}
        </Box>
      </Box>
    </Box>
  )
}
