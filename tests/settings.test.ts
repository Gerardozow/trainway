import { describe, it, expect, beforeEach } from 'vitest'
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from '@/lib/settings'

describe('preferencias del dispositivo', () => {
  beforeEach(() => localStorage.clear())

  it('de fábrica avisa por sonido y vibración', () => {
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS)
  })

  it('recuerda lo elegido', () => {
    saveSettings({ sound: false, vibrate: true })
    expect(loadSettings()).toEqual({ sound: false, vibrate: true })
  })

  it('rellena lo que falte con los valores de fábrica', () => {
    localStorage.setItem('trainway.settings', '{"sound":false}')
    expect(loadSettings()).toEqual({ sound: false, vibrate: true })
  })

  it('con basura vuelve a los valores de fábrica', () => {
    localStorage.setItem('trainway.settings', 'esto no es json')
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS)
  })
})
