import { ArrowUpCircle, X } from 'lucide-react'
import { Button, Spinner } from '@/components/ui'
import { useAppUpdate } from '@/lib/useAppUpdate'
import { cn } from '@/lib/utils'

/**
 * "Hay una versión nueva".
 *
 * Presentación pura y separada del hook a propósito: el aviso se puede probar
 * sin service worker, que en jsdom no existe.
 */
export function UpdateBanner({
  applying,
  aboveNav = true,
  onApply,
  onDismiss,
}: {
  applying: boolean
  /** Deja hueco a la navegación de abajo, que no está en todas las pantallas. */
  aboveNav?: boolean
  onApply: () => void
  onDismiss: () => void
}) {
  return (
    <div
      role="status"
      className={cn(
        'fixed inset-x-0 z-20 px-3 pb-2',
        aboveNav
          ? 'bottom-[calc(3.5rem+env(safe-area-inset-bottom))]'
          : 'bottom-[env(safe-area-inset-bottom)]',
      )}
    >
      <div className="mx-auto flex max-w-lg items-center gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3 shadow-lg">
        <ArrowUpCircle className="size-5 shrink-0 text-volt-ink" aria-hidden />

        <p className="min-w-0 flex-1 text-sm leading-snug">
          <strong>Hay una versión nueva.</strong>
          <br />
          <span className="text-[var(--fg-muted)]">Se instala en un segundo.</span>
        </p>

        <Button variant="volt" disabled={applying} onClick={onApply}>
          {applying ? <Spinner /> : 'Actualizar'}
        </Button>

        <button
          type="button"
          onClick={onDismiss}
          aria-label="Ahora no"
          className="press -mr-1 grid size-10 shrink-0 place-items-center rounded-xl text-[var(--fg-muted)] active:bg-[var(--surface-2)]"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>
    </div>
  )
}

/**
 * El aviso enchufado al service worker.
 *
 * No aparece en la sesión ni en el wizard: son las dos pantallas donde una
 * recarga interrumpe algo a medias, y la versión nueva puede esperar a que se
 * vuelva a Hoy.
 */
export function AppUpdatePrompt({ enabled, aboveNav }: { enabled: boolean; aboveNav?: boolean }) {
  const { ready, apply, dismiss, applying } = useAppUpdate()
  if (!enabled || !ready) return null
  return (
    <UpdateBanner applying={applying} aboveNav={aboveNav} onApply={apply} onDismiss={dismiss} />
  )
}
