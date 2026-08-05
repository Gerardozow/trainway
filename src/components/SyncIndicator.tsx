import { useEffect, useState } from 'react'
import { CloudOff, RefreshCw } from 'lucide-react'
import { startSync, syncNow } from '@/lib/offline'

/**
 * Cuántas series faltan por subir. Solo aparece cuando hay algo pendiente:
 * un indicador que siempre está encendido deja de significar nada.
 */
export function SyncIndicator() {
  const [pending, setPending] = useState(0)
  const [busy, setBusy] = useState(false)

  useEffect(() => startSync(setPending), [])

  if (pending === 0) return null

  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true)
        const { synced } = await syncNow()
        setPending((p) => Math.max(0, p - synced))
        setBusy(false)
      }}
      className="flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-xs font-bold text-[var(--fg-muted)]"
    >
      {busy ? (
        <RefreshCw className="size-4 animate-spin" aria-hidden />
      ) : (
        <CloudOff className="size-4" aria-hidden />
      )}
      <span>{pending} sin subir</span>
    </button>
  )
}
