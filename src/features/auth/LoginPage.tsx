import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { signInWithIdentifier, signInWithEmail } from './auth-repository'
import { AuthLayout } from './AuthLayout'
import { Button, ErrorText, Field } from '../../shared/ui'


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
    <AuthLayout
      eyebrow="Trainway"
      title={
        <>
          Entrena y no<br />lo <span className="text-cardio">olvides</span>.
        </>
      }
      lead={
        mode === 'password'
          ? 'Con tu usuario o tu correo, lo que recuerdes.'
          : 'Te mandamos un enlace y entras sin contraseña.'
      }
      footer={
        mode === 'password' ? (
          <Link to="/registro" className="text-content-muted underline">
            Crear cuenta
          </Link>
        ) : null
      }
    >
      {mode === 'password' ? (
        <form onSubmit={onPasswordSubmit} className="flex flex-col gap-4">
          <Field
            id="login-identifier"
            label="Usuario o correo"
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            autoComplete="username"
          />

          <Field
            id="login-password"
            label="Contraseña"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
          />

          {error && (
            <div>
              <ErrorText>{error}</ErrorText>
              <p className="mt-1.5 text-xs text-content-muted">
                ¿Acabas de registrarte? Confirma tu correo antes de entrar.
              </p>
            </div>
          )}

          <Button type="submit" variant="primary" size="lg" disabled={busy}>
            {busy ? 'Entrando…' : 'Entrar'}
          </Button>

          <Button
            type="button"
            variant="ghost"
            disabled={busy}
            onClick={() => {
              setMode('magic')
              setError(null)
              setPassword('')
              setIdentifier('')
            }}
          >
            Enlace por correo
          </Button>
        </form>
      ) : linkSent ? (
        <div className="rounded-2xl border border-border bg-surface-raised p-5">
          <p className="text-content-muted">
            Te enviamos un enlace a{' '}
            <strong className="text-content">{email}</strong>. Ábrelo en este
            dispositivo para entrar.
          </p>
        </div>
      ) : (
        <form onSubmit={onMagicSubmit} className="flex flex-col gap-4">
          <Field
            id="login-email"
            label="Correo"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="tu@correo.com"
            autoComplete="email"
          />

          {error && <ErrorText>{error}</ErrorText>}

          <Button type="submit" variant="primary" size="lg" disabled={busy}>
            {busy ? 'Enviando…' : 'Enviar enlace'}
          </Button>

          <Button
            type="button"
            variant="ghost"
            disabled={busy}
            onClick={() => {
              setMode('password')
              setError(null)
            }}
          >
            Usar contraseña
          </Button>
        </form>
      )}
    </AuthLayout>
  )
}
