import { useState, type FormEvent } from 'react'
import { formatWeight } from '../../shared/formatWeight'
import type { WorkoutSet } from './workout-types'

// Campos grandes: esto se usa de pie, con una mano, sudando.
const FIELD =
  'w-full rounded-lg border border-border bg-surface-raised px-4 py-4 text-2xl text-content'

export function SetLogger({
  exerciseName,
  lastSets,
  onLog,
}: {
  exerciseName: string
  lastSets: WorkoutSet[] | null
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
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold text-content">{exerciseName}</h2>

      <p className="text-sm text-content-muted">
        {lastSets && lastSets.length > 0
          ? `La última vez: ${lastSets
              .map((set) => `${formatWeight(set.weight)} × ${set.reps}`)
              .join(', ')}`
          : 'Primera vez con este ejercicio'}
      </p>

      <div className="flex gap-3">
        <div className="flex-1">
          <label htmlFor="set-weight" className="text-sm text-content-muted">
            Peso (kg)
          </label>
          <input
            id="set-weight"
            inputMode="decimal"
            value={weight}
            onChange={(event) => setWeight(event.target.value)}
            className={FIELD}
            autoComplete="off"
          />
        </div>

        <div className="flex-1">
          <label htmlFor="set-reps" className="text-sm text-content-muted">
            Repeticiones
          </label>
          <input
            id="set-reps"
            inputMode="numeric"
            value={reps}
            onChange={(event) => setReps(event.target.value)}
            className={FIELD}
            autoComplete="off"
          />
        </div>
      </div>

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={saving}
        className="rounded-lg bg-brand px-4 py-4 text-lg font-medium text-brand-content disabled:opacity-60"
      >
        {saving ? 'Registrando…' : 'Registrar serie'}
      </button>
    </form>
  )
}
