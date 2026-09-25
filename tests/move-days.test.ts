import { describe, it, expect, vi, beforeEach } from 'vitest'

type Call = { table: string; patch: unknown; filters: [string, unknown][] }
const calls: Call[] = []
let failOn: number | null = null

// Un cliente mínimo que apunta cada UPDATE con sus filtros, en orden.
vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    from: (table: string) => ({
      update: (patch: unknown) => {
        const call: Call = { table, patch, filters: [] }
        const chain = {
          eq: (col: string, val: unknown) => {
            call.filters.push([col, val])
            return chain
          },
          select: async () => {
            calls.push(call)
            if (failOn === calls.length) return { data: null, error: new Error('red caída') }
            return { data: [], error: null }
          },
        }
        return chain
      },
    }),
  },
}))

const { moveProgramDays } = await import('@/lib/supabase/queries')

describe('moveProgramDays', () => {
  beforeEach(() => {
    calls.length = 0
    failOn = null
  })

  it('mueve cada día en todas las semanas del bloque con un UPDATE', async () => {
    await moveProgramDays('p1', [1, 2, 4, 5], [1, 3, 4, 5])
    expect(calls).toEqual([
      {
        table: 'program_days',
        patch: { day_index: 3 },
        filters: [
          ['program_id', 'p1'],
          ['day_index', 2],
        ],
      },
    ])
  })

  it('en un desplazamiento en cadena mueve primero lo que va a un día libre', async () => {
    await moveProgramDays('p1', [1, 2], [2, 3])
    expect(calls.map((c) => [c.filters[1]![1], (c.patch as { day_index: number }).day_index])).toEqual([
      [2, 3],
      [1, 2],
    ])
  })

  it('sin cambios no toca la base de datos', async () => {
    await moveProgramDays('p1', [1, 3], [1, 3])
    expect(calls).toHaveLength(0)
  })

  it('si un UPDATE falla, se detiene y lanza el error', async () => {
    failOn = 1
    await expect(moveProgramDays('p1', [1, 2], [2, 3])).rejects.toThrow('red caída')
    expect(calls).toHaveLength(1)
  })
})
