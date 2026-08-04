import { useState, type FormEvent } from 'react'
import { setUsername, validateUsername } from './profile-repository'

export function UsernameOnboarding({
  userId,
  onDone,
}: {
  userId: string
  onDone: () => void
}) {
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    const invalid = validateUsername(value)
    if (invalid) {
      setError(invalid)
      return
    }

    setSaving(true)
    const result = await setUsername(userId, value)
    setSaving(false)

    if (result.error) {
      setError(result.error)
      return
    }
    onDone()
  }

  return (
    <main className="flex min-h-full flex-col items-center justify-center gap-6 p-8">
      <div className="max-w-sm text-center">
        <h1 className="text-2xl font-bold text-content">Elige tu username</h1>
        <p className="mt-2 text-sm text-content-muted">
          Así te encuentran tus amigos para compartirte rutinas.
        </p>
      </div>

      <form onSubmit={onSubmit} className="flex w-full max-w-sm flex-col gap-3">
        <input
          value={value}
          onChange={(event) => setValue(event.target.value.toLowerCase())}
          className="rounded-lg border border-border bg-surface-raised px-4 py-3 text-content"
          placeholder="gerardo_99"
          autoComplete="off"
          aria-label="Username"
        />
        {error && <p className="text-sm text-content-muted">{error}</p>}
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-brand px-4 py-3 font-medium text-brand-content disabled:opacity-60"
        >
          {saving ? 'Guardando…' : 'Continuar'}
        </button>
      </form>
    </main>
  )
}
