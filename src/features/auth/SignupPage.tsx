import { useState, type FormEvent } from 'react'
import { signUpWithPassword } from './auth-repository'

export function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError(null)

    const result = await signUpWithPassword(email, password, username)
    setSaving(false)

    if (result.error) {
      setError(result.error)
      return
    }
    setDone(true)
  }

  if (done) {
    return (
      <main className="flex min-h-full flex-col items-center justify-center gap-4 p-8">
        <h1 className="text-3xl font-bold text-content">Cuenta creada</h1>
        <p className="max-w-sm text-center text-content-muted">
          Revisa tu correo para confirmar la cuenta y ya puedes entrar.
        </p>
      </main>
    )
  }

  return (
    <main className="flex min-h-full flex-col items-center justify-center gap-8 p-8">
      <h1 className="text-4xl font-bold text-content">Trainway</h1>

      <form onSubmit={onSubmit} className="flex w-full max-w-sm flex-col gap-3">
        <label htmlFor="signup-email" className="text-sm text-content-muted">
          Correo
        </label>
        <input
          id="signup-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="rounded-lg border border-border bg-surface-raised px-4 py-3 text-content"
          autoComplete="email"
        />

        <label htmlFor="signup-password" className="text-sm text-content-muted">
          Contraseña
        </label>
        <input
          id="signup-password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="rounded-lg border border-border bg-surface-raised px-4 py-3 text-content"
          autoComplete="new-password"
        />

        <label htmlFor="signup-username" className="text-sm text-content-muted">
          Usuario
        </label>
        <input
          id="signup-username"
          value={username}
          onChange={(event) => setUsername(event.target.value.toLowerCase())}
          className="rounded-lg border border-border bg-surface-raised px-4 py-3 text-content"
          placeholder="gerardo_99"
          autoComplete="off"
        />

        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-brand px-4 py-3 font-medium text-brand-content disabled:opacity-60"
        >
          {saving ? 'Creando…' : 'Crear cuenta'}
        </button>
      </form>
    </main>
  )
}
