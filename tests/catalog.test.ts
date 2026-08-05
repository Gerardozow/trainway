import { describe, it, expect } from 'vitest'
import exercises from '../data/exercises.json'

type Raw = { id: string; name: string; images: string[] }
const all = exercises as Raw[]

describe('catálogo', () => {
  it('trae 873 ejercicios', () => {
    expect(all).toHaveLength(873)
  })

  it('todos tienen id, nombre y exactamente 2 imágenes', () => {
    for (const e of all) {
      expect(e.id).toBeTruthy()
      expect(e.name).toBeTruthy()
      expect(e.images).toHaveLength(2)
    }
  })

  it('los ids son únicos', () => {
    const ids = all.map((e) => e.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
