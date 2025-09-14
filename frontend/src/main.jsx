import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import App from './App'
import { CssBaseline } from './mui'

const rootEl = document.getElementById('root')
createRoot(rootEl).render(
  <StrictMode>
    <CssBaseline />
    <App />
  </StrictMode>,
)
