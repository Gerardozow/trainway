import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Check, Sparkles } from 'lucide-react'
import { useAuth } from '@/lib/supabase/useAuth'
import { createIntake, getLatestIntake } from '@/lib/supabase/queries'
import { generatePlan, translateExercises } from '@/lib/api'
import { EQUIPMENT_ES, FOCUS_GROUPS } from '@/lib/catalog'
import {
  DAYS_OPTIONS,
  EQUIPMENT_OPTIONS,
  EXPERIENCES,
  GOALS,
  MAX_NOTES,
  MINUTES_OPTIONS,
  groupsFromMuscles,
  musclesFromGroups,
} from '@/lib/intakeOptions'
import type { Experience, Goal } from '@/lib/supabase/types'
import { BigOption, Button, Chip, Spinner, Textarea } from '@/components/ui'

type Draft = {
  goal: Goal
  daysPerWeek: number
  sessionMinutes: number
  experience: Experience
  equipment: string[]
  focusGroups: string[]
  includeCardio: boolean
  limitations: string
  freeNotes: string
}

/**
 * Editar el cuestionario sin volver a empezar.
 *
 * Hasta ahora las respuestas se daban una vez y quedaban congeladas: si el
 * gimnasio cambiaba de máquinas o pasabas de cuatro días a tres, la única
 * salida era generar un plan nuevo desde cero. Aquí se guardan como un
 * cuestionario nuevo —el historial de lo que se respondió no se pisa— y eso ya
 * cambia lo que se ofrece al cambiar un ejercicio. Regenerar el bloque es una
 * decisión aparte, porque sí tira el bloque en curso.
 */
export function Preferences() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [draft, setDraft] = useState<Draft | null>(null)
  const original = useRef<Draft | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [confirmRegen, setConfirmRegen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { data: intake, isLoading } = useQuery({
    queryKey: ['intake', user?.id],
    enabled: Boolean(user),
    queryFn: () => getLatestIntake(user!.id),
  })

  // El borrador se siembra una vez con lo que había respondido.
  useEffect(() => {
    if (!intake || draft) return
    const inicial: Draft = {
      goal: intake.goal,
      daysPerWeek: intake.days_per_week,
      sessionMinutes: intake.session_minutes,
      experience: intake.experience,
      equipment: intake.equipment,
      focusGroups: groupsFromMuscles(intake.focus_muscles),
      includeCardio: intake.include_cardio,
      limitations: intake.limitations ?? '',
      freeNotes: intake.free_notes ?? '',
    }
    original.current = inicial
    setDraft(inicial)
  }, [intake, draft])

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((prev) => (prev ? { ...prev, [key]: value } : prev))
    setSaved(false)
  }

  const toggle = (key: 'equipment' | 'focusGroups', value: string) => {
    setSaved(false)
    setDraft((prev) => {
      if (!prev) return prev
      const list = prev[key]
      return {
        ...prev,
        [key]: list.includes(value) ? list.filter((v) => v !== value) : [...list, value],
      }
    })
  }

  /** Guardar sin cambios crearía un cuestionario idéntico. Se compara y ya. */
  const dirty = draft !== null && JSON.stringify(draft) !== JSON.stringify(original.current)

  async function save(): Promise<string | null> {
    if (!user || !draft) return null

    const intake = await createIntake({
      user_id: user.id,
      goal: draft.goal,
      days_per_week: draft.daysPerWeek,
      session_minutes: draft.sessionMinutes,
      experience: draft.experience,
      equipment: draft.equipment,
      focus_muscles: musclesFromGroups(draft.focusGroups),
      include_cardio: draft.includeCardio,
      limitations: draft.limitations.trim() || null,
      free_notes: draft.freeNotes.trim() || null,
    })

    return intake.id
  }

  async function onSave() {
    setSaving(true)
    setError(null)
    try {
      await save()
      // La sesión lee el equipamiento del cuestionario más reciente para
      // ofrecer alternativas: sin esto seguiría ofreciendo la máquina que ya no
      // existe hasta que caducara la caché.
      await queryClient.invalidateQueries()
      original.current = draft
      setSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No pudimos guardar los cambios.')
    } finally {
      setSaving(false)
    }
  }

  /** Guarda y arma un bloque nuevo con las respuestas de ahora. */
  async function onRegenerate() {
    setRegenerating(true)
    setError(null)
    try {
      const intakeId = await save()
      if (!intakeId) return

      const plan = await generatePlan(intakeId)
      await translateExercises(plan.exercise_ids)

      queryClient.removeQueries()
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No pudimos generar el plan.')
      setRegenerating(false)
    }
  }

  if (isLoading || (intake && !draft)) {
    return (
      <div className="grid flex-1 place-items-center">
        <Spinner className="size-8" />
      </div>
    )
  }

  if (!draft) {
    return (
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-[var(--fg-muted)]">
          Todavía no has respondido el cuestionario. Créalo con tu primer plan.
        </p>
        <Button onClick={() => navigate('/empezar')}>Ir al cuestionario</Button>
      </main>
    )
  }

  if (regenerating) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-5 px-6 text-center">
        <Spinner className="size-10" />
        <h1 className="display text-2xl">Rehaciendo tu bloque</h1>
        <p className="text-[var(--fg-muted)]">
          Con lo que acabas de cambiar. Tarda unos 20 segundos.
        </p>
      </main>
    )
  }

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 px-4 py-4">
      <header className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => navigate('/perfil')}
          aria-label="Volver a Perfil"
          className="press -ml-2 grid size-12 place-items-center rounded-xl active:bg-[var(--surface-2)]"
        >
          <ArrowLeft className="size-5" aria-hidden />
        </button>
        <h1 className="display text-2xl">Tu entrenamiento</h1>
      </header>

      <Field label="Objetivo">
        <div className="flex flex-col gap-2">
          {GOALS.map((g) => (
            <BigOption
              key={g.value}
              selected={draft.goal === g.value}
              label={g.label}
              hint={g.hint}
              onClick={() => set('goal', g.value)}
            />
          ))}
        </div>
      </Field>

      <Field label="Días por semana">
        <div className="grid grid-cols-3 gap-2">
          {DAYS_OPTIONS.map((d) => (
            <Chip key={d} selected={draft.daysPerWeek === d} onClick={() => set('daysPerWeek', d)}>
              <span className="num text-xl">{d}</span>
            </Chip>
          ))}
        </div>
      </Field>

      <Field label="Duración de la sesión">
        <div className="grid grid-cols-3 gap-2">
          {MINUTES_OPTIONS.map((m) => (
            <Chip
              key={m}
              selected={draft.sessionMinutes === m}
              onClick={() => set('sessionMinutes', m)}
            >
              <span className="num text-lg">{m}</span>
              <span className="ml-1 text-sm font-normal">min</span>
            </Chip>
          ))}
        </div>
      </Field>

      <Field label="Experiencia">
        <div className="flex flex-col gap-2">
          {EXPERIENCES.map((e) => (
            <BigOption
              key={e.value}
              selected={draft.experience === e.value}
              label={e.label}
              hint={e.hint}
              onClick={() => set('experience', e.value)}
            />
          ))}
        </div>
      </Field>

      <Field
        label="Equipamiento"
        hint="Lo que hay hoy en tu gimnasio. Manda al cambiar un ejercicio."
      >
        <div className="grid grid-cols-2 gap-2">
          {EQUIPMENT_OPTIONS.map((eq) => (
            <Chip
              key={eq}
              selected={draft.equipment.includes(eq)}
              onClick={() => toggle('equipment', eq)}
            >
              {EQUIPMENT_ES[eq]}
            </Chip>
          ))}
        </div>
      </Field>

      <Field label="Cardio de gimnasio">
        <Chip
          selected={draft.includeCardio}
          onClick={() => set('includeCardio', !draft.includeCardio)}
          className="w-full"
        >
          {draft.includeCardio ? 'Sí, incluye cardio' : 'Solo pesas'}
        </Chip>
      </Field>

      <Field label="Grupos a enfatizar">
        <div className="grid grid-cols-3 gap-2">
          {FOCUS_GROUPS.map((g) => (
            <Chip
              key={g.key}
              selected={draft.focusGroups.includes(g.key)}
              onClick={() => toggle('focusGroups', g.key)}
            >
              {g.label}
            </Chip>
          ))}
        </div>
      </Field>

      <Field label="Lesiones o molestias">
        <Textarea
          rows={2}
          value={draft.limitations}
          maxLength={MAX_NOTES}
          onChange={(e) => set('limitations', e.target.value)}
          placeholder="Me duele el hombro derecho en press militar"
        />
      </Field>

      <Field label="Cualquier otra cosa">
        <Textarea
          rows={3}
          value={draft.freeNotes}
          maxLength={MAX_NOTES}
          onChange={(e) => set('freeNotes', e.target.value)}
          placeholder="Los martes salgo tarde del trabajo y solo tengo 40 minutos"
        />
      </Field>

      {error && (
        <p role="alert" className="text-sm font-semibold text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <section className="strip flex flex-col gap-3 p-4">
        <h2 className="display text-lg">Rehacer el bloque</h2>
        <p className="text-sm leading-snug text-[var(--fg-muted)]">
          Los cambios de arriba se aplican a lo que ya existe donde tienen sentido. Si quieres un
          plan nuevo con estas respuestas —otros ejercicios, otros días— hay que rehacerlo. El
          bloque en curso se archiva y las semanas empiezan de cero;{' '}
          <strong className="text-[var(--fg)]">tus registros no se borran</strong> y la carga sigue
          calculándose con ellos.
        </p>

        {confirmRegen ? (
          <div className="flex gap-2">
            <Button variant="outline" size="lg" full onClick={() => setConfirmRegen(false)}>
              Mejor no
            </Button>
            <Button variant="volt" size="lg" full onClick={() => void onRegenerate()}>
              Sí, rehacer
            </Button>
          </div>
        ) : (
          <Button
            variant="outline"
            size="lg"
            full
            disabled={draft.equipment.length === 0}
            onClick={() => setConfirmRegen(true)}
          >
            <Sparkles className="size-5" aria-hidden />
            Rehacer con estos cambios
          </Button>
        )}
      </section>

      {/* El formulario es largo; el botón acompaña. Enterrado abajo obligaba a
          recorrer nueve secciones para guardar un cambio de una ficha. */}
      <footer className="sticky bottom-0 flex flex-col gap-1 bg-[var(--bg)] pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <Button
          variant="volt"
          size="lg"
          full
          disabled={saving || !dirty || draft.equipment.length === 0}
          onClick={() => void onSave()}
        >
          {saving ? <Spinner /> : saved && !dirty ? <Check className="size-5" aria-hidden /> : null}
          {saved && !dirty ? 'Guardado' : 'Guardar cambios'}
        </Button>

        {draft.equipment.length === 0 && (
          <p className="text-center text-xs text-[var(--fg-muted)]">
            Elige al menos un equipamiento.
          </p>
        )}
      </footer>
    </main>
  )
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="eyebrow">{label}</h2>
      {hint && <p className="-mt-1 text-xs text-[var(--fg-muted)]">{hint}</p>}
      {children}
    </section>
  )
}
