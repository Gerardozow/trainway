import '@testing-library/jest-dom/vitest'

// Las pruebas de integración corren en entorno node y aquí no hay `window`.
if (typeof window === 'undefined') {
  // nada que preparar
} else if (!window.matchMedia) {
  // jsdom no implementa matchMedia y el proveedor de tema lo usa para 'system'.
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
}
