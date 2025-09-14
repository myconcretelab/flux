import { Box, Container, Typography } from '../mui'

export default function AppHeader() {
  return (
    <Box
      component="header"
      sx={{
        position: 'sticky', top: 0, zIndex: 10,
        display: 'flex', alignItems: 'center',
        py: '12px', px: '16px',
        background: 'linear-gradient(#fff,#fff8)',
        backdropFilter: 'saturate(160%) blur(8px)',
        borderBottom: '1px solid var(--border)'
      }}
    >
      <Container sx={{ width: '100%', maxWidth: 800, mx: 'auto' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 700 }}>
          <svg width="24" height="24" viewBox="0 0 128 128" aria-hidden="true" style={{ borderRadius: 8 }}>
            <rect rx="24" width="128" height="128" fill="#f4f6f8"></rect>
            <circle cx="64" cy="64" r="36" fill="var(--primary)"></circle>
            <path d="M82 64c0 9.94-8.06 18-18 18s-18-8.06-18-18 8.06-18 18-18 18 8.06 18 18z" fill="#fff" opacity=".9"></path>
          </svg>
          <Typography component="span" sx={{ fontWeight: 700 }}>StreamDeck</Typography>
        </Box>
      </Container>
    </Box>
  )
}

