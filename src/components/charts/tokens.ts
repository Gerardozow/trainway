import { useTheme } from '@/lib/theme'

/**
 * Colores de gráfica, validados con la herramienta de la skill dataviz.
 *
 * El #FFC603 de la marca NO sirve como marca de datos: sobre blanco da 1.53:1
 * de contraste y desaparece. Estos son pasos más oscuros del mismo tono, que
 * pasan las seis comprobaciones (banda de luminosidad, croma, contraste ≥3:1).
 *
 *   claro  #9A7000 sobre #FFFFFF
 *   oscuro #B88C00 sobre #0B0B0C
 *
 * Queda además una jerarquía útil: amarillo puro = elemento interactivo,
 * oro = dato.
 */
export function useChartTokens() {
  const { resolved } = useTheme()
  const dark = resolved === 'dark'

  return {
    /** Serie única. Todas las gráficas de Trainway tienen una sola. */
    series: dark ? '#B88C00' : '#9A7000',
    grid: dark ? '#2A2A2E' : '#E4E4E4',
    axis: dark ? '#9A9A9A' : '#6C6C6C',
    surface: dark ? '#161618' : '#FFFFFF',
    ink: dark ? '#FAFAFA' : '#14140F',
  }
}
