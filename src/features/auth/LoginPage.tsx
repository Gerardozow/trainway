import { useState, type FormEvent } from 'react'
import { signInWithEmail, signInWithGoogle } from './auth-repository'

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setStatus('sending')
    setError(null)

    const result = await signInWithEmail(email)
    if (result.error) {
      setError(result.error)
      setStatus('idle')
      return
    }
    setStatus('sent')
  }

  return (
    <main className="flex min-h-full flex-col items-center justify-center gap-8 p-8">
      <h1 className="text-4xl font-bold text-content">Trainway</h1>

      {status === 'sent' ? (
        <p className="max-w-sm text-center text-content-muted">
          Te enviamos un enlace a <strong className="text-content">{email}</strong>.
          Ábrelo en este dispositivo para entrar.
        </p>
      ) : (
        <form onSubmit={onSubmit} className="flex w-full max-w-sm flex-col gap-3">
          <label htmlFor="email" className="text-sm text-content-muted">
            Correo
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="rounded-lg border border-border bg-surface-raised px-4 py-3 text-content"
            placeholder="tu@correo.com"
            autoComplete="email"
          />
          {error && <p className="text-sm text-content-muted">{error}</p>}
          <button
            type="submit"
            disabled={status === 'sending'}
            className="rounded-lg bg-brand px-4 py-3 font-medium text-brand-content disabled:opacity-60"
          >
            {status === 'sending' ? 'Enviando…' : 'Enviar enlace de acceso'}
          </button>
          <button
            type="button"
            onClick={() => signInWithGoogle()}
            className="rounded-lg border border-border px-4 py-3 font-medium text-content"
          >
            Entrar con Google
          </button>
        </form>
      )}
    </main>
  )
}
