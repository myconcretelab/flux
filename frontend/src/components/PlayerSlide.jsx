import deezerLogo from '../assets/Logo_Deezer_2023.svg'
import { Box, Button, Card, CardContent, Typography, IconButton, Select, MenuItem } from '../mui'

export default function PlayerSlide({
  nowName, nowMeta, playing, onPlayPause, audioRef, deezerHref,
  logOpen, setLogOpen, logEntries, copyLog,
  sleepMinutes, setSleepMinutes, sleepLeft,
  playerList, lastId, onPlayItem, onAddQuick,
  categories, categoryFilter, setCategoryFilter, uncategorizedValue,
}) {
  const glass = 'linear-gradient(145deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02))'
  const pill = 'rgba(255,255,255,0.06)'
  const accent = 'linear-gradient(120deg, var(--primary), var(--accent))'
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
            border: '1px solid rgba(255,255,255,0.16)', borderRadius: '28px',
            boxShadow: '0 40px 90px rgba(0,0,0,0.45)',
            overflow: 'hidden',
            '&::before': {
              content: '""',
              position: 'absolute',
              inset: 0,
              background: 'radial-gradient(120% 120% at 18% 18%, rgba(255,255,255,0.14), transparent 45%)',
              opacity: 0.7,
              pointerEvents: 'none'
            }
          }}
        >
          <CardContent sx={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            textAlign: 'center', gap: '18px', minHeight: '55vh', pb: '72px', position: 'relative'
          }}>
            <Button id="toggleLog" aria-label="Afficher le journal" variant="contained"
              onClick={() => setLogOpen(!logOpen)}
              sx={{
                position: 'absolute',
                top: 16,
                right: 16,
                borderRadius: 999,
                background: logOpen ? accent : 'rgba(0,0,0,0.45)',
                color: logOpen ? '#0b1021' : '#fff',
                py: '4px',
                px: '10px',
                minWidth: 'auto',
                fontSize: 11,
                textTransform: 'none',
                boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
              }}>
              journal
            </Button>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: '6px', mb: '10px', alignItems: 'center' }}>
              <Typography sx={{ fontWeight: 700, fontSize: 24, letterSpacing: '-0.02em' }}>{nowName}</Typography>
              <Typography className="muted" sx={{ color: 'var(--player-muted)', fontSize: 13, px: '12px', py: '6px', borderRadius: '999px', background: 'rgba(0,0,0,0.25)', backdropFilter: 'blur(6px)' }}>{nowMeta}</Typography>
            </Box>

            <audio id="audio" ref={audioRef} preload="none" playsInline x-webkit-airplay="allow"></audio>

            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '10px', my: '8px' }}>
              <Button id="playPause" aria-label={playing ? 'Stop' : 'Lecture'} variant="contained" onClick={onPlayPause}
                disabled={!playerList.find((s) => s.id === lastId)}
                sx={{
                  width: 94, height: 94, borderRadius: '50%', p: 0, fontSize: 32,
                  background: accent, border: '1px solid transparent', color: '#0b1021',
                  boxShadow: '0 26px 50px rgba(30,242,207,0.35)',
                  textShadow: '0 2px 6px rgba(11,16,33,0.4)',
                  transition: 'transform .15s ease, box-shadow .2s ease',
                  '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 36px 70px rgba(0,0,0,0.5)' }
                }}>
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
                position: 'absolute', left: '50%', bottom: 12, transform: 'translateX(-50%)',
                display: 'inline-flex', alignItems: 'center', gap: 1,
                border: '1px solid rgba(255,255,255,0.16)', background: pill, backdropFilter: 'blur(10px)',
                borderRadius: '14px', px: '12px', py: '8px', boxShadow: '0 16px 30px rgba(0,0,0,0.35)'
              }}
            >
              <img src={deezerLogo} alt="Deezer" style={{ display: 'block', height: 20 }} />
            </Box>
          </CardContent>
        </Card>

        {logOpen && (
          <Card sx={{ border: '1px solid rgba(255,255,255,0.12)', borderRadius: '24px', boxShadow: '0 24px 60px rgba(0,0,0,0.45)', background: 'var(--card)' }}>
            <CardContent sx={{ fontSize: 12, maxHeight: 200, overflow: 'auto', overflowWrap: 'anywhere', p: 2, backdropFilter: 'blur(10px)' }}>
              <Typography component="h2" sx={{ m: 0, mb: 1, fontSize: 14, letterSpacing: '0.01em' }}>Journal</Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {logEntries.map((e, i) => (
                  <Box key={i}>
                    [{e.time}] {e.msg}
                    {e.obj ? <pre>{JSON.stringify(e.obj, null, 2)}</pre> : null}
                  </Box>
                ))}
              </Box>
              <Button size="small" onClick={copyLog} sx={{ mt: 1, border: '1px solid rgba(255,255,255,0.2)', borderRadius: '12px', background: pill, color: '#fff' }}>Copier</Button>
            </CardContent>
          </Card>
        )}
      </Box>

      <Box sx={{ mt: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', mb: '12px', p: { xs: '10px 12px', sm: '12px' }, background: glass, borderRadius: '16px', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 14px 30px rgba(0,0,0,0.25)' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <label htmlFor="sleepMinutes" style={{ fontWeight: 700 }}>Sleep</label>
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
          <Button id="addQuick" onClick={onAddQuick} size="small" sx={{ border: '1px solid transparent', borderRadius: '12px', background: accent, color: '#0b1021', boxShadow: '0 18px 32px rgba(0,0,0,0.35)' }}>+ ajout rapide</Button>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap', mb: '10px' }}>
          <Typography component="h2" sx={{ fontSize: 16, m: 0, letterSpacing: '-0.01em' }}>Vos flux</Typography>
          <Select size="small" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} displayEmpty
            sx={{ minWidth: 200, background: pill, color: 'var(--fg)', borderRadius: '14px', '& fieldset': { borderRadius: '14px', borderColor: 'rgba(255,255,255,0.18)' }, '.MuiSvgIcon-root': { color: 'var(--muted)' } }}>
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
                  background: glass,
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: '16px',
                  aspectRatio: '1',
                  boxShadow: '0 20px 36px rgba(0,0,0,0.35)',
                  overflow: 'hidden',
                  ...(isCurrent
                    ? {
                        background: 'linear-gradient(145deg, rgba(30,242,207,0.16), rgba(255,115,198,0.12))',
                        borderColor: 'rgba(30,242,207,0.6)',
                        '&::after': { content: '""', position: 'absolute', inset: '1px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.12)', pointerEvents: 'none' }
                      }
                    : { '&::after': { content: '""', position: 'absolute', inset: '1px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.05)', pointerEvents: 'none' } })
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                  <Typography sx={{ fontWeight: 700, lineHeight: 1.2, wordBreak: 'break-word', flex: 1 }}>{s.name}</Typography>
                  {s.favorite ? <Box component="span" className="badge" sx={{ fontSize: 11, px: '8px', py: '2px', borderRadius: 999, display: 'inline-block' }}>★</Box> : null}
                </Box>

                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '6px', rowGap: '6px', color: 'var(--muted)', fontSize: 12 }}>
                  {s.category ? (
                    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: '6px', px: '10px', py: '4px', borderRadius: 999, background: 'rgba(255,255,255,0.08)', color: '#e7ecf5' }}>
                      📁 {s.category}
                    </Box>
                  ) : null}
                  {s.format ? (
                    <Box component="span" sx={{ px: '10px', py: '4px', borderRadius: 999, background: 'rgba(255,255,255,0.08)', color: '#e7ecf5' }}>
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
                    sx={{ width: 44, height: 44, borderRadius: '12px', p: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, background: pill, border: '1px solid rgba(255,255,255,0.2)', color: '#fff', boxShadow: '0 14px 28px rgba(0,0,0,0.35)' }}>
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
