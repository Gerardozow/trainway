import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { Sparkles } from 'lucide-react'
import { useAuth } from '@/lib/supabase/useAuth'
import { supabase } from '@/lib/supabase/client'
import {
  currentWeek,
  createIntake,
  getActiveProgram,
  getHistoryFor,
  getProgramDays,
  getSessionsForProgram,
  getTranslations,
} from '@/lib/supabase/queries'
import { buildBlockSummary } from '@/lib/blockSummary'
import { generatePlan, reviewBlock, translateExercises } from '@/lib/api'
import type { Intake, ProgramExercise } from '@/lib/supabase/types'
import { Button, Spinner, buttonClass } from '@/components/ui'
import { PlanWeek } from '@/components/PlanWeek'

export function PlanView() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['plan', user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const program = await getActiveProgram(user!.id)
      if (!program) return { program: null }

      const days = await getProgramDays(program.id)
      const sessions = await getSessionsForProgram(
        user!.id,
        days.map((d) => d.id),
      )

      const { data: rows } = await supabase
        .from('program_exercises')
        .select('*')
        .in('program_day_id', days.map((d) => d.id))
        .order('position')

      const exercises = (rows ?? []) as ProgramExercise[]
      // Sin traducciones el plan se lee igual, con los nombres del catálogo.
      const translations = await getTranslations([
        ...new Set(exercises.map((e) => e.exercise_id)),
      ]).catch(() => ({}))

      return {
        program,
        days,
        sessions,
        exercises,
        translations,
        week: currentWeek(program),
      }
    },
  })

  if (isLoading) {
    return (
      <div className="grid flex-1 place-items-center">
        <Spinner className="size-8" />
      </div>
    )
  }
  if (data && !data.program) return <Navigate to="/empezar" replace />

  const { program, days = [], sessions = [], exercises = [], translations = {}, week = 1 } = data!
  const completed = new Set(
    sessions.filter((s) => s.completed_at).map((s) => s.program_day_id),
  )
  const allDone = days.length > 0 && days.every((d) => completed.has(d.id))

  async function generateNextBlock() {
    if (!user || !program) return
    setGenerating(true)
    setError(null)

    try {
      const exerciseIds = [...new Set(exercises.map((e) => e.exercise_id))]
      const history = await getHistoryFor(exerciseIds)

      const summary = buildBlockSummary({
        sessions,
        sessionsPlanned: days.length,
        exercises,
        logsByExercise: history,
      })

      const review = await reviewBlock(summary)

      // La revisión decide los parámetros; el intake nuevo los materializa.
      const { data: previous } = await supabase
        .from('intakes')
        .select('*')
        .eq('id', program.intake_id ?? '')
        .maybeSingle()
      const base = previous as Intake | null

      const intake = await createIntake({
        user_id: user.id,
        goal: (review.goal as Intake['goal']) ?? base?.goal ?? 'general',
        days_per_week: review.days_per_week || base?.days_per_week || 4,
        session_minutes: base?.session_minutes ?? 60,
        experience: base?.experience ?? 'intermedio',
        equipment: base?.equipment ?? [],
        focus_muscles: review.focus_muscles?.length
          ? review.focus_muscles
          : (base?.focus_muscles ?? []),
        include_cardio: base?.include_cardio ?? true,
        limitations: base?.limitations ?? null,
        free_notes: base?.free_notes ?? null,
      })

      const plan = await generatePlan(intake.id, { previousReview: review.notes_for_next_block })
      await translateExercises(plan.exercise_ids)
      await refetch()
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No pudimos armar el siguiente bloque.')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-4 py-6">
      <header className="flex flex-col gap-1">
        <p className="eyebrow">Bloque {program!.block_number}</p>
        <h1 className="display text-2xl">{program!.name}</h1>
        {program!.ai_rationale && (
          <p className="pt-1 text-sm leading-relaxed text-[var(--fg-muted)]">
            {program!.ai_rationale}
          </p>
        )}
      </header>

      <PlanWeek
        days={days}
        exercises={exercises}
        translations={translations}
        completed={completed}
        weeks={program!.weeks}
        currentWeek={week}
      />

      {error && (
        <p role="alert" className="text-sm font-semibold text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      {allDone ? (
        <section className="strip flex flex-col gap-3 p-4">
          <h2 className="display text-lg">Bloque terminado</h2>
          <p className="text-sm leading-relaxed text-[var(--fg-muted)]">
            Trainway revisa lo que levantaste, dónde te estancaste y qué tan duro se sintió, y arma
            el siguiente bloque a partir de eso.
          </p>
          <Button
            variant="volt"
            size="lg"
            full
            disabled={generating}
            onClick={() => void generateNextBlock()}
          >
            {generating ? <Spinner /> : <Sparkles className="size-5" aria-hidden />}
            {generating ? 'Revisando tu bloque' : 'Armar el siguiente bloque'}
          </Button>
        </section>
      ) : (
        <Link to="/empezar" className={buttonClass({ variant: 'ghost', full: true })}>
          Empezar un plan nuevo desde cero
        </Link>
      )}
    </main>
  )
}
