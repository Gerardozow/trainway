import { useState, type FormEvent } from 'react'
import { formatWeight } from '../../shared/formatWeight'
import { Button, ErrorText, Eyebrow, Field } from '../../shared/ui'
import type { WorkoutSet } from './workout-types'

export function SetLogger({
  exerciseName,
  lastSets,
  target,
  onLog,
}: {
  exerciseName: string
  lastSets: WorkoutSet[] | null
  /** Lo que la rutina manda hacer hoy, si el entreno viene de una. */
  target?: { sets: number | null; reps: number | null } | null
  onLog: (input: { weight: number; reps: number }) => Promise<void>
}) {
  const [weight, setWeight] = useState('')
  const [reps, setReps] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()

    const weightValue = Number(weight)
    const repsValue = Number(reps)

    if (weight.trim() === '' || !Number.isFinite(weightValue) || weightValue < 0) {
      setError('Escribe el peso')
      return
    }
    if (reps.trim() === '' || !Number.isInteger(repsValue) || repsValue <= 0) {
      setError('Escribe cuántas repeticiones hiciste, en número entero')
      return
    }

    setError(null)
    setSaving(true)
    try {
      await onLog({ weight: weightValue, reps: repsValue })
      // El peso se conserva: casi siempre repites el mismo varias series.
      setReps('')
    } catch {
      setError('No se pudo registrar la serie')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-4 rounded-2xl border border-border bg-surface-raised p-4"
    >
      <div>
        <Eyebrow tone="strength">En curso</Eyebrow>
        <h2 className="mt-1 text-xl font-bold text-content">{exerciseName}</h2>
      </div>

      {/* La referencia de la última vez es lo que hace útil a la app: sin ella
          esto es una libreta. Va primero y con peso visual. */}
      <div className="rounded-xl bg-surface-sunken px-4 py-3">
        {lastSets && lastSets.length > 0 ? (
          <>
            <Eyebrow>La última vez</Eyebrow>
            <p className="mt-1 font-display text-lg font-bold text-content">
              {lastSets
                .map((set) => `${formatWeight(set.weight)} × ${set.reps}`)
                .join('  ·  ')}
            </p>
          </>
        ) : (
          <>
            <Eyebrow>Primera vez</Eyebrow>
            <p className="mt-1 text-sm text-content-muted">
              Empieza ligero. La próxima vez verás aquí lo de hoy.
            </p>
          </>
        )}

        {target && (target.sets || target.reps) && (
          <p className="mt-2 text-sm text-content-muted">
            Hoy toca{' '}
            <b className="text-strength">
              {target.sets ?? '?'} × {target.reps ?? '?'}
            </b>
          </p>
        )}
      </div>

      <div className="flex gap-3">
        <div className="flex-1">
          <Field
            id="set-weight"
            label="Peso (kg)"
            big
            inputMode="decimal"
            value={weight}
            onChange={(event) => setWeight(event.target.value)}
            autoComplete="off"
          />
        </div>
        <div className="flex-1">
          <Field
            id="set-reps"
            label="Repeticiones"
            big
            inputMode="numeric"
            value={reps}
            onChange={(event) => setReps(event.target.value)}
            autoComplete="off"
          />
        </div>
      </div>

      {error && <ErrorText>{error}</ErrorText>}

      <Button type="submit" variant="primary" size="lg" disabled={saving}>
        {saving ? 'Registrando…' : 'Registrar serie'}
      </Button>
    </form>
  )
}
