import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { signUpWithPassword } from './auth-repository'
import { AuthLayout } from './AuthLayout'
import { Button, ErrorText, Field } from '../../shared/ui'
import { isUsernameAvailable, validateUsername } from '../profile/profile-repository'

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

    try {
      // Recortado una sola vez, aquí, y reusado en las tres llamadas de
      // abajo: signUpWithPassword también recorta por su cuenta (defensivo,
      // por si algún otro llamador no lo hiciera), pero sin recortar aquí
      // también, un espacio al final pasaría validateUsername (que sí
      // recorta) y llegaría crudo a isUsernameAvailable -- consultando un
      // username distinto del que en realidad se va a guardar.
      const normalizedUsername = username.trim()

      // Antes de gastar una llamada de red en disponibilidad, el formato:
      // así un username vacío o mal escrito da el error más útil primero.
      const invalidUsername = validateUsername(normalizedUsername)
      if (invalidUsername) {
        setError(invalidUsername)
        return
      }

      // No cierra la carrera —entre esta comprobación y el alta alguien más
      // puede tomar el nombre— pero convierte el caso común en un mensaje
      // claro en vez de un perfil sin nombre. Solo bloquea en un "tomado"
      // explícito (false); si el RPC falla, isUsernameAvailable devuelve
      // null y aquí se deja pasar: el trigger handle_new_user es la
      // garantía real de que la cuenta no se pierde, no este pre-chequeo, y
      // fallar cerrado bloquearía toda alta mientras el RPC esté caído.
      const available = await isUsernameAvailable(normalizedUsername)
      if (available === false) {
        setError('Ese username ya está tomado')
        return
      }

      const result = await signUpWithPassword(email, password, normalizedUsername)
      if (result.error) {
        setError(result.error)
        return
      }
      setDone(true)
    } finally {
      // Todo fallo esperado vuelve como valor, nunca como excepción. Si
      // algo sí revienta, el botón no puede quedar deshabilitado para
      // siempre sin mensaje ni forma de reintentar salvo recargar.
      setSaving(false)
    }
  }

  if (done) {
    return (
      <AuthLayout
        eyebrow="Casi listo"
        title="Cuenta creada"
        lead="Revisa tu correo para confirmarla y ya puedes entrar."
      >
        <Link
          to="/login"
          className="block rounded-xl bg-brand px-5 py-4 text-center text-lg font-semibold text-brand-content"
        >
          Ir a entrar
        </Link>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      eyebrow="Trainway"
      title={
        <>
          Empieza<br />sin <span className="text-cardio">complicarte</span>.
        </>
      }
      lead="Tu usuario es como te encuentran tus amigos para compartirte rutinas."
      footer={
        <Link to="/login" className="text-content-muted underline">
          Ya tengo cuenta
        </Link>
      }
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <Field
          id="signup-email"
          label="Correo"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
        />

        <Field
          id="signup-password"
          label="Contraseña"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="new-password"
          placeholder="Mínimo 8 caracteres"
        />

        <Field
          id="signup-username"
          label="Usuario"
          value={username}
          onChange={(event) => setUsername(event.target.value.toLowerCase())}
          placeholder="gerardo_99"
          autoComplete="off"
        />

        {error && <ErrorText>{error}</ErrorText>}

        <Button type="submit" variant="primary" size="lg" disabled={saving}>
          {saving ? 'Creando…' : 'Crear cuenta'}
        </Button>
      </form>
    </AuthLayout>
  )
}
