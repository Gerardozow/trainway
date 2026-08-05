import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Exercise } from './exercise-types'

const loadExercises = vi.fn()

vi.mock('./exercise-cache', () => ({
  loadExercises: () => loadExercises(),
}))

vi.mock('./exercise-repository', () => ({
  exerciseImageUrl: (path: string) => `http://test/${path}`,
}))

const { ExercisesPage } = await import('./ExercisesPage')

function make(id: string, name: string, muscles: string[], images: string[] = []): Exercise {
  return {
    id,
    name,
    category: null,
    equipment: null,
    force: null,
    level: null,
    mechanic: null,
    primaryMuscles: muscles,
    secondaryMuscles: [],
    instructions: [],
    imagePaths: images,
  }
}

const CATALOG = [
  make('1', 'Sentadilla con barra', ['quadriceps'], ['Squat/0.jpg']),
  make('2', 'Press de banca', ['chest']),
  make('3', 'Curl de bíceps', ['biceps']),
]

describe('ExercisesPage', () => {
  beforeEach(() => {
    loadExercises.mockReset().mockResolvedValue(CATALOG)
  })

  it('muestra los ejercicios que carga', async () => {
    render(<ExercisesPage />)

    expect(await screen.findByText('Sentadilla con barra')).toBeInTheDocument()
    expect(screen.getByText('Press de banca')).toBeInTheDocument()
    expect(screen.getByText('Curl de bíceps')).toBeInTheDocument()
  })

  it('avisa mientras carga', () => {
    loadExercises.mockReturnValue(new Promise(() => {}))
    render(<ExercisesPage />)
    expect(screen.getByText(/cargando/i)).toBeInTheDocument()
  })

  it('filtra conforme el usuario escribe', async () => {
    const user = userEvent.setup()
    render(<ExercisesPage />)
    await screen.findByText('Sentadilla con barra')

    await user.type(screen.getByLabelText(/buscar/i), 'press')

    expect(screen.getByText('Press de banca')).toBeInTheDocument()
    expect(screen.queryByText('Sentadilla con barra')).not.toBeInTheDocument()
  })

  it('encuentra el acentuado escribiendo sin acento', async () => {
    const user = userEvent.setup()
    render(<ExercisesPage />)
    await screen.findByText('Curl de bíceps')

    await user.type(screen.getByLabelText(/buscar/i), 'biceps')

    expect(screen.getByText('Curl de bíceps')).toBeInTheDocument()
    expect(screen.queryByText('Press de banca')).not.toBeInTheDocument()
  })

  it('filtra por músculo', async () => {
    const user = userEvent.setup()
    render(<ExercisesPage />)
    await screen.findByText('Sentadilla con barra')

    await user.selectOptions(screen.getByLabelText(/músculo/i), 'chest')

    expect(screen.getByText('Press de banca')).toBeInTheDocument()
    expect(screen.queryByText('Sentadilla con barra')).not.toBeInTheDocument()
  })

  it('ofrece solo los músculos que existen en el catálogo', async () => {
    render(<ExercisesPage />)
    await screen.findByText('Sentadilla con barra')

    const options = screen
      .getAllByRole('option')
      .map((option) => (option as HTMLOptionElement).value)

    expect(options).toEqual(['', 'biceps', 'chest', 'quadriceps'])
  })

  it('avisa cuando la búsqueda no encuentra nada', async () => {
    const user = userEvent.setup()
    render(<ExercisesPage />)
    await screen.findByText('Sentadilla con barra')

    await user.type(screen.getByLabelText(/buscar/i), 'zancada')

    expect(screen.getByText(/ningún ejercicio/i)).toBeInTheDocument()
  })

  it('muestra un mensaje cuando la carga falla', async () => {
    loadExercises.mockRejectedValue(new Error('sin red'))

    render(<ExercisesPage />)

    expect(await screen.findByRole('alert')).toHaveTextContent(/no se pudo/i)
  })

  it('no muestra el buscador si la carga falló', async () => {
    loadExercises.mockRejectedValue(new Error('sin red'))

    render(<ExercisesPage />)
    await screen.findByRole('alert')

    expect(screen.queryByLabelText(/buscar/i)).not.toBeInTheDocument()
  })

  it('pinta la imagen del ejercicio cuando la tiene', async () => {
    render(<ExercisesPage />)
    await screen.findByText('Sentadilla con barra')

    const image = document.querySelector('img')
    expect(image?.getAttribute('src')).toBe('http://test/Squat/0.jpg')
    // El nombre ya está en el texto contiguo: repetirlo en el alt haría que un
    // lector de pantalla lo leyera dos veces.
    expect(image?.getAttribute('alt')).toBe('')
  })
})
