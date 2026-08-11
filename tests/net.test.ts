import { describe, it, expect, vi } from 'vitest'
import { delay, raceWithFallback } from '@/lib/net'

describe('raceWithFallback', () => {
  it('con red rápida devuelve lo fresco y ni toca la caché', async () => {
    const fallback = vi.fn(async () => 'guardado')

    const out = await raceWithFallback({
      network: Promise.resolve('fresco'),
      fallback,
      timeoutMs: 50,
    })

    expect(out).toBe('fresco')
    expect(fallback).not.toHaveBeenCalled()
  })

  it('con red lenta no hace esperar: entra lo guardado', async () => {
    const out = await raceWithFallback({
      network: delay(500, 'fresco'),
      fallback: async () => 'guardado',
      timeoutMs: 20,
    })

    expect(out).toBe('guardado')
  })

  it('si la red falla, tira de lo guardado', async () => {
    const out = await raceWithFallback({
      network: Promise.reject(new Error('sin red')),
      fallback: async () => 'guardado',
      timeoutMs: 50,
    })

    expect(out).toBe('guardado')
  })

  it('sin nada guardado, el error de la red sí llega', async () => {
    await expect(
      raceWithFallback({
        network: Promise.reject(new Error('sin red')),
        fallback: async () => null,
        timeoutMs: 20,
      }),
    ).rejects.toThrow('sin red')
  })

  it('sin nada guardado espera a la red lenta en vez de rendirse', async () => {
    const out = await raceWithFallback({
      network: delay(60, 'fresco'),
      fallback: async () => null,
      timeoutMs: 10,
    })

    expect(out).toBe('fresco')
  })

  it('los errores marcados se propagan sin mirar la caché', async () => {
    class NoExiste extends Error {}
    const fallback = vi.fn(async () => 'guardado')

    await expect(
      raceWithFallback({
        network: Promise.reject(new NoExiste('ese día no existe')),
        fallback,
        timeoutMs: 50,
        rethrow: (err) => err instanceof NoExiste,
      }),
    ).rejects.toThrow('ese día no existe')

    expect(fallback).not.toHaveBeenCalled()
  })
})
