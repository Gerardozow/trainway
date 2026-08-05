import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { signInWithIdentifier, signInWithEmail } from './auth-repository'

const FIELD =
  'rounded-lg border border-border bg-surface-raised px-4 py-3 text-content'
const PRIMARY =
  'rounded-lg bg-brand px-4 py-3 font-medium text-brand-content disabled:opacity-60'
const SECONDARY =
  'rounded-lg border border-border px-4 py-3 font-medium text-content disabled:opacity-60'

export function LoginPage() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<'password' | 'magic'>('password')
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [linkSent, setLinkSent] = useState(false)

  async function onPasswordSubmit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)

    try {
      const result = await signInWithIdentifier(identifier, password)
      if (result.error) {
        setError(result.error)
        return
      }
      // /login es una ruta pública sin guardia propia: a diferencia del
      // magic link y de Google, que vuelven a la app por una URL de
      // redirección, este camino nunca sale de /login. Sin esta navegación
      // explícita, el login por contraseña deja una sesión válida pero a
      // quien entró viendo el mismo formulario, como si no hubiera pasado
      // nada.
      navigate('/')
    } finally {
      // Todo fallo esperado vuelve como valor (`result.error`), nunca como
      // excepción. Pero si algo sí revienta (un error inesperado en
      // signInWithIdentifier), el botón no puede quedar deshabilitado para
      // siempre sin mensaje ni forma de reintentar salvo recargar.
      setBusy(false)
    }
  }

  async function onMagicSubmit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)

    try {
      const result = await signInWithEmail(email)
      if (result.error) {
        setError(result.error)
        return
      }
      setLinkSent(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="flex min-h-full flex-col items-center justify-center gap-8 p-8">
      <h1 className="text-4xl font-bold text-content">Trainway</h1>

      {mode === 'password' ? (
        <form onSubmit={onPasswordSubmit} className="flex w-full max-w-sm flex-col gap-3">
          <label htmlFor="login-identifier" className="text-sm text-content-muted">
            Usuario o correo
          </label>
          <input
            id="login-identifier"
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            className={FIELD}
            autoComplete="username"
          />

          <label htmlFor="login-password" className="text-sm text-content-muted">
            Contraseña
          </label>
          <input
            id="login-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className={FIELD}
            autoComplete="current-password"
          />

          {error && (
            <>
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
              {/* No depende del identificador: se muestra ante CUALQUIER
                  fallo de credenciales, incluida una contraseña mal escrita,
                  así que no delata si la cuenta existe ni si está
                  confirmada. Existe porque enable_confirmations = true sin
                  SMTP configurado (ver README.md) puede dejar una cuenta
                  real, recién creada, sin poder confirmarse nunca -- y hoy
                  esa cuenta recibe exactamente el mismo "Credenciales
                  inválidas" que una contraseña mala, sin ninguna pista de
                  qué hacer. Visualmente subordinada al error: texto más
                  pequeño y del color neutro, no del color de error. */}
              <p className="text-xs text-content-muted">
                ¿Acabas de registrarte? Confirma tu correo antes de entrar.
              </p>
            </>
          )}

          <button type="submit" disabled={busy} className={PRIMARY}>
            {busy ? 'Entrando…' : 'Entrar'}
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setMode('magic')
              setError(null)
              setIdentifier('')
              setPassword('')
            }}
            className={SECONDARY}
          >
            Enlace por correo
          </button>

          <Link to="/registro" className="pt-2 text-center text-sm text-content-muted">
            Crear cuenta
          </Link>
        </form>
      ) : linkSent ? (
        <p className="max-w-sm text-center text-content-muted">
          Te enviamos un enlace a <strong className="text-content">{email}</strong>.
          Ábrelo en este dispositivo para entrar.
        </p>
      ) : (
        <form onSubmit={onMagicSubmit} className="flex w-full max-w-sm flex-col gap-3">
          <label htmlFor="login-email" className="text-sm text-content-muted">
            Correo
          </label>
          <input
            id="login-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={FIELD}
            placeholder="tu@correo.com"
            autoComplete="email"
          />

          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}

          <button type="submit" disabled={busy} className={PRIMARY}>
            {busy ? 'Enviando…' : 'Enviar enlace de acceso'}
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setMode('password')
              setError(null)
            }}
            className={SECONDARY}
          >
            Usar contraseña
          </button>
        </form>
      )}

      {/* Acceso con Google está diferido: supabase/config.toml no tiene
          [auth.external.google] configurado todavía, así que el botón
          solo llevaría a un error de "Unsupported provider". signInWithGoogle
          sigue exportado y probado en auth-repository.ts para cuando existan
          credenciales de OAuth de Google. */}
    </main>
  )
}
