import { describe, it, expect, beforeEach } from 'vitest'
import { loadRest, saveRest } from '@/lib/rest'

describe('descanso persistido', () => {
  beforeEach(() => localStorage.clear())

  it('sin nada guardado no hay descanso', () => expect(loadRest()).toBeNull())

  it('recupera lo guardado', () => {
    const now = 1_000_000
    saveRest({ seconds: 90, startedAt: now })
    expect(loadRest(now + 5_000)).toEqual({ seconds: 90, startedAt: now })
  })

  it('descarta un descanso viejo y limpia el rastro', () => {
    const now = 1_000_000
    saveRest({ seconds: 90, startedAt: now })
    expect(loadRest(now + 20 * 60 * 1000)).toBeNull()
    expect(localStorage.getItem('trainway.rest')).toBeNull()
  })

  it('null borra', () => {
    saveRest({ seconds: 90, startedAt: Date.now() })
    saveRest(null)
    expect(loadRest()).toBeNull()
  })

  it('con basura en el almacenamiento no revienta', () => {
    localStorage.setItem('trainway.rest', 'no soy json')
    expect(loadRest()).toBeNull()

    localStorage.setItem('trainway.rest', '{"seconds":"noventa"}')
    expect(loadRest()).toBeNull()
  })
})
