import { Box, Container, Button } from '../mui'

export default function AppFooter({ activeIndex = 0, onToPlayer, onToLibrary, onToSettings }) {
  return (
    <Box component="footer" sx={{ position: 'sticky', bottom: 0, py: '12px', pb: '16px', background: 'rgba(8,12,26,0.82)', backdropFilter: 'blur(16px) saturate(140%)', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
      <Container sx={{ width: '100%', maxWidth: 980, mx: 'auto' }}>
        <Box component="nav" id="pager" sx={{ display: 'flex', justifyContent: 'space-around', gap: '10px' }}>
          <Button
            id="toPlayer"
            aria-label="Lecteur"
            onClick={onToPlayer}
            sx={{
              background: activeIndex === 0 ? 'linear-gradient(120deg, var(--primary), var(--accent))' : 'rgba(255,255,255,0.05)',
              border: '1px solid var(--border)',
              p: '10px',
              color: activeIndex === 0 ? '#0b1021' : '#fff',
              opacity: activeIndex === 0 ? 1 : 0.8,
              minWidth: 0,
              borderRadius: '14px',
              boxShadow: '0 14px 30px rgba(0,0,0,0.3)'
            }}
          >
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12l9-9 9 9"/>
              <path d="M9 21V9h6v12"/>
            </svg>
          </Button>
          <Button
            id="toLibrary"
            aria-label="Bibliothèque"
            onClick={onToLibrary}
            sx={{
              background: activeIndex === 1 ? 'linear-gradient(120deg, var(--primary), var(--accent))' : 'rgba(255,255,255,0.05)',
              border: '1px solid var(--border)',
              p: '10px',
              color: activeIndex === 1 ? '#0b1021' : '#fff',
              opacity: activeIndex === 1 ? 1 : 0.8,
              minWidth: 0,
              borderRadius: '14px',
              boxShadow: '0 14px 30px rgba(0,0,0,0.3)'
            }}
          >
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2"/>
              <path d="M3 10h18M10 4v18"/>
            </svg>
          </Button>
          <Button
            id="toSettings"
            aria-label="Réglages"
            onClick={onToSettings}
            sx={{
              background: activeIndex === 2 ? 'linear-gradient(120deg, var(--primary), var(--accent))' : 'rgba(255,255,255,0.05)',
              border: '1px solid var(--border)',
              p: '10px',
              color: activeIndex === 2 ? '#0b1021' : '#fff',
              opacity: activeIndex === 2 ? 1 : 0.8,
              minWidth: 0,
              borderRadius: '14px',
              boxShadow: '0 14px 30px rgba(0,0,0,0.3)'
            }}
          >
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V22a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H2a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.09A1.65 1.65 0 0 0 9 3.09V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.09a1.65 1.65 0 0 0 1.51 1z"/>
            </svg>
          </Button>
        </Box>
      </Container>
    </Box>
  )
}
