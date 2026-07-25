import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { ThemeProvider } from './contexts/ThemeContext'
import { Toaster } from './components/ui/Sonner'

function renderApp() {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <ThemeProvider>
        <App />
        <Toaster position="bottom-center" richColors closeButton />
      </ThemeProvider>
    </StrictMode>
  )
}

// Mock backend — intercepts the app's axios calls and answers from
// localStorage, for working on the UI without a backend running. Off by
// default now that the real Django backend (see src/api/urls.js) is wired
// up; opt in with VITE_USE_MOCK_API=true in .env if you want it instead.
// NOTE: the mock predates the OTP-based auth flow, JWT refresh, and the AI
// room-render carousel, so those specific flows won't work under it as-is.
if (import.meta.env.VITE_USE_MOCK_API === 'true') {
  import('./api/mockAdapter').then(renderApp)
} else {
  renderApp()
}
