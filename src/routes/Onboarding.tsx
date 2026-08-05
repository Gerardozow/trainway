import { useState } from 'react'
import { useNavigate } from 'react-router'
import { ArrowLeft } from 'lucide-react'
import { useAuth } from '@/lib/supabase/useAuth'
import { createIntake } from '@/lib/supabase/queries'
import { generatePlan, translateExercises } from '@/lib/api'
import { EQUIPMENT_ES, FOCUS_GROUPS } from '@/lib/catalog'
import type { Goal, Experience } from '@/lib/supabase/types'
import { Button, Chip, Textarea, Spinner } from '@/components/ui'
import { Wordmark } from '@/components/Wordmark'

const GOALS: { value: Goal; label: string; hint: string }[] = [
  { value: 'hipertrofia', label: 'Ganar músculo', hint: 'Volumen moderado, rangos de 6 a 12' },
  { value: 'fuerza', label: 'Ganar fuerza', hint: 'Cargas altas, rangos de 3 a 6' },
  { value: 'perdida_grasa', label: 'Perder grasa', hint: 'Mantener músculo, más densidad' },
  { value: 'resistencia', label: 'Aguantar más', hint: 'Series largas, descansos cortos' },
  { value: 'general', label: 'Estar en forma', hint: 'Equilibrado, sin especializar' },
]

const EXPERIENCES: { value: Experience; label: string; hint: string }[] = [
  { value: 'principiante', label: 'Principiante', hint: 'Menos de 6 meses entrenando' },
  { value: 'intermedio', label: 'Intermedio', hint: 'Entre 6 meses y 2 años' },
  { value: 'avanzado', label: 'Avanzado', hint: 'Más de 2 años, técnica sólida' },
]

const EQUIPMENT_OPTIONS = ['barbell', 'dumbbell', 'machine', 'cable', 'kettlebells', 'bands', 'body only']

const TOTAL_STEPS = 6
const MAX_NOTES = 2000

type Answers = {
  goal: Goal | null
  daysPerWeek: number | null
  sessionMinutes: number | null
  experience: Experience | null
  equipment: string[]
  focusMuscles: string[]
  includeCardio: boolean
  limitations: string
  freeNotes: string
}

const EMPTY: Answers = {
  goal: null,
  daysPerWeek: null,
  sessionMinutes: null,
  experience: null,
  equipment: [],
  focusMuscles: [],
  includeCardio: false,
  limitations: '',
  freeNotes: '',
}

export function Onboarding() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [a, setA] = useState<Answers>(EMPTY)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = <K extends keyof Answers>(key: K, value: Answers[K]) =>
    setA((prev) => ({ ...prev, [key]: value }))

  const toggle = (key: 'equipment' | 'focusMuscles', value: string) =>
    setA((prev) => ({
      ...prev,
      [key]: prev[key].includes(value)
        ? prev[key].filter((v) => v !== value)
        : [...prev[key], value],
    }))

  const canAdvance = [
    a.goal !== null,
    a.daysPerWeek !== null,
    a.sessionMinutes !== null,
    a.experience !== null,
    a.equipment.length > 0,
    true, // el último paso es opcional
  ][step]

  async function submit() {
    if (!user) return
    setBusy(true)
    setError(null)

    try {
      const intake = await createIntake({
        user_id: user.id,
        goal: a.goal!,
        days_per_week: a.daysPerWeek!,
        session_minutes: a.sessionMinutes!,
        experience: a.experience!,
        equipment: a.equipment,
        focus_muscles: a.focusMuscles.flatMap(
          (k) => FOCUS_GROUPS.find((g) => g.key === k)?.muscles ?? [],
        ),
        include_cardio: a.includeCardio,
        limitations: a.limitations.trim() || null,
        free_notes: a.freeNotes.trim() || null,
      })

      const plan = await generatePlan(intake.id)
      await translateExercises(plan.exercise_ids)
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No pudimos generar tu plan.')
      setBusy(false)
    }
  }

  if (busy) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-5 px-6 text-center">
        <Spinner className="size-10" />
        <h1 className="display text-2xl">Armando tu bloque</h1>
        <p className="text-[var(--fg-muted)]">
          Elegimos ejercicios, ajustamos series y traducimos las instrucciones. Tarda unos 20
          segundos.
        </p>
      </main>
    )
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-5 py-6">
      <header className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <Wordmark className="h-6" />
          <span className="eyebrow">
            {step + 1} de {TOTAL_STEPS}
          </span>
        </div>
        <div className="h-1 w-full overflow-hidden rounded-full bg-[var(--surface-2)]">
          <div
            className="h-full rounded-full bg-volt transition-[width] duration-300"
            style={{ width: `${((step + 1) / TOTAL_STEPS) * 100}%` }}
          />
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-5 pt-8">
        {step === 0 && (
          <Question title="¿Qué quieres lograr?" hint="Define cómo se arma todo lo demás.">
            {GOALS.map((g) => (
              <BigOption
                key={g.value}
                selected={a.goal === g.value}
                label={g.label}
                hint={g.hint}
                onClick={() => set('goal', g.value)}
              />
            ))}
          </Question>
        )}

        {step === 1 && (
          <Question title="¿Cuántos días por semana?" hint="Sé realista: la constancia manda.">
            <div className="grid grid-cols-3 gap-2">
              {[2, 3, 4, 5, 6, 7].map((d) => (
                <Chip key={d} selected={a.daysPerWeek === d} onClick={() => set('daysPerWeek', d)}>
                  <span className="num text-xl">{d}</span>
                </Chip>
              ))}
            </div>
          </Question>
        )}

        {step === 2 && (
          <Question title="¿Cuánto dura tu sesión?" hint="Sin contar el vestidor.">
            <div className="grid grid-cols-2 gap-2">
              {[30, 45, 60, 75, 90, 120].map((m) => (
                <Chip
                  key={m}
                  selected={a.sessionMinutes === m}
                  onClick={() => set('sessionMinutes', m)}
                >
                  <span className="num text-lg">{m}</span>
                  <span className="ml-1 text-sm font-normal">min</span>
                </Chip>
              ))}
            </div>
          </Question>
        )}

        {step === 3 && (
          <Question title="¿Cuánto llevas entrenando?" hint="Ajusta la dificultad de los ejercicios.">
            {EXPERIENCES.map((e) => (
              <BigOption
                key={e.value}
                selected={a.experience === e.value}
                label={e.label}
                hint={e.hint}
                onClick={() => set('experience', e.value)}
              />
            ))}
          </Question>
        )}

        {step === 4 && (
          <Question title="¿Qué tienes disponible?" hint="Elige todo lo que haya en tu gimnasio.">
            <div className="grid grid-cols-2 gap-2">
              {EQUIPMENT_OPTIONS.map((eq) => (
                <Chip
                  key={eq}
                  selected={a.equipment.includes(eq)}
                  onClick={() => toggle('equipment', eq)}
                >
                  {EQUIPMENT_ES[eq]}
                </Chip>
              ))}
            </div>

            <div className="mt-4 flex flex-col gap-2">
              <p className="eyebrow">Cardio de gimnasio</p>
              <Chip
                selected={a.includeCardio}
                onClick={() => set('includeCardio', !a.includeCardio)}
                className="w-full"
              >
                {a.includeCardio ? 'Sí, incluye cardio' : 'Solo pesas'}
              </Chip>
              <p className="text-xs text-[var(--fg-muted)]">
                Cinta, elíptica, remo, bici estática y escaladora.
              </p>
            </div>
          </Question>
        )}

        {step === 5 && (
          <Question
            title="¿Algo que debamos saber?"
            hint="Opcional, pero es lo que más cambia tu plan."
          >
            <div className="flex flex-col gap-2">
              <p className="eyebrow">Grupos a enfatizar</p>
              <div className="grid grid-cols-3 gap-2">
                {FOCUS_GROUPS.map((g) => (
                  <Chip
                    key={g.key}
                    selected={a.focusMuscles.includes(g.key)}
                    onClick={() => toggle('focusMuscles', g.key)}
                  >
                    {g.label}
                  </Chip>
                ))}
              </div>
            </div>

            <label className="mt-4 flex flex-col gap-2">
              <span className="eyebrow">Lesiones o molestias</span>
              <Textarea
                rows={2}
                value={a.limitations}
                maxLength={MAX_NOTES}
                onChange={(e) => set('limitations', e.target.value)}
                placeholder="Me duele el hombro derecho en press militar"
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className="eyebrow">Cualquier otra cosa</span>
              <Textarea
                rows={3}
                value={a.freeNotes}
                maxLength={MAX_NOTES}
                onChange={(e) => set('freeNotes', e.target.value)}
                placeholder="Los martes salgo tarde del trabajo y solo tengo 40 minutos"
              />
              <span className="self-end text-xs text-[var(--fg-muted)]">
                {a.freeNotes.length} / {MAX_NOTES}
              </span>
            </label>
          </Question>
        )}
      </div>

      {error && (
        <p role="alert" className="pb-3 text-sm font-semibold text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <footer className="sticky bottom-0 flex gap-2 bg-[var(--bg)] pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {step > 0 && (
          <Button variant="outline" size="lg" onClick={() => setStep(step - 1)} aria-label="Atrás">
            <ArrowLeft className="size-5" aria-hidden />
          </Button>
        )}
        <Button
          variant="volt"
          size="lg"
          full
          disabled={!canAdvance}
          onClick={() => (step === TOTAL_STEPS - 1 ? void submit() : setStep(step + 1))}
        >
          {step === TOTAL_STEPS - 1 ? 'Crear mi plan' : 'Siguiente'}
        </Button>
      </footer>
    </main>
  )
}

function Question({
  title,
  hint,
  children,
}: {
  title: string
  hint: string
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="display text-2xl">{title}</h1>
        <p className="text-sm text-[var(--fg-muted)]">{hint}</p>
      </div>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  )
}

function BigOption({
  selected,
  label,
  hint,
  onClick,
}: {
  selected: boolean
  label: string
  hint: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`flex min-h-16 flex-col justify-center rounded-xl border px-4 py-3 text-left transition-colors ${
        selected
          ? 'border-volt bg-volt text-volt-fg'
          : 'border-[var(--line)] bg-[var(--surface)] active:bg-[var(--surface-2)]'
      }`}
    >
      <span className="font-bold">{label}</span>
      <span className={`text-sm ${selected ? 'opacity-70' : 'text-[var(--fg-muted)]'}`}>{hint}</span>
    </button>
  )
}
