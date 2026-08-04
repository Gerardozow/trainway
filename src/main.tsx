import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider } from './features/theme/ThemeProvider'
import { ThemeToggle } from './features/theme/ThemeToggle'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <main className="flex min-h-full flex-col items-center justify-center gap-6 p-8">
        <h1 className="text-3xl font-bold text-content">Trainway</h1>
        <ThemeToggle />
      </main>
    </ThemeProvider>
  </StrictMode>,
)
