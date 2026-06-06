import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { installGlobalErrorHandlers } from './utils/errorReporter'

// Capture uncaught errors + unhandled promise rejections globally so user-facing
// crashes are reported to the ClientError log, not just lost to the user's console.
installGlobalErrorHandlers()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
