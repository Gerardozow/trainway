import { describe, it, expect } from 'vitest'
import { looksLikeSpaFallback } from '../worker/index'

const HTML = 'text/html; charset=utf-8'
const JS = 'text/javascript'

describe('looksLikeSpaFallback', () => {
  it('un chunk que llega como HTML es el fallback mintiendo', () => {
    expect(looksLikeSpaFallback('/assets/Progress-BiTFxQjg.js', HTML)).toBe(true)
  })

  it('una hoja de estilos también', () => {
    expect(looksLikeSpaFallback('/assets/index-abc.css', HTML)).toBe(true)
  })

  it('una ruta de la app SÍ debe recibir el index', () => {
    expect(looksLikeSpaFallback('/progreso', HTML)).toBe(false)
    expect(looksLikeSpaFallback('/sesion/8f2a-4b', HTML)).toBe(false)
    expect(looksLikeSpaFallback('/', HTML)).toBe(false)
  })

  it('el propio index.html no es sospechoso', () => {
    expect(looksLikeSpaFallback('/index.html', HTML)).toBe(false)
  })

  it('un archivo servido con su tipo correcto no se toca', () => {
    expect(looksLikeSpaFallback('/assets/Progress-BiTFxQjg.js', JS)).toBe(false)
    expect(looksLikeSpaFallback('/sw.js', JS)).toBe(false)
  })

  it('sin cabecera de tipo no se inventa nada', () => {
    expect(looksLikeSpaFallback('/assets/algo.js', null)).toBe(false)
  })

  it('un punto en un segmento anterior no convierte la ruta en archivo', () => {
    expect(looksLikeSpaFallback('/v1.2/progreso', HTML)).toBe(false)
  })
})
