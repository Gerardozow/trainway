import type { ReactNode } from 'react'
import { Eyebrow } from '../../shared/ui'

/**
 * Marco de las pantallas de entrada.
 *
 * El resplandor de fondo viene del prototipo: dos gradientes radiales muy
 * tenues en los acentos de categoría. Dan profundidad sin dibujar nada, que es
 * lo que separa una pantalla de acceso cuidada de un formulario centrado.
 */
export function AuthLayout({
  eyebrow,
  title,
  lead,
  children,
  footer,
}: {
  eyebrow: string
  title: ReactNode
  lead?: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <main className="relative flex min-h-full flex-col justify-center overflow-hidden px-5 py-12">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(600px 300px at 15% 0%, var(--color-strength-soft), transparent 70%), radial-gradient(500px 300px at 100% 30%, var(--color-cardio-soft), transparent 70%)',
        }}
      />

      <div className="relative mx-auto w-full max-w-sm">
        <div className="mb-8">
          <span className="mb-4 inline-flex items-center gap-2.5">
            <span className="h-2 w-2 rounded-full bg-cardio shadow-[0_0_0_5px_var(--color-cardio-soft)]" />
            <Eyebrow>{eyebrow}</Eyebrow>
          </span>
          <h1 className="text-4xl font-extrabold text-content">{title}</h1>
          {lead && <p className="mt-3 text-content-muted">{lead}</p>}
        </div>

        {children}

        {footer && <div className="mt-6 text-center text-sm">{footer}</div>}
      </div>
    </main>
  )
}
