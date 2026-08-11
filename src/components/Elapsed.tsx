import { useEffect, useState } from 'react'

/**
 * Cuánto llevas entrenando.
 *
 * Va en su propio componente a propósito: si el minutero viviera en la pantalla
 * de sesión, cada tic volvería a renderizar las ocho tarjetas de ejercicios.
 * Aquí solo se repinta este texto.
 *
 * En minutos, no en segundos. El dato útil es "llevo 50 minutos, voy largo",
 * no el cronómetro exacto — y un número que cambia cada segundo en la cabecera
 * roba atención a la serie que toca.
 */
export function Elapsed({ startedAt }: { startedAt: string }) {
  const start = new Date(startedAt).getTime()
  const [minutes, setMinutes] = useState(() => elapsedMinutes(start))

  useEffect(() => {
    setMinutes(elapsedMinutes(start))
    const id = setInterval(() => setMinutes(elapsedMinutes(start)), 15_000)
    return () => clearInterval(id)
  }, [start])

  if (!Number.isFinite(start) || minutes < 1) return null

  return (
    <span className="num text-xs text-[var(--fg-muted)]">
      {minutes} min
    </span>
  )
}

function elapsedMinutes(start: number): number {
  return Math.max(0, Math.floor((Date.now() - start) / 60_000))
}
