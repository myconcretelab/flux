import { Box, Container, Typography } from '../mui'

export default function AppHeader() {
  return (
    <Box
      component="header"
      sx={{
        position: 'sticky',
        top: 0,
        zIndex: 10,
        display: 'flex',
        alignItems: 'center',
        py: '12px',
        px: { xs: '14px', sm: '16px' },
        background: 'rgba(6,10,20,0.75)',
        backdropFilter: 'blur(18px) saturate(160%)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
      }}
    >
      <Container sx={{ width: '100%', maxWidth: 980, mx: 'auto' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: { xs: '10px', sm: '16px' } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Box
              aria-hidden="true"
              sx={{
                width: 48,
                height: 48,
                borderRadius: '16px',
                background: 'linear-gradient(135deg, rgba(30,242,207,0.25), rgba(255,115,198,0.5))',
                position: 'relative',
                boxShadow: '0 14px 36px rgba(30,242,207,0.35)',
                overflow: 'hidden',
                '&::after': {
                  content: '""',
                  position: 'absolute',
                  inset: 8,
                  borderRadius: '12px',
                  background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.6), transparent 50%)',
                  opacity: 0.8,
                },
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  inset: 0,
                  borderRadius: '16px',
                  border: '1px solid rgba(255,255,255,0.24)',
                  mixBlendMode: 'screen',
                }
              }}
            />
            <Box>
              <Typography component="span" sx={{ display: 'block', fontWeight: 700, fontSize: 18, letterSpacing: '-0.02em', background: 'linear-gradient(120deg, var(--primary), var(--accent))', WebkitBackgroundClip: 'text', color: 'transparent' }}>
                StreamDeck
              </Typography>
              <Typography component="span" sx={{ color: 'var(--muted)', fontSize: 13, display: 'block' }}>
                Vos radios, mais en beaucoup plus sexy
              </Typography>
            </Box>
          </Box>

          <Typography component="span" sx={{ fontSize: 13, color: 'var(--muted)', letterSpacing: '0.02em' }}>
            Lecture ultra fluide · v1.3
          </Typography>
        </Box>
      </Container>
    </Box>
  )
}
