import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../auth/useAuth'
import { signOut } from '../auth/auth-repository'
import { ThemeToggle } from '../theme/ThemeToggle'
import { fetchProfile, setUsername, validateUsername } from './profile-repository'

// Finding 5 de la revisión final de rama: re-registrarse con un correo sin
// confirmar descarta el nuevo username en silencio (0003_username_from_signup.sql
// solo escribe el username en el alta, vía el trigger). Como el perfil ya
// tiene un username no nulo del primer intento, Gate nunca vuelve a ofrecer
// el onboarding -- y hasta este editor, nada en la app permitía cambiarlo.
// setUsername y validateUsername ya existen, están probados y RLS ya
// permite la escritura; esta pantalla solo les da una entrada.
export function ProfilePage() {
  const { session } = useAuth()
  const userId = session?.user?.id ?? null

  const [currentUsername, setCurrentUsername] = useState<string | null>(null)
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!userId) return
    fetchProfile(userId)
      .then((profile) => setCurrentUsername(profile?.username ?? null))
      .catch(() => setCurrentUsername(null))
  }, [userId])

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!userId) return
    setSaved(false)
    setError(null)

    // validateUsername ya recorta internamente, pero solo devuelve un
    // mensaje, no el valor normalizado -- así que se recorta también aquí,
    // antes de mandarlo, igual que en SignupPage y UsernameOnboarding.
    const normalized = value.trim().toLowerCase()
    const invalid = validateUsername(normalized)
    if (invalid) {
      setError(invalid)
      return
    }

    setSaving(true)
    const result = await setUsername(userId, normalized)
    setSaving(false)

    if (result.error) {
      setError(result.error)
      return
    }
    setCurrentUsername(normalized)
    setValue('')
    setSaved(true)
  }

  return (
    <section className="flex flex-col gap-6 p-6">
      <h1 className="text-2xl font-bold text-content">Perfil</h1>

      <div className="flex flex-col gap-3">
        <p className="text-sm text-content-muted">
          Usuario actual:{' '}
          <span className="text-content">{currentUsername ?? 'sin definir'}</span>
        </p>

        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <label htmlFor="profile-username" className="text-sm text-content-muted">
            Cambiar usuario
          </label>
          <input
            id="profile-username"
            value={value}
            onChange={(event) => {
              setValue(event.target.value.toLowerCase())
              setSaved(false)
            }}
            className="rounded-lg border border-border bg-surface-raised px-4 py-3 text-content"
            placeholder="nuevo_usuario"
            autoComplete="off"
          />

          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
          {saved && !error && (
            <p className="text-sm text-content-muted">Username actualizado.</p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="self-start rounded-lg bg-brand px-4 py-2 font-medium text-brand-content disabled:opacity-60"
          >
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </form>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm text-content-muted">Tema</span>
        <ThemeToggle />
      </div>

      <button
        type="button"
        onClick={() => signOut()}
        className="self-start rounded-lg border border-border px-4 py-2 text-content"
      >
        Cerrar sesión
      </button>
    </section>
  )
}
