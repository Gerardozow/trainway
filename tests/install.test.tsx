import { describe, it, expect, beforeEach, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { InstallBanner, InstallCard } from '@/components/InstallCard'

/** El evento que dispara Chrome cuando la app es instalable. */
function fireInstallable(outcome: 'accepted' | 'dismissed' = 'accepted') {
  const prompt = vi.fn().mockResolvedValue(undefined)
  const event = Object.assign(new Event('beforeinstallprompt'), {
    prompt,
    userChoice: Promise.resolve({ outcome }),
  })

  act(() => {
    window.dispatchEvent(event)
  })

  return prompt
}

describe('instalación de la PWA', () => {
  beforeEach(() => localStorage.clear())

  it('sin evento del navegador y fuera de iOS, el aviso no aparece', () => {
    render(<InstallBanner />)
    expect(screen.queryByRole('button', { name: /instalar/i })).not.toBeInTheDocument()
  })

  it('cuando el navegador la ofrece, aparece el botón', () => {
    render(<InstallBanner />)
    fireInstallable()
    expect(screen.getByRole('button', { name: /instalar/i })).toBeInTheDocument()
  })

  it('el botón lanza el diálogo nativo', async () => {
    const user = userEvent.setup()
    render(<InstallBanner />)
    const prompt = fireInstallable()

    await user.click(screen.getByRole('button', { name: /instalar/i }))

    expect(prompt).toHaveBeenCalledOnce()
  })

  it('descartarlo lo esconde y no vuelve tras recargar', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<InstallBanner />)
    fireInstallable()

    await user.click(screen.getByRole('button', { name: /ocultar el aviso/i }))
    expect(screen.queryByRole('button', { name: /instalar/i })).not.toBeInTheDocument()

    unmount()
    render(<InstallBanner />)
    fireInstallable()
    expect(screen.queryByRole('button', { name: /instalar/i })).not.toBeInTheDocument()
  })

  it('una vez instalada, el aviso desaparece', () => {
    render(<InstallBanner />)
    fireInstallable()

    act(() => {
      window.dispatchEvent(new Event('appinstalled'))
    })

    expect(screen.queryByRole('button', { name: /instalar/i })).not.toBeInTheDocument()
  })

  it('en Perfil siempre hay algo que leer, aunque no haya diálogo', () => {
    render(<InstallCard />)
    expect(screen.getByText(/Instalar la app/i)).toBeInTheDocument()
    expect(screen.getByText(/menú del navegador/i)).toBeInTheDocument()
  })

  it('en Perfil, ya instalada, lo dice y calla', () => {
    render(<InstallCard />)

    act(() => {
      window.dispatchEvent(new Event('appinstalled'))
    })

    expect(screen.getByText(/Instalada/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /instalar trainway/i })).not.toBeInTheDocument()
  })
})
