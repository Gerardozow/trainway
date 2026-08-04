import '@testing-library/jest-dom/vitest'

// Este setup se ejecuta para todos los archivos de prueba, incluidos los que
// fijan `environment: 'node'` (como tests/rls/*), donde `window` no existe.
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList
}
