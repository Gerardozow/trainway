import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router'
import { useAuth } from '@/lib/supabase/useAuth'
import { Button, Input, Spinner } from '@/components/ui'
import { Wordmark } from '@/components/Wordmark'

type Mode = 'entrar' | 'crear'

export function Auth() {
  const { user, loading, signIn, signUp } = useAuth()
  const [mode, setMode] = useState<Mode>('entrar')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)

  if (loading) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <Spinner className="size-8" />
      </div>
    )
  }
  if (user) return <Navigate to="/" replace />

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError('La contraseña necesita al menos 8 caracteres.')
      return
    }

    setBusy(true)
    try {
      if (mode === 'entrar') {
        await signIn(email, password)
      } else {
        await signUp(email, password, name.trim() || email.split('@')[0]!)
        setSent(true)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Algo falló. Inténtalo otra vez.')
    } finally {
      setBusy(false)
    }
  }

  if (sent) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-4 px-6 text-center">
        <Wordmark className="mx-auto h-7" />
        <h1 className="display text-2xl">Revisa tu correo</h1>
        <p className="text-[var(--fg-muted)]">
          Te mandamos un enlace a <strong className="text-[var(--fg)]">{email}</strong>. Ábrelo para
          activar tu cuenta.
        </p>
        <Button variant="ghost" onClick={() => { setSent(false); setMode('entrar') }}>
          Volver a entrar
        </Button>
      </main>
    )
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-8 px-6 py-10">
      <div className="flex flex-col gap-3">
        <h1>
          <Wordmark className="h-7" />
          <span className="sr-only">Trainway</span>
        </h1>
        <p className="text-[var(--fg-muted)]">
          {mode === 'entrar'
            ? 'Tu plan de gimnasio, ajustado cada semana.'
            : 'Crea tu cuenta y arma tu primer bloque de 4 semanas.'}
        </p>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-3" noValidate>
        {mode === 'crear' && (
          <label className="flex flex-col gap-1.5">
            <span className="eyebrow">Nombre</span>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              placeholder="Gerardo"
            />
          </label>
        )}

        <label className="flex flex-col gap-1.5">
          <span className="eyebrow">Email</span>
          <Input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            inputMode="email"
            placeholder="tu@correo.com"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="eyebrow">Contraseña</span>
          <Input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === 'entrar' ? 'current-password' : 'new-password'}
            placeholder="Mínimo 8 caracteres"
          />
        </label>

        {error && (
          <p role="alert" className="text-sm font-semibold text-red-600 dark:text-red-400">
            {error}
          </p>
        )}

        <Button type="submit" variant="volt" size="lg" full disabled={busy} className="mt-2">
          {busy ? <Spinner /> : mode === 'entrar' ? 'Entrar' : 'Crear cuenta'}
        </Button>
      </form>

      <Button
        variant="ghost"
        onClick={() => {
          setMode(mode === 'entrar' ? 'crear' : 'entrar')
          setError(null)
        }}
      >
        {mode === 'entrar' ? '¿No tienes cuenta? Créala' : '¿Ya tienes cuenta? Entra'}
      </Button>
    </main>
  )
}
