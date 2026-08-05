import { Monitor, Moon, Sun } from 'lucide-react'
import { useTheme, type Theme } from '@/lib/theme'

const NEXT: Record<Theme, Theme> = { system: 'light', light: 'dark', dark: 'system' }
const LABEL: Record<Theme, string> = {
  system: 'Tema: sigue al sistema',
  light: 'Tema: claro',
  dark: 'Tema: oscuro',
}

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const Icon = theme === 'system' ? Monitor : theme === 'light' ? Sun : Moon

  return (
    <button
      type="button"
      onClick={() => setTheme(NEXT[theme])}
      aria-label={`${LABEL[theme]}. Cambiar a ${LABEL[NEXT[theme]].toLowerCase().replace('tema: ', '')}`}
      className="grid size-12 place-items-center rounded-xl active:bg-[var(--surface-2)]"
    >
      <Icon className="size-5" aria-hidden />
    </button>
  )
}
