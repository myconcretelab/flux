import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import App from './App'

// Expose CssBaseline depuis la globale MUI si chargée par CDN
const CssBaseline: any = (globalThis as any)?.MaterialUI?.CssBaseline || (() => null);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CssBaseline />
    <App />
  </StrictMode>,
)
