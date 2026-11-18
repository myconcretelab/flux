import deezerLogo from '../assets/Logo_Deezer_2023.svg'
import { Box, Button, IconButton, Card, CardContent, Typography, Select, MenuItem } from '../mui'
import { pickReadableText, tintColor } from '../color-utils'

export default function PlayerSlide({
  nowName, nowMeta, playing, playbackMessage, previewing, canPlay, onPlayPause, audioRef, deezerHref,
  logOpen, setLogOpen, logEntries, copyLog,
  sleepMinutes, setSleepMinutes, sleepLeft,
  playerList, lastId, onPlayItem, onToggleFav, onAddQuick,
  categories, categoryFilter, setCategoryFilter, uncategorizedValue, favoritesValue,
  categoryColors = {},
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
              <Typography role="status" sx={{ color: 'var(--player-muted)', fontSize: 12 }}>{playbackMessage}</Typography>
            </Box>

            <audio id="audio" ref={audioRef} preload="none" playsInline x-webkit-airplay="allow"></audio>

            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '10px', my: '8px' }}>
              <Button id="playPause" aria-label={playing ? 'Pause' : 'Lecture'} variant="contained" onClick={onPlayPause}
                disabled={!canPlay}
                sx={{ width: 80, height: 80, borderRadius: '50%', p: 0, fontSize: 32, background: 'var(--primary)', borderColor: 'var(--primary)' }}>
                {playing ? 'Ⅱ' : '▶︎'}
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
            inputProps={{ 'aria-label': 'Filtrer les radios du lecteur' }}
            sx={{ minWidth: 180, background: '#fff', borderRadius: '12px', '& fieldset': { borderRadius: '12px' } }}>
            <MenuItem value=""><em>Toutes les catégories</em></MenuItem>
            <MenuItem value={favoritesValue}>★ Favoris</MenuItem>
            <MenuItem value={uncategorizedValue}>Sans catégorie</MenuItem>
            {categories.map((cat) => (
              <MenuItem key={cat} value={cat}>{cat}</MenuItem>
            ))}
          </Select>
        </Box>
        {categoryFilter === favoritesValue && playerList.length === 0 && (
          <Typography role="status" sx={{ color: 'var(--muted)', fontSize: 13, mb: 2 }}>
            Aucun favori pour le moment. Affichez toutes les catégories, puis touchez l’étoile d’une station.
          </Typography>
        )}
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
            const isPlaying = isCurrent && playing && !previewing
            const isActive = isCurrent
            const categoryColor = s.category ? categoryColors[s.category] : null
            const hasCategoryColor = !!categoryColor
            const idleBg = hasCategoryColor ? (tintColor(categoryColor, 0.86) || '#fff') : '#fff'
            const activeBg = hasCategoryColor ? categoryColor : '#fff'
            const cardBg = isActive ? activeBg : idleBg
            const cardFg = hasCategoryColor
              ? (isActive ? pickReadableText(categoryColor) : categoryColor)
              : '#111827'
            const cardMuted = hasCategoryColor
              ? (isActive
                ? (cardFg === '#ffffff' ? 'rgba(255,255,255,0.78)' : 'rgba(17,24,39,0.7)')
                : cardFg)
              : 'var(--muted)'
            const formatBadgeStyle = hasCategoryColor
              ? (isActive
                ? {
                  background: cardFg === '#ffffff' ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.7)',
                  color: cardFg,
                  border: cardFg === '#ffffff' ? '1px solid rgba(255,255,255,0.5)' : '1px solid rgba(15,23,42,0.2)',
                }
                : {
                  background: 'rgba(255,255,255,0.75)',
                  color: categoryColor,
                  border: `1px solid ${categoryColor}`,
                })
              : {
                background: '#eef2ff',
                color: '#312e81',
                border: '1px solid transparent',
              }
            return (
              <Box
                key={s.id}
                component="li"
                sx={{
                  position: 'relative',
                  aspectRatio: '1',
                }}
              >
                <Box
                  component="button"
                  type="button"
                  onClick={() => onPlayItem(s.id)}
                  aria-pressed={isPlaying}
                  aria-label={isPlaying ? `Pause ${s.name}` : `Lire ${s.name}`}
                  sx={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    p: '14px',
                    background: cardBg,
                    color: cardFg,
                    border: 'none',
                    borderRadius: '10px',
                    textAlign: 'left',
                    cursor: 'pointer',
                    font: 'inherit',
                    outline: 'none',
                    transition: 'transform 0.15s ease',
                    '&:hover': { transform: 'translateY(-1px)' },
                    '&:active': { transform: 'translateY(0)' },
                    '&:focus-visible': { outline: `2px solid ${cardFg}`, outlineOffset: -3 },
                  }}
                >
                  <Box sx={{ display: 'flex', flex: 1, minHeight: 0, pt: '30px', pb: '12px', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', textAlign: 'center', flexWrap: 'wrap' }}>
                      <Typography sx={{
                        fontWeight: 700,
                        fontSize: 'clamp(14px, 2.3vw, 18px)',
                        lineHeight: 1.1,
                        letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                        wordBreak: 'break-word',
                        color: 'inherit',
                        display: '-webkit-box',
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}>
                        {s.name}
                      </Typography>
                    </Box>
                  </Box>

                  <Box sx={{ display: 'flex', flexShrink: 0, minHeight: 24, alignItems: 'center', justifyContent: 'space-between', gap: '8px', width: '100%' }}>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '6px', rowGap: '6px', color: cardMuted, fontSize: 12 }}>
                      {s.format ? (
                        <Box component="span" sx={{
                          px: '10px',
                          py: '4px',
                          borderRadius: 999,
                          ...formatBadgeStyle,
                        }}>
                          {String(s.format).toUpperCase()}
                          {Number(s.bitrate) > 0 && <Box component="span" sx={{ ml: .75, pl: .75, borderLeft: '1px solid currentColor', opacity: .7, fontSize: '0.9em', fontWeight: 400, whiteSpace: 'nowrap' }}>{Number(s.bitrate)} kb/s</Box>}
                        </Box>
                      ) : null}
                    </Box>
                    {isPlaying ? (
                      <Box aria-hidden="true" sx={{ display: 'flex', alignItems: 'flex-end', gap: '2px', width: 16, height: 16 }}>
                        <Box sx={{ flex: 1, background: cardFg, transformOrigin: 'bottom', animation: 'eq 1s infinite ease-in-out' }} />
                        <Box sx={{ flex: 1, background: cardFg, transformOrigin: 'bottom', animation: 'eq 1s infinite ease-in-out .2s' }} />
                        <Box sx={{ flex: 1, background: cardFg, transformOrigin: 'bottom', animation: 'eq 1s infinite ease-in-out .4s' }} />
                      </Box>
                    ) : null}
                  </Box>
                </Box>
                <IconButton
                  type="button"
                  aria-label={s.favorite ? `Retirer ${s.name} des favoris` : `Ajouter ${s.name} aux favoris`}
                  aria-pressed={!!s.favorite}
                  title={s.favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                  onClick={(event) => { event.stopPropagation(); onToggleFav(s.id) }}
                  sx={{
                    position: 'absolute', top: 6, right: 6,
                    width: 44, height: 44, p: '6px',
                    color: s.favorite ? '#9a6700' : (isActive && hasCategoryColor ? cardFg : '#64748b'),
                    backgroundColor: 'transparent',
                    transition: 'transform 150ms ease',
                    '&::before': {
                      content: '""', position: 'absolute', inset: 6, borderRadius: '50%',
                      backgroundColor: s.favorite ? '#fff4d6' : 'transparent',
                      transition: 'background-color 150ms ease',
                    },
                    '&:hover': { backgroundColor: 'transparent' },
                    '&:hover::before': { backgroundColor: s.favorite ? '#ffeab5' : (cardFg === '#ffffff' ? 'rgba(255,255,255,0.14)' : 'rgba(100,116,139,0.1)') },
                    '&:active': { transform: 'scale(0.92)' },
                    '&.Mui-focusVisible': { outline: `2px solid ${cardFg}`, outlineOffset: -2 },
                    '@media (prefers-reduced-motion: reduce)': { transition: 'none', '&::before': { transition: 'none' } },
                  }}
                >
                  <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" width="20" height="20" fill={s.favorite ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'relative' }}>
                    <path d="m12 3 2.78 5.63 6.22.91-4.5 4.39 1.06 6.2L12 17.2l-5.56 2.93 1.06-6.2L3 9.54l6.22-.91L12 3Z" />
                  </svg>
                </IconButton>
              </Box>
            )
          })}
        </Box>
      </Box>
    </Box>
  )
}
