import { describe, it, expect, beforeEach } from 'vitest'
import {
  DEFAULT_SETTINGS,
  REST_MAX,
  REST_MIN,
  loadSettings,
  restFor,
  saveSettings,
} from '@/lib/settings'

describe('preferencias del dispositivo', () => {
  beforeEach(() => localStorage.clear())

  it('de fábrica avisa por sonido y vibración, y respeta el descanso del plan', () => {
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS)
    expect(DEFAULT_SETTINGS.restSeconds).toBeNull()
  })

  it('recuerda lo elegido', () => {
    saveSettings({ sound: false, vibrate: true, restSeconds: 60 })
    expect(loadSettings()).toEqual({ sound: false, vibrate: true, restSeconds: 60 })
  })

  it('rellena lo que falte con los valores de fábrica', () => {
    localStorage.setItem('trainway.settings', '{"sound":false}')
    expect(loadSettings()).toEqual({ sound: false, vibrate: true, restSeconds: null })
  })

  it('con basura vuelve a los valores de fábrica', () => {
    localStorage.setItem('trainway.settings', 'esto no es json')
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS)
  })

  it('un descanso fuera de rango se recorta, no se cree', () => {
    localStorage.setItem('trainway.settings', '{"restSeconds":9000}')
    expect(loadSettings().restSeconds).toBe(REST_MAX)

    localStorage.setItem('trainway.settings', '{"restSeconds":1}')
    expect(loadSettings().restSeconds).toBe(REST_MIN)
  })

  it('un descanso que no es número se ignora', () => {
    localStorage.setItem('trainway.settings', '{"restSeconds":"mucho"}')
    expect(loadSettings().restSeconds).toBeNull()
  })
})

describe('restFor', () => {
  it('sin descanso fijo manda el del ejercicio', () => {
    expect(restFor(180, { ...DEFAULT_SETTINGS, restSeconds: null })).toBe(180)
  })

  it('con descanso fijo se pisa el del ejercicio', () => {
    // Una sentadilla pesada pide 180 s; quien entrena a reloj puede no tenerlos.
    expect(restFor(180, { ...DEFAULT_SETTINGS, restSeconds: 60 })).toBe(60)
  })

  it('el descanso fijo también sube los cortos', () => {
    expect(restFor(45, { ...DEFAULT_SETTINGS, restSeconds: 120 })).toBe(120)
  })
})
