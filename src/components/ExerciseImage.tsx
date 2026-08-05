import { useEffect, useState } from 'react'
import { imageUrl } from '@/lib/catalog'
import { cn } from '@/lib/utils'

/**
 * Las dos imágenes del catálogo son la posición inicial y la final. Alternarlas
 * cada segundo produce una demo de la técnica sin necesitar vídeo, con los
 * datos que ya tenemos.
 */
export function ExerciseImage({
  images,
  alt,
  className,
}: {
  images: [string, string]
  alt: string
  className?: string
}) {
  const [frame, setFrame] = useState(0)

  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const id = setInterval(() => setFrame((f) => (f === 0 ? 1 : 0)), 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <div
      className={cn(
        'relative shrink-0 overflow-hidden rounded-xl bg-[var(--surface-2)]',
        className,
      )}
    >
      {images.map((src, i) => (
        <img
          key={src}
          src={imageUrl(src)}
          alt={i === 0 ? alt : ''}
          aria-hidden={i !== 0}
          loading="lazy"
          decoding="async"
          className={cn(
            'absolute inset-0 size-full object-cover transition-opacity duration-200',
            i === frame ? 'opacity-100' : 'opacity-0',
          )}
        />
      ))}
    </div>
  )
}
