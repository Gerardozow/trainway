import { useEffect, useRef } from 'react'
import { createBodyHighlighter, type BodyHighlighterInstance } from 'body-highlighter'
import { bestView, toBodyMuscles } from '@/lib/catalog'
import { useTheme } from '@/lib/theme'
import { cn } from '@/lib/utils'

/**
 * Silueta con los músculos trabajados resaltados.
 *
 * `body-highlighter` es imperativo: crea sus propios nodos dentro de un
 * contenedor. Se envuelve aquí para que React solo tenga que preocuparse del
 * div, y se destruye al desmontar.
 *
 * El color de resalte es el amarillo de marca: sobre la silueta gris tiene
 * contraste de sobra y no hace falta un paso más oscuro como en las gráficas.
 */
export function MuscleMap({
  primary,
  secondary = [],
  view,
  className,
}: {
  primary: string[]
  secondary?: string[]
  view?: 'anterior' | 'posterior'
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const instance = useRef<BodyHighlighterInstance | null>(null)
  const { resolved } = useTheme()

  useEffect(() => {
    const container = ref.current
    if (!container) return

    const principales = toBodyMuscles(primary)
    const secundarios = toBodyMuscles(secondary).filter((m) => !principales.includes(m))

    // `frequency` controla qué tono del degradado usa: 2 para los músculos
    // principales, 1 para los secundarios.
    const data = [
      ...(secundarios.length ? [{ name: 'secundarios', muscles: secundarios, frequency: 1 }] : []),
      ...(principales.length ? [{ name: 'principales', muscles: principales, frequency: 2 }] : []),
    ]

    const opciones = {
      container,
      data,
      type: view ?? bestView(primary),
      // La silueta tiene que verse contra el fondo, no fundirse con él.
      bodyColor: resolved === 'dark' ? '#4A4A50' : '#D4D4D4',
      highlightedColors: ['#8A6300', '#FFC603'],
      svgStyle: { width: '100%', height: '100%' },
    }

    if (instance.current) {
      instance.current.update(opciones)
    } else {
      instance.current = createBodyHighlighter(opciones)
    }

    return () => {
      instance.current?.destroy()
      instance.current = null
    }
  }, [primary, secondary, view, resolved])

  return (
    <div
      ref={ref}
      role="img"
      aria-label={`Músculos trabajados: ${primary.join(', ')}`}
      className={cn('grid place-items-center [&_svg]:max-h-full [&_svg]:w-auto', className)}
    />
  )
}
