import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SetLogger } from './SetLogger'
import type { WorkoutSet } from './workout-types'

function set(reps: number, weight: number): WorkoutSet {
  return {
    id: `${reps}-${weight}`,
    workoutId: 'w1',
    exerciseId: 'squat',
    setIndex: 0,
    reps,
    weight,
    rpe: null,
    isWarmup: false,
    completedAt: '2026-08-01T10:00:00Z',
  }
}

describe('SetLogger', () => {
  const onLog = vi.fn()

  beforeEach(() => {
    onLog.mockReset().mockResolvedValue(undefined)
  })

  function renderLogger(lastSets: WorkoutSet[] | null = null) {
    return render(
      <SetLogger exerciseName="Sentadilla" lastSets={lastSets} onLog={onLog} />,
    )
  }

  it('registra peso y repeticiones', async () => {
    const user = userEvent.setup()
    renderLogger()

    await user.type(screen.getByLabelText(/peso/i), '60')
    await user.type(screen.getByLabelText(/repeticiones/i), '8')
    await user.click(screen.getByRole('button', { name: /registrar/i }))

    expect(onLog).toHaveBeenCalledWith({ weight: 60, reps: 8 })
  })

  it('acepta peso con decimales', async () => {
    const user = userEvent.setup()
    renderLogger()

    await user.type(screen.getByLabelText(/peso/i), '62.5')
    await user.type(screen.getByLabelText(/repeticiones/i), '6')
    await user.click(screen.getByRole('button', { name: /registrar/i }))

    expect(onLog).toHaveBeenCalledWith({ weight: 62.5, reps: 6 })
  })

  it('acepta peso corporal como cero', async () => {
    const user = userEvent.setup()
    renderLogger()

    await user.type(screen.getByLabelText(/peso/i), '0')
    await user.type(screen.getByLabelText(/repeticiones/i), '12')
    await user.click(screen.getByRole('button', { name: /registrar/i }))

    expect(onLog).toHaveBeenCalledWith({ weight: 0, reps: 12 })
  })

  it('avisa si falta el peso', async () => {
    const user = userEvent.setup()
    renderLogger()

    await user.type(screen.getByLabelText(/repeticiones/i), '8')
    await user.click(screen.getByRole('button', { name: /registrar/i }))

    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(onLog).not.toHaveBeenCalled()
  })

  it('avisa si faltan las repeticiones', async () => {
    const user = userEvent.setup()
    renderLogger()

    await user.type(screen.getByLabelText(/peso/i), '60')
    await user.click(screen.getByRole('button', { name: /registrar/i }))

    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(onLog).not.toHaveBeenCalled()
  })

  it('rechaza repeticiones con decimales', async () => {
    const user = userEvent.setup()
    renderLogger()

    await user.type(screen.getByLabelText(/peso/i), '60')
    await user.type(screen.getByLabelText(/repeticiones/i), '8.5')
    await user.click(screen.getByRole('button', { name: /registrar/i }))

    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(onLog).not.toHaveBeenCalled()
  })

  it('limpia las repeticiones tras registrar pero conserva el peso', async () => {
    const user = userEvent.setup()
    renderLogger()

    await user.type(screen.getByLabelText(/peso/i), '60')
    await user.type(screen.getByLabelText(/repeticiones/i), '8')
    await user.click(screen.getByRole('button', { name: /registrar/i }))

    // Normalmente repites el mismo peso varias series seguidas.
    expect(screen.getByLabelText(/peso/i)).toHaveValue('60')
    expect(screen.getByLabelText(/repeticiones/i)).toHaveValue('')
  })

  it('borra el aviso al registrar bien', async () => {
    const user = userEvent.setup()
    renderLogger()

    await user.click(screen.getByRole('button', { name: /registrar/i }))
    expect(await screen.findByRole('alert')).toBeInTheDocument()

    await user.type(screen.getByLabelText(/peso/i), '60')
    await user.type(screen.getByLabelText(/repeticiones/i), '8')
    await user.click(screen.getByRole('button', { name: /registrar/i }))

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('muestra lo que se levantó la última vez', () => {
    renderLogger([set(8, 60), set(6, 65)])
    expect(screen.getByText(/60 kg × 8/)).toBeInTheDocument()
    expect(screen.getByText(/65 kg × 6/)).toBeInTheDocument()
  })

  it('avisa cuando es la primera vez con ese ejercicio', () => {
    renderLogger(null)
    expect(screen.getByText(/primera vez/i)).toBeInTheDocument()
  })

  it('muestra el nombre del ejercicio', () => {
    renderLogger()
    expect(screen.getByRole('heading', { name: 'Sentadilla' })).toBeInTheDocument()
  })

  it('no deja registrar dos veces con un doble toque', async () => {
    let resolve: () => void = () => {}
    onLog.mockReturnValue(new Promise<void>((r) => (resolve = r)))

    const user = userEvent.setup()
    renderLogger()

    await user.type(screen.getByLabelText(/peso/i), '60')
    await user.type(screen.getByLabelText(/repeticiones/i), '8')

    const button = screen.getByRole('button', { name: /registrar/i })
    await user.click(button)
    expect(button).toBeDisabled()

    resolve()
  })
})
