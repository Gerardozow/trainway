export function SyncBanner({ online, pending }: { online: boolean; pending: number }) {
  if (online && pending === 0) return null

  const plural = pending === 1 ? 'cambio' : 'cambios'

  const message = online
    ? `Subiendo ${pending} ${plural}…`
    : pending > 0
      ? `Sin conexión. ${pending} ${plural} por subir; nada se pierde.`
      : 'Sin conexión. Tus series se guardan en el teléfono.'

  return (
    <p
      role="status"
      className="rounded-lg border border-border bg-surface-raised px-4 py-2 text-sm text-content-muted"
    >
      {message}
    </p>
  )
}
