export function SyncBanner({ online, pending }: { online: boolean; pending: number }) {
  if (online && pending === 0) return null

  const plural = pending === 1 ? 'cambio' : 'cambios'

  const message = online
    ? `Subiendo ${pending} ${plural}…`
    : pending > 0
      ? `Sin conexión · ${pending} ${plural} guardados en el teléfono`
      : 'Sin conexión · tus series se guardan en el teléfono'

  return (
    <p
      role="status"
      className={`flex items-center gap-2.5 rounded-xl border px-4 py-2.5 text-sm ${
        online
          ? 'border-border bg-surface-sunken text-content-muted'
          : 'border-cardio/40 bg-cardio-soft text-content'
      }`}
    >
      <span
        aria-hidden="true"
        className={`h-2 w-2 shrink-0 rounded-full ${
          online ? 'animate-pulse bg-ok' : 'bg-cardio'
        }`}
      />
      {message}
    </p>
  )
}
