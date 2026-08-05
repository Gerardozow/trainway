import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useAuth } from '@/lib/supabase/useAuth'
import { supabase } from '@/lib/supabase/client'
import {
  currentWeek,
  getActiveProgram,
  getHistoryFor,
  getProfile,
  getProgramDays,
  getSessionsForProgram,
} from '@/lib/supabase/queries'
import { getExercise, muscleEs } from '@/lib/catalog'
import { weightUnit } from '@/lib/utils'
import type { ProgramExercise } from '@/lib/supabase/types'
import { EmptyState, Spinner } from '@/components/ui'
import { ChartFrame } from '@/components/charts/ChartFrame'
import { useChartTokens } from '@/components/charts/tokens'

export function Progress() {
  const { user } = useAuth()
  const t = useChartTokens()
  const [selected, setSelected] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['progress', user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const program = await getActiveProgram(user!.id)
      if (!program) return null

      const days = await getProgramDays(program.id)
      const sessions = await getSessionsForProgram(
        user!.id,
        days.map((d) => d.id),
      )

      const { data: rows } = await supabase
        .from('program_exercises')
        .select('*')
        .in('program_day_id', days.map((d) => d.id))

      const exercises = (rows ?? []) as ProgramExercise[]
      const uniqueIds = [...new Set(exercises.map((e) => e.exercise_id))]
      const history = await getHistoryFor(uniqueIds)
      const profile = await getProfile(user!.id)

      return { program, days, sessions, exercises, history, uniqueIds, profile, week: currentWeek(program) }
    },
  })

  const volumeRows = useMemo(() => {
    if (!data) return []
    const totals: Record<string, number> = {}

    for (const id of data.uniqueIds) {
      const logs = (data.history[id] ?? []).filter((l) => l.done)
      for (const muscle of getExercise(id)?.primaryMuscles ?? []) {
        totals[muscle] = (totals[muscle] ?? 0) + logs.length
      }
    }

    return Object.entries(totals)
      .map(([muscle, series]) => ({ label: muscleEs(muscle), series }))
      .sort((a, b) => b.series - a.series)
  }, [data])

  /** Ejercicios con al menos una serie marcada. Sin esto no hay tendencia que dibujar. */
  const trained = useMemo(
    () => data?.uniqueIds.filter((id) => (data.history[id] ?? []).some((l) => l.done)) ?? [],
    [data],
  )

  // El seleccionado se deriva; no se escribe estado durante el render.
  const currentExercise = selected ?? trained[0] ?? null

  const loadRows = useMemo(() => {
    if (!data || !currentExercise) return []
    const logs = (data.history[currentExercise] ?? []).filter((l) => l.done && l.weight !== null)

    const byDay = new Map<string, number>()
    for (const l of logs) {
      const day = l.logged_at.slice(0, 10)
      byDay.set(day, Math.max(byDay.get(day) ?? 0, l.weight!))
    }

    return [...byDay.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([day, weight]) => ({ label: day.slice(5), weight }))
  }, [data, currentExercise])

  if (isLoading) {
    return (
      <div className="grid flex-1 place-items-center">
        <Spinner className="size-8" />
      </div>
    )
  }

  if (!data) {
    return (
      <EmptyState
        title="Todavía no hay nada que medir"
        body="Crea tu plan y entrena unos días. En cuanto haya series registradas, aquí verás tu volumen y tus cargas."
      />
    )
  }

  const completed = data.sessions.filter((s) => s.completed_at).length
  const planned = data.days.filter((d) => d.week <= data.week).length
  const adherence = planned > 0 ? Math.round((completed / planned) * 100) : 0
  const units = data.profile?.units ?? 'metric'

  if (volumeRows.length === 0) {
    return (
      <EmptyState
        title="Aún sin series registradas"
        body="Marca algunas series en tu próximo entrenamiento y esta pantalla se llena sola."
      />
    )
  }

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 px-4 py-6">
      <header className="flex flex-col gap-1">
        <p className="eyebrow">Bloque {data.program.block_number}</p>
        <h1 className="display text-2xl">Tu progreso</h1>
      </header>

      {/* Adherencia es un número, no una gráfica: hay un solo dato que leer. */}
      <section className="strip flex items-center gap-4 p-4">
        <div className="flex flex-col">
          <span className="eyebrow">Adherencia</span>
          <span className="num text-5xl">{adherence}%</span>
        </div>
        <div className="flex flex-col gap-0.5 border-l border-[var(--line)] pl-4 text-sm">
          <span className="num text-xl">
            {completed}
            <span className="text-[var(--fg-muted)]">/{planned}</span>
          </span>
          <span className="text-[var(--fg-muted)]">entrenamientos hechos</span>
        </div>
      </section>

      <ChartFrame
        title="Volumen por grupo"
        hint="Series efectivas en lo que va del bloque"
        columns={['Grupo', 'Series']}
        rows={volumeRows.map((r) => [r.label, r.series])}
      >
        <ResponsiveContainer width="100%" height={Math.max(160, volumeRows.length * 34)}>
          <BarChart data={volumeRows} layout="vertical" margin={{ left: 0, right: 24, top: 4, bottom: 4 }}>
            <CartesianGrid horizontal={false} stroke={t.grid} />
            <XAxis type="number" stroke={t.axis} tickLine={false} axisLine={false} fontSize={11} />
            <YAxis
              type="category"
              dataKey="label"
              stroke={t.axis}
              tickLine={false}
              axisLine={false}
              width={92}
              fontSize={12}
            />
            <Tooltip
              cursor={{ fill: t.grid, opacity: 0.4 }}
              contentStyle={{
                background: t.surface,
                border: `1px solid ${t.grid}`,
                borderRadius: 12,
                color: t.ink,
                fontSize: 13,
              }}
              formatter={(v) => [`${String(v)} series`, '']}
            />
            <Bar dataKey="series" fill={t.series} radius={[0, 4, 4, 0]} barSize={14} />
          </BarChart>
        </ResponsiveContainer>
      </ChartFrame>

      {trained.length > 0 && (
        <ChartFrame
          title="Evolución de la carga"
          hint="Mejor serie de cada día"
          columns={['Fecha', weightUnit(units)]}
          rows={loadRows.map((r) => [r.label, r.weight])}
        >
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1">
              <span className="sr-only">Ejercicio</span>
              <select
                value={currentExercise ?? ''}
                onChange={(e) => setSelected(e.target.value)}
                className="min-h-12 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3"
              >
                {trained.map((id) => (
                  <option key={id} value={id}>
                    {getExercise(id)?.name ?? id}
                  </option>
                ))}
              </select>
            </label>

            {loadRows.length < 2 ? (
              <p className="py-8 text-center text-sm text-[var(--fg-muted)]">
                Hacen falta al menos dos sesiones de este ejercicio para dibujar una tendencia.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={loadRows} margin={{ left: -16, right: 12, top: 8, bottom: 4 }}>
                  <CartesianGrid vertical={false} stroke={t.grid} />
                  <XAxis dataKey="label" stroke={t.axis} tickLine={false} axisLine={false} fontSize={11} />
                  <YAxis stroke={t.axis} tickLine={false} axisLine={false} fontSize={11} width={44} />
                  <Tooltip
                    contentStyle={{
                      background: t.surface,
                      border: `1px solid ${t.grid}`,
                      borderRadius: 12,
                      color: t.ink,
                      fontSize: 13,
                    }}
                    formatter={(v) => [`${String(v)} ${weightUnit(units)}`, '']}
                  />
                  <Line
                    type="monotone"
                    dataKey="weight"
                    stroke={t.series}
                    strokeWidth={2}
                    dot={{ r: 4, fill: t.series, stroke: t.surface, strokeWidth: 2 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </ChartFrame>
      )}
    </main>
  )
}
