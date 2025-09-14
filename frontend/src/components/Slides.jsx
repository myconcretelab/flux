import PlayerSlide from './PlayerSlide'
import LibrarySlide from './LibrarySlide'
import SettingsSlide from './SettingsSlide'
import { Box, Container } from '../mui'

export default function Slides({ slidesRef, playerProps, libraryProps, settingsProps }) {
  return (
    <Container sx={{ width: '100%', maxWidth: 800, mx: 'auto', p: 0 }}>
      <Box
        ref={slidesRef}
        id="slides"
        component="main"
        tabIndex={0}
        aria-label="Panneaux glissables"
        sx={{
          display: 'flex', gap: { xs: '10px', sm: '20px' },
          overflowX: 'auto', overscrollBehaviorX: 'contain',
          scrollSnapType: 'x mandatory',
          py: '16px',
          touchAction: 'pan-x pan-y',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        <PlayerSlide {...playerProps} />
        <LibrarySlide {...libraryProps} />
        <SettingsSlide {...settingsProps} />
      </Box>
    </Container>
  )
}
