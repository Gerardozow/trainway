import { describe, it, expect, beforeEach } from 'vitest'
import prePaintHtml from '../../../index.html?raw'
import { readThemePreference, resolveTheme } from './theme-storage'

// Ejecuta el mismo script (byte a byte) que index.html inyecta antes del
// primer pintado, para garantizar que su decisión de aplicar la clase
// "dark" siempre coincide con resolveTheme(readThemePreference(), prefersDark).
// Así una sola regla de decisión (theme-storage.ts) queda como fuente de
// verdad; este test no reimplementa la lógica, la ejecuta.
function extractPrePaintScript(html: string): string {
  const match = html.match(/<script>([\s\S]*?)<\/script>/)
  if (!match) {
    throw new Error('No se encontró el script de pre-pintado en index.html')
  }
  return match[1]
}

const prePaintScript = extractPrePaintScript(prePaintHtml)

function withMatchMedia<T>(matches: boolean, run: () => T): T {
  const original = window.matchMedia
  window.matchMedia = ((query: string) =>
    ({
      matches,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList) as typeof window.matchMedia
  try {
    return run()
  } finally {
    window.matchMedia = original
  }
}

describe('script de pre-pintado (index.html)', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.classList.remove('dark')
  })

  const storedValues: Array<string | null> = ['dark', 'light', 'system', null, 'banana']

  for (const stored of storedValues) {
    for (const prefersDark of [true, false]) {
      it(`stored=${stored ?? 'ausente'}, prefersDark=${prefersDark} coincide con resolveTheme(readThemePreference(), prefersDark)`, () => {
        if (stored !== null) localStorage.setItem('trainway:theme', stored)

        withMatchMedia(prefersDark, () => {
          // eslint-disable-next-line no-new-func -- ejecuta el script real de index.html, no una copia
          new Function(prePaintScript)()
        })

        const expectedDark = resolveTheme(readThemePreference(), prefersDark) === 'dark'
        expect(document.documentElement.classList.contains('dark')).toBe(expectedDark)
      })
    }
  }
})
