import { describe, it, expect } from 'vitest'
import { formatPerSide, KG_SET, LB_SET, plateSet, platesFor } from '@/lib/plates'

describe('platesFor', () => {
  it('la barra sola no lleva discos', () => {
    expect(platesFor(20)).toEqual({ bar: 20, perSide: [], leftover: 0 })
  })

  it('reparte 60 kg como un disco de 20 por lado', () => {
    expect(platesFor(60)?.perSide).toEqual([20])
  })

  it('resuelve los medios kilos del incremento', () => {
    // 62.5 = barra 20 + (20 + 1.25) × 2
    expect(platesFor(62.5)?.perSide).toEqual([20, 1.25])
  })

  it('usa los discos grandes primero', () => {
    expect(platesFor(100)?.perSide).toEqual([25, 15])
  })

  it('no acumula error de coma flotante', () => {
    const out = platesFor(57.5)
    expect(out?.perSide).toEqual([15, 2.5, 1.25])
    expect(out?.leftover).toBe(0)
  })

  it('informa de lo que no cuadra en vez de redondearlo a escondidas', () => {
    const out = platesFor(61)
    expect(out?.perSide).toEqual([20])
    expect(out?.leftover).toBe(1)
  })

  it('por debajo de la barra no hay nada que calcular', () => {
    expect(platesFor(15)).toBeNull()
    expect(platesFor(Number.NaN)).toBeNull()
  })

  it('en libras usa la barra y los discos de libras', () => {
    expect(platesFor(135, LB_SET)?.perSide).toEqual([45])
  })
})

describe('plateSet', () => {
  it('métrico', () => expect(plateSet('metric')).toBe(KG_SET))
  it('imperial', () => expect(plateSet('imperial')).toBe(LB_SET))
})

describe('formatPerSide', () => {
  it('lista los discos', () => expect(formatPerSide([20, 10, 2.5])).toBe('20 · 10 · 2.5'))
  it('sin discos lo dice con palabras', () => expect(formatPerSide([])).toBe('solo la barra'))
})
