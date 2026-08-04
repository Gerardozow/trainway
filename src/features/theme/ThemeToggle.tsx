import { useTheme } from './useTheme'
import type { ThemePreference } from './theme-storage'

const OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Oscuro' },
  { value: 'system', label: 'Sistema' },
]

export function ThemeToggle() {
  const { preference, setPreference } = useTheme()

  return (
    <div
      role="group"
      aria-label="Tema"
      className="inline-flex rounded-lg border border-border bg-surface-raised p-1"
    >
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => setPreference(option.value)}
          aria-pressed={preference === option.value}
          className={
            preference === option.value
              ? 'rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-brand-content'
              : 'rounded-md px-3 py-1.5 text-sm font-medium text-content-muted'
          }
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
