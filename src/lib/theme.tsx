import { createContext, use, useCallback, useEffect, useState, type ReactNode } from 'react'

export type Theme = 'light' | 'dark' | 'system'
export type Resolved = 'light' | 'dark'

const STORAGE_KEY = 'trainway-theme'
const THEMES: Theme[] = ['light', 'dark', 'system']

type ThemeContextValue = {
  theme: Theme
  resolved: Resolved
  setTheme: (t: Theme) => void
  cycleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function readStored(): Theme {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return THEMES.includes(raw as Theme) ? (raw as Theme) : 'system'
  } catch {
    return 'system'
  }
}

function prefersDark(): boolean {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
}

function resolve(theme: Theme): Resolved {
  if (theme === 'system') return prefersDark() ? 'dark' : 'light'
  return theme
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(readStored)
  const [resolved, setResolved] = useState<Resolved>(() => resolve(readStored()))

  // Aplica la clase que consume `@custom-variant dark` en el CSS.
  useEffect(() => {
    const next = resolve(theme)
    setResolved(next)
    document.documentElement.classList.toggle('dark', next === 'dark')
  }, [theme])

  // Si el tema es 'system', hay que seguir al sistema en vivo.
  useEffect(() => {
    if (theme !== 'system') return
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)')
    if (!mq?.addEventListener) return
    const onChange = () => {
      const next = prefersDark() ? 'dark' : 'light'
      setResolved(next)
      document.documentElement.classList.toggle('dark', next === 'dark')
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [theme])

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t)
    try {
      localStorage.setItem(STORAGE_KEY, t)
    } catch {
      // Modo privado en Safari: el tema no persiste, pero la app funciona.
    }
  }, [])

  const cycleTheme = useCallback(() => {
    setTheme(THEMES[(THEMES.indexOf(readStored()) + 1) % THEMES.length]!)
  }, [setTheme])

  return <ThemeContext value={{ theme, resolved, setTheme, cycleTheme }}>{children}</ThemeContext>
}

export function useTheme(): ThemeContextValue {
  const ctx = use(ThemeContext)
  if (!ctx) throw new Error('useTheme necesita estar dentro de <ThemeProvider>')
  return ctx
}
