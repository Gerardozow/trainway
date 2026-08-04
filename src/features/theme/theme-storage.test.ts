import { describe, it, expect, beforeEach } from 'vitest'
import {
  readThemePreference,
  writeThemePreference,
  resolveTheme,
} from './theme-storage'

describe('theme-storage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('usa "system" cuando no hay preferencia guardada', () => {
    expect(readThemePreference()).toBe('system')
  })

  it('lee la preferencia que se escribió', () => {
    writeThemePreference('dark')
    expect(readThemePreference()).toBe('dark')
  })

  it('ignora un valor corrupto en el almacenamiento', () => {
    localStorage.setItem('trainway:theme', 'banana')
    expect(readThemePreference()).toBe('system')
  })

  it('resuelve "system" según la preferencia del sistema operativo', () => {
    expect(resolveTheme('system', true)).toBe('dark')
    expect(resolveTheme('system', false)).toBe('light')
  })

  it('la elección explícita gana sobre el sistema', () => {
    expect(resolveTheme('light', true)).toBe('light')
    expect(resolveTheme('dark', false)).toBe('dark')
  })
})
