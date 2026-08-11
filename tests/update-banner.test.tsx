import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { UpdateBanner, AppUpdatePrompt } from '@/components/UpdateBanner'

/**
 * El aviso de versión nueva.
 *
 * Antes la app estaba en 'autoUpdate': el service worker nuevo se activaba solo
 * y la pestaña abierta se quedaba pidiendo archivos que ya no existían. Ahora se
 * pregunta, y hay dos cosas que no pueden fallar: que el aviso no aparezca a
 * mitad de entrenamiento, y que "ahora no" no vuelva a insistir.
 */

const estado = { ready: false, applying: false }
const apply = vi.fn()
const dismiss = vi.fn()

vi.mock('@/lib/useAppUpdate', () => ({
  useAppUpdate: () => ({ ...estado, apply, dismiss }),
}))

describe('UpdateBanner', () => {
  it('actualizar es una decisión del usuario, no un salto de la app', async () => {
    const user = userEvent.setup()
    const onApply = vi.fn()
    render(<UpdateBanner applying={false} onApply={onApply} onDismiss={vi.fn()} />)

    expect(screen.getByText('Hay una versión nueva.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Actualizar' }))
    expect(onApply).toHaveBeenCalledTimes(1)
  })

  it('se puede posponer', async () => {
    const user = userEvent.setup()
    const onDismiss = vi.fn()
    render(<UpdateBanner applying={false} onApply={vi.fn()} onDismiss={onDismiss} />)

    await user.click(screen.getByRole('button', { name: 'Ahora no' }))
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('mientras se aplica no se puede pulsar dos veces', () => {
    render(<UpdateBanner applying onApply={vi.fn()} onDismiss={vi.fn()} />)
    expect(screen.queryByRole('button', { name: 'Actualizar' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cargando' })).toBeDisabled()
  })
})

describe('AppUpdatePrompt', () => {
  it('sin versión nueva no ocupa sitio', () => {
    estado.ready = false
    render(<AppUpdatePrompt enabled />)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('con versión nueva avisa', () => {
    estado.ready = true
    render(<AppUpdatePrompt enabled />)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('en la sesión no interrumpe: la recarga puede esperar a Hoy', () => {
    estado.ready = true
    render(<AppUpdatePrompt enabled={false} />)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
