import { Component, type ErrorInfo, type ReactNode } from 'react'
import { isChunkLoadError } from '@/lib/lazyWithRetry'
import { Button } from '@/components/ui'
import { Wordmark } from '@/components/Wordmark'

type Props = { children: ReactNode }
type State = { error: Error | null }

/**
 * La red de seguridad.
 *
 * Sin esto, cualquier excepción al renderizar deja la pantalla en blanco: sin
 * mensaje, sin salida y sin pista de qué pasó. Esta app se usa con el móvil en
 * una mano y una barra en la otra; una pantalla en blanco a mitad de la serie
 * es el peor fallo posible. Aquí al menos hay una salida y el error queda a la
 * vista para poder contarlo.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Trainway se rompió al renderizar:', error, info.componentStack)
  }

  render(): ReactNode {
    const { error } = this.state
    if (!error) return this.props.children

    // Un chunk que no carga casi nunca es un fallo del programa: o se publicó
    // una versión nueva mientras la app estaba abierta, o se cayó la red. Decir
    // "algo se rompió" ahí asusta de más y no explica qué hacer.
    const stale = isChunkLoadError(error)

    return (
      <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-5 px-6 text-center">
        <Wordmark className="mx-auto h-6 opacity-40" />

        <div className="flex flex-col gap-2">
          <h1 className="display text-2xl">{stale ? 'Hay una versión nueva' : 'Algo se rompió'}</h1>
          <p className="text-[var(--fg-muted)]">
            {stale
              ? 'No pudimos cargar una parte de la app. Recarga y sigue donde estabas.'
              : 'Tus series registradas están a salvo: se guardan en el móvil y se suben solas. Recarga para seguir.'}
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <Button variant="volt" size="lg" full onClick={() => window.location.reload()}>
            Recargar
          </Button>
          <Button
            variant="ghost"
            onClick={() => window.location.assign(import.meta.env.BASE_URL)}
          >
            Volver a Hoy
          </Button>
        </div>

        <details className="text-left text-xs text-[var(--fg-muted)]">
          <summary className="cursor-pointer py-2">Detalles técnicos</summary>
          <pre className="overflow-x-auto rounded-lg bg-[var(--surface-2)] p-3">
            {error.message}
          </pre>
        </details>
      </main>
    )
  }
}
