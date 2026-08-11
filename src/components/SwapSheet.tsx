import { useEffect, useMemo, useRef, useState } from 'react'
import { getTranslations } from '@/lib/supabase/queries'
import { translateExercises } from '@/lib/api'
import { X } from 'lucide-react'
import { alternativesFor, equipmentEs, getExercise, muscleEs, type Exercise } from '@/lib/catalog'
import type { ExerciseTranslation } from '@/lib/supabase/types'
import { ExerciseImage } from './ExerciseImage'
import { MuscleMap } from './MuscleMap'
import { Button, Spinner } from '@/components/ui'
import { cn } from '@/lib/utils'

export type SwapScope = 'hoy' | 'bloque'

/**
 * Elegir otro ejercicio para el mismo músculo.
 *
 * Las alternativas salen del catálogo, no de la IA: estás de pie delante de una
 * máquina ocupada y la respuesta tiene que ser inmediata, también sin señal.
 */
export function SwapSheet({
  currentId,
  equipment,
  excludeIds,
  translations,
  canSwapToday,
  busy,
  error,
  onSwap,
  onClose,
}: {
  currentId: string
  equipment: string[]
  excludeIds: string[]
  translations: Record<string, ExerciseTranslation>
  /** Falso si ya hay series marcadas: cambiarlo hoy falsearía el historial. */
  canSwapToday: boolean
  busy: boolean
  /** Lo que salió mal al guardar el cambio, si salió algo mal. */
  error?: string | null
  onSwap: (exercise: Exercise, scope: SwapScope) => void
  onClose: () => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [chosen, setChosen] = useState<Exercise | null>(null)
  const [extra, setExtra] = useState<Record<string, ExerciseTranslation>>({})

  const current = getExercise(currentId)
  const options = useMemo(
    () => (current ? alternativesFor({ current, equipment, excludeIds, limit: 14 }) : []),
    [current, equipment, excludeIds],
  )

  useEffect(() => {
    dialogRef.current?.showModal()
  }, [])

  // Las alternativas no son las de hoy, así que sus traducciones no venían
  // cargadas. Se leen de la caché compartida, que ya suele tenerlas; no se
  // llama a la IA por catorce ejercicios que quizá no elija.
  useEffect(() => {
    const ids = options.map((e) => e.id)
    if (ids.length === 0) return
    let vivo = true

    void getTranslations(ids).then((cacheadas) => {
      if (!vivo) return
      setExtra(cacheadas)

      // Y se piden las que falten, para que la próxima vez estén. El endpoint
      // salta las ya cacheadas, así que si están todas no gasta ninguna
      // llamada a la IA. La caché es compartida: converge rápido.
      const faltan = ids.filter((id) => !cacheadas[id])
      if (faltan.length === 0) return

      void translateExercises(faltan).then(() => {
        if (!vivo) return
        void getTranslations(ids).then((t) => vivo && setExtra(t))
      })
    })

    return () => {
      vivo = false
    }
  }, [options])

  if (!current) return null

  const nameOf = (e: Exercise) => translations[e.id]?.name ?? extra[e.id]?.name ?? e.name

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={(e) => e.target === dialogRef.current && onClose()}
      className={cn(
        'm-0 mt-auto max-h-[88dvh] w-dvw max-w-none bg-transparent p-0 backdrop:bg-black/60',
        // El color se declara aquí a propósito: en la top layer el navegador
        // aplica `color: CanvasText` (negro) y los hijos lo heredan, dejando
        // texto negro sobre fondo oscuro.
        'text-[var(--fg)]',
      )}
    >
      <div className="flex max-h-[88dvh] flex-col rounded-t-2xl border-t border-[var(--line)] bg-[var(--bg)]">
        <header className="flex shrink-0 items-start justify-between gap-3 px-4 pt-4 pb-2">
          <div className="min-w-0">
            <p className="eyebrow">Cambiar ejercicio</p>
            <h2 className="display text-lg leading-tight">{nameOf(current)}</h2>
            <p className="text-xs text-[var(--fg-muted)]">
              Trabajan {current.primaryMuscles.map(muscleEs).join(' y ').toLowerCase()}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="-mt-1 grid size-12 shrink-0 place-items-center rounded-xl active:bg-[var(--surface-2)]"
          >
            <X className="size-5" aria-hidden />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4">
          {options.length === 0 ? (
            <p className="py-10 text-center text-sm text-[var(--fg-muted)]">
              No hay otra forma de trabajar este músculo con el equipo que declaraste. Añade más
              equipamiento en tu perfil y vuelve a intentarlo.
            </p>
          ) : (
            <ul className="flex flex-col gap-2 pb-2">
              {options.map((e) => {
                const selected = chosen?.id === e.id
                return (
                  <li key={e.id}>
                    <button
                      type="button"
                      onClick={() => setChosen(selected ? null : e)}
                      aria-pressed={selected}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-xl border p-2.5 text-left transition-colors',
                        selected
                          ? 'border-volt bg-volt/10'
                          : 'border-[var(--line)] bg-[var(--surface)]',
                      )}
                    >
                      <ExerciseImage
                        images={e.images}
                        alt={nameOf(e)}
                        expandable={false}
                        className="size-14 shrink-0"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-bold leading-tight">{nameOf(e)}</span>
                        <span className="block text-xs text-[var(--fg-muted)]">
                          {equipmentEs(e.equipment)} · {e.primaryMuscles.map(muscleEs).join(', ')}
                        </span>
                      </span>
                      <MuscleMap
                        primary={e.primaryMuscles}
                        secondary={e.secondaryMuscles}
                        className="h-14 w-9 shrink-0"
                      />
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {chosen && (
          <footer className="flex shrink-0 flex-col gap-2 border-t border-[var(--line)] p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <p className="text-sm">
              Cambiar por <strong>{nameOf(chosen)}</strong>
            </p>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="lg"
                full
                disabled={busy || !canSwapToday}
                onClick={() => onSwap(chosen, 'hoy')}
              >
                Solo hoy
              </Button>
              <Button
                variant="volt"
                size="lg"
                full
                disabled={busy}
                onClick={() => onSwap(chosen, 'bloque')}
              >
                {busy ? <Spinner /> : 'Todo el bloque'}
              </Button>
            </div>

            {error ? (
              <p role="alert" className="text-xs font-semibold text-red-600 dark:text-red-400">
                {error}
              </p>
            ) : (
              <p className="text-xs text-[var(--fg-muted)]">
                {canSwapToday
                  ? '«Solo hoy» sirve si la máquina está ocupada. «Todo el bloque», si tu gimnasio no la tiene.'
                  : 'Ya registraste series de este ejercicio hoy, así que el cambio empieza la próxima semana.'}
              </p>
            )}
          </footer>
        )}
      </div>
    </dialog>
  )
}
