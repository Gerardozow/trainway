import { describe, it, expect } from 'vitest'
import { validateUsername } from './profile-repository'

describe('validateUsername', () => {
  it('acepta un username válido', () => {
    expect(validateUsername('gerardo_99')).toBeNull()
  })

  it('rechaza menos de 3 caracteres', () => {
    expect(validateUsername('ab')).toMatch(/3/)
  })

  it('rechaza más de 20 caracteres', () => {
    expect(validateUsername('a'.repeat(21))).toMatch(/20/)
  })

  it('rechaza mayúsculas', () => {
    expect(validateUsername('Gerardo')).not.toBeNull()
  })

  it('rechaza espacios y símbolos', () => {
    expect(validateUsername('ger ardo')).not.toBeNull()
    expect(validateUsername('gerardo!')).not.toBeNull()
  })

  it('rechaza el valor vacío', () => {
    expect(validateUsername('')).not.toBeNull()
  })
})
