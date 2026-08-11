import { useEffect, useRef, useState } from 'react'
import { Dumbbell, X, ZoomIn } from 'lucide-react'
import { imageUrl } from '@/lib/catalog'
import { cn } from '@/lib/utils'

/**
 * Las dos imágenes del catálogo son la posición inicial y la final.
 *
 * La miniatura muestra SOLO la inicial, fija. Alternarlas cada segundo parecía
 * buena idea sobre el papel — un mini-GIF de la técnica — pero con dos
 * fotogramas no es una animación, es un salto, y una lista de ocho ejercicios
 * saltando a la vez no deja mirar nada.
 *
 * Al tocarla se abre a pantalla completa con las dos posiciones juntas y
 * etiquetadas, que es cuando de verdad sirve compararlas.
 */
export function ExerciseImage({
  images,
  alt,
  className,
  expandable = true,
}: {
  images: [string, string]
  alt: string
  className?: string
  expandable?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [failed, setFailed] = useState(false)
  const dialogRef = useRef<HTMLDialogElement>(null)

  // <dialog> nativo: da el fondo modal, el foco atrapado y el cierre con Escape
  // sin escribir nada de eso a mano.
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  const thumb = (
    <div className={cn('relative overflow-hidden rounded-xl bg-[var(--surface-2)]', className)}>
      {failed ? (
        <Dumbbell
          className="absolute inset-0 m-auto size-1/3 text-[var(--fg-muted)]"
          strokeWidth={1.5}
          aria-hidden
        />
      ) : (
        <img
          src={imageUrl(images[0])}
          alt={alt}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className="absolute inset-0 size-full object-cover"
        />
      )}
    </div>
  )

  // Sin foto no hay nada que ampliar, y la lupa sobre un recuadro vacío promete
  // algo que al tocarlo no aparece.
  if (!expandable || failed) return thumb

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Ver ${alt} en grande`}
        className={cn('relative shrink-0 cursor-zoom-in', className)}
      >
        {thumb}
        {/* Sin esta marca la miniatura no se lee como tocable: al lado de una
            tarjeta que se despliega, una foto sin más parece decoración. */}
        <span
          aria-hidden
          className="absolute right-1 bottom-1 grid size-5 place-items-center rounded-md bg-black/55 text-white"
        >
          <ZoomIn className="size-3" strokeWidth={2.5} />
        </span>
      </button>

      <dialog
        ref={dialogRef}
        onClose={() => setOpen(false)}
        onClick={(e) => {
          // Cerrar al tocar fuera: el <dialog> ocupa toda la pantalla, así que
          // "fuera" es el propio elemento, no sus hijos.
          if (e.target === dialogRef.current) setOpen(false)
        }}
        className={cn(
          'm-0 h-dvh max-h-none w-dvw max-w-none bg-transparent p-0',
          'text-white backdrop:bg-black/60',
        )}
      >
        {/* El fondo lo pinta este div, no el <dialog>.
            El elemento modal vive en la top layer, donde el fondo no se compone
            igual en todos los navegadores; un div normal sí se pinta siempre, y
            sin él el título queda flotando sobre la página e ilegible en tema
            claro. */}
        <div className="flex h-full flex-col bg-neutral-950">
          <div className="flex shrink-0 items-start justify-between gap-3 px-4 pt-3 pb-1">
            <h2 className="display min-w-0 text-lg leading-tight text-balance">{alt}</h2>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Cerrar"
              className="-mt-1 grid size-12 shrink-0 place-items-center rounded-xl active:bg-white/10"
            >
              <X className="size-6" aria-hidden />
            </button>
          </div>

          {/* Dos imágenes altas no caben en una pantalla de móvil. */}
          <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-4 pt-1 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {images.map((src, i) => (
              <figure key={src} className="relative overflow-hidden rounded-xl bg-neutral-900">
                <img
                  src={imageUrl(src)}
                  alt={`${alt}, posición ${i === 0 ? 'inicial' : 'final'}`}
                  className="w-full object-contain"
                />
                <figcaption className="eyebrow absolute bottom-2 left-2 rounded-md bg-black/70 px-2 py-1 text-white">
                  {i === 0 ? 'Inicio' : 'Final'}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </dialog>
    </>
  )
}
