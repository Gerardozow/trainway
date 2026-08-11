import { cn } from '@/lib/utils'

/**
 * El wordmark en texto, no en imagen: escala sin pixelarse, respeta el tema y
 * pesa cero bytes. Archivo pesado y expandido reproduce la voz del logo original
 * (brand/logo.png), que se reserva para el icono y el material de marca.
 */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn('display inline-flex items-center text-[1.75rem] leading-none', className)}
      style={{ fontStretch: '115%', letterSpacing: '-0.03em' }}
    >
      {/* El nombre va una sola vez para quien escucha. Partido en dos trozos de
          color, un lector de pantalla leería "TRAIN" y "WAY" por separado, y
          dentro de un <h1> con su propio texto alternativo sonaba
          "TRAINWAY Trainway". Se oculta el dibujo y se nombra aparte. */}
      <span aria-hidden className="text-[var(--fg)]">TRAIN</span>
      <span aria-hidden className="text-volt-ink">WAY</span>
      <span className="sr-only">Trainway</span>
    </span>
  )
}

/** El lema del logo, para cabeceras y estados vacíos. */
export function Tagline({ className }: { className?: string }) {
  return (
    <p className={cn('eyebrow', className)}>Train · Perform · Achieve · Repeat</p>
  )
}
