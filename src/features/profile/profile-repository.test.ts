import { describe, it, expect, vi, beforeEach } from 'vitest'

const select = vi.fn()
const eq = vi.fn(() => ({ select }))
const update = vi.fn(() => ({ eq }))
const from = vi.fn((..._args: unknown[]) => ({ update }))
const rpc = vi.fn()

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => from(...args),
    rpc: (...args: unknown[]) => rpc(...args),
  },
}))

const { validateUsername, setUsername, isUsernameAvailable } = await import(
  './profile-repository'
)

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

  // SignupPage no recortaba antes de validar, así que un espacio al final
  // producía "Solo minúsculas, números y guion bajo" -- un mensaje confuso
  // para un error que no se ve. UsernameOnboarding sí recortaba antes de
  // llamar. Recortar dentro de validateUsername hace que ambos (y cualquier
  // otro llamador futuro) vean el mismo veredicto sin depender de que cada
  // pantalla recuerde hacerlo por su cuenta.
  it('ignora espacios al inicio y al final al validar', () => {
    expect(validateUsername(' gerardo_99 ')).toBeNull()
  })
})

describe('setUsername', () => {
  beforeEach(() => {
    from.mockClear()
    update.mockClear()
    eq.mockClear()
    select.mockReset()
  })

  it('no llama a Supabase cuando el username es inválido', async () => {
    const result = await setUsername('user-1', 'ab')
    expect(result.error).not.toBeNull()
    expect(from).not.toHaveBeenCalled()
  })

  it('guarda el username cuando Supabase actualiza una fila', async () => {
    select.mockResolvedValue({ data: [{ id: 'user-1' }], error: null })
    const result = await setUsername('user-1', 'gerardo_99')
    expect(result.error).toBeNull()
    expect(from).toHaveBeenCalledWith('profiles')
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ username: 'gerardo_99' }),
    )
    expect(select).toHaveBeenCalledWith('id')
  })

  it('traduce la violación de unicidad (23505) a un mensaje legible', async () => {
    select.mockResolvedValue({ data: null, error: { code: '23505', message: 'duplicate key' } })
    const result = await setUsername('user-1', 'gerardo_99')
    expect(result.error).toBe('Ese username ya está tomado')
  })

  it('devuelve un mensaje genérico ante cualquier otro error', async () => {
    select.mockResolvedValue({
      data: null,
      error: { code: '42501', message: 'permission denied' },
    })
    const result = await setUsername('user-1', 'gerardo_99')
    expect(result.error).toBe('No se pudo guardar el username')
  })

  it('reporta error cuando la fila no existe y no se actualiza nada', async () => {
    select.mockResolvedValue({ data: [], error: null })
    const result = await setUsername('user-1', 'gerardo_99')
    expect(result.error).not.toBeNull()
  })

  // Sin este recorte, un espacio al final pasa la validación (que sí
  // recorta) pero llega crudo a la fila -- y el CHECK de la base
  // (username_format, ^[a-z0-9_]{3,20}$) lo rechazaría con un error genérico
  // en vez de guardar lo que la persona quiso escribir.
  it('recorta espacios antes de guardar', async () => {
    select.mockResolvedValue({ data: [{ id: 'user-1' }], error: null })
    const result = await setUsername('user-1', ' gerardo_99 ')
    expect(result.error).toBeNull()
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ username: 'gerardo_99' }),
    )
  })
})

describe('isUsernameAvailable', () => {
  beforeEach(() => {
    rpc.mockReset()
  })

  it('devuelve true cuando el RPC reporta el username libre', async () => {
    rpc.mockResolvedValue({ data: true, error: null })
    const result = await isUsernameAvailable('gerardo_99')
    expect(result).toBe(true)
    expect(rpc).toHaveBeenCalledWith('username_available', { p_username: 'gerardo_99' })
  })

  it('devuelve false cuando el RPC reporta el username tomado', async () => {
    rpc.mockResolvedValue({ data: false, error: null })
    const result = await isUsernameAvailable('gerardo_99')
    expect(result).toBe(false)
  })

  // Fallar cerrado (tratar un RPC caído como "tomado") bloquearía el alta
  // por completo mientras dure el problema. null deja la decisión a quien
  // llama en vez de fingir un veredicto que no se tiene.
  it('devuelve null ante un error del RPC en vez de fallar cerrado', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'boom' } })
    const result = await isUsernameAvailable('gerardo_99')
    expect(result).toBeNull()
  })
})
