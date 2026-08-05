const FIELD =
  'rounded-lg border border-border bg-surface-raised px-4 py-3 text-content'

export function ExerciseSearch({
  query,
  onQueryChange,
  muscle,
  onMuscleChange,
  muscles,
}: {
  query: string
  onQueryChange: (value: string) => void
  muscle: string | null
  onMuscleChange: (value: string | null) => void
  muscles: string[]
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="exercise-search" className="text-sm text-content-muted">
        Buscar
      </label>
      <input
        id="exercise-search"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        className={FIELD}
        placeholder="sentadilla, press…"
        autoComplete="off"
      />

      <label htmlFor="exercise-muscle" className="mt-2 text-sm text-content-muted">
        Músculo
      </label>
      <select
        id="exercise-muscle"
        value={muscle ?? ''}
        onChange={(event) => onMuscleChange(event.target.value || null)}
        className={FIELD}
      >
        <option value="">Todos</option>
        {muscles.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>
    </div>
  )
}
