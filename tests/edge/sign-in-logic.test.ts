// Pruebas de la lógica pura de supabase/functions/sign-in/index.ts. Vive en
// tests/edge (no en tests/unit) porque documenta el comportamiento de la
// Edge Function, pero no necesita el stack levantado ni la función servida:
// logic.ts no importa nada de Deno, así que corre igual bajo Vitest/Node.
import { describe, it, expect } from 'vitest'
import {
  isServiceError,
  requireEnv,
  resolveMinFailureMs,
  usingDefaultOrigins,
} from '../../supabase/functions/sign-in/logic.ts'

describe('isServiceError', () => {
  it('trata un 5xx de GoTrue como falla del servicio', () => {
    expect(isServiceError({ status: 500 })).toBe(true)
    expect(isServiceError({ status: 503 })).toBe(true)
  })

  // El límite sign_in_sign_ups es por IP de salida de la función, no por
  // identificador: cuando se agota, TODO inicio de sesión legítimo lo
  // recibe, sin importar qué username o correo se haya pedido. Colapsarlo a
  // INVALID le miente a cada uno de ellos sobre por qué falló.
  it('trata un 429 como falla del servicio, no como veredicto de credenciales', () => {
    expect(isServiceError({ status: 429 })).toBe(true)
  })

  it('no trata un 400 (contraseña mala) como falla del servicio', () => {
    expect(isServiceError({ status: 400 })).toBe(false)
  })

  it('no trata la ausencia de status como falla del servicio', () => {
    expect(isServiceError({})).toBe(false)
  })
})

describe('requireEnv', () => {
  it('devuelve el valor cuando está presente', () => {
    expect(requireEnv('SUPABASE_URL', 'http://127.0.0.1:54321')).toBe(
      'http://127.0.0.1:54321',
    )
  })

  it('lanza cuando el valor es undefined', () => {
    expect(() => requireEnv('SUPABASE_SERVICE_ROLE_KEY', undefined)).toThrow(
      /SUPABASE_SERVICE_ROLE_KEY/,
    )
  })

  it('lanza cuando el valor es una cadena vacía', () => {
    expect(() => requireEnv('SUPABASE_ANON_KEY', '')).toThrow(/SUPABASE_ANON_KEY/)
  })
})

describe('resolveMinFailureMs', () => {
  it('usa el default cuando la variable no está definida', () => {
    expect(resolveMinFailureMs(undefined, 250)).toBe(250)
  })

  it('usa el default cuando la variable está vacía', () => {
    expect(resolveMinFailureMs('', 250)).toBe(250)
  })

  it('usa el valor de la variable cuando es un número válido', () => {
    expect(resolveMinFailureMs('400', 250)).toBe(400)
  })

  it('cae al default cuando la variable no es un número', () => {
    expect(resolveMinFailureMs('no-es-un-numero', 250)).toBe(250)
  })

  it('cae al default cuando la variable es negativa', () => {
    expect(resolveMinFailureMs('-10', 250)).toBe(250)
  })
})

describe('usingDefaultOrigins', () => {
  it('es true cuando la variable no está definida', () => {
    expect(usingDefaultOrigins(undefined)).toBe(true)
  })

  it('es true cuando la variable está vacía', () => {
    expect(usingDefaultOrigins('')).toBe(true)
  })

  it('es false cuando hay al menos un origen configurado', () => {
    expect(usingDefaultOrigins('https://trainway.app')).toBe(false)
  })
})
