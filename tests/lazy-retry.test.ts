import { describe, it, expect, beforeEach, vi } from 'vitest'
import { isChunkLoadError, reloadOnce } from '@/lib/lazyWithRetry'

// jsdom no navega, y su aviso ensucia la salida de todas las pruebas.
Object.defineProperty(window, 'location', {
  value: { ...window.location, reload: vi.fn() },
  writable: true,
})

describe('isChunkLoadError', () => {
  it('reconoce el fallo de import dinámico de Chrome', () => {
    expect(
      isChunkLoadError(
        new Error(
          'Failed to fetch dynamically imported module: https://gzow.dev/trainway/assets/Progress-abc.js',
        ),
      ),
    ).toBe(true)
  })

  it('reconoce el de Safari', () => {
    expect(isChunkLoadError(new Error('Importing a module script failed.'))).toBe(true)
  })

  it('reconoce el de Firefox', () => {
    expect(isChunkLoadError(new Error('error loading dynamically imported module'))).toBe(true)
  })

  it('un error de programa no se disfraza de despliegue', () => {
    expect(isChunkLoadError(new TypeError('x.map is not a function'))).toBe(false)
  })
})

describe('reloadOnce', () => {
  beforeEach(() => sessionStorage.clear())

  it('a la segunda ya no recarga: sin bucles', () => {
    const t = 1_000_000
    // jsdom no navega de verdad, así que lo que se comprueba es el candado.
    expect(reloadOnce(t)).toBe(true)
    expect(reloadOnce(t + 5_000)).toBe(false)
  })

  it('pasado el minuto vuelve a permitirlo', () => {
    const t = 1_000_000
    expect(reloadOnce(t)).toBe(true)
    expect(reloadOnce(t + 61_000)).toBe(true)
  })
})
