import { describe, it, expect } from 'vitest'
import { formatWeight } from './formatWeight'

describe('formatWeight', () => {
  it('omite decimales en pesos enteros', () => {
    expect(formatWeight(60)).toBe('60 kg')
  })

  it('conserva un decimal cuando lo hay', () => {
    expect(formatWeight(62.5)).toBe('62.5 kg')
  })

  it('redondea a un decimal', () => {
    expect(formatWeight(62.55)).toBe('62.6 kg')
  })

  it('representa el peso corporal como cero', () => {
    expect(formatWeight(0)).toBe('0 kg')
  })
})
