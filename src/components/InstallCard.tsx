import { useState } from 'react'
import { Check, Download, Share, SquarePlus, X } from 'lucide-react'
import { useInstallPrompt } from '@/lib/useInstallPrompt'
import { Button } from '@/components/ui'

const HIDDEN_KEY = 'trainway.install-hidden'

function isHidden(): boolean {
  try {
    return localStorage.getItem(HIDDEN_KEY) === '1'
  } catch {
    return false
  }
}

function hide(): void {
  try {
    localStorage.setItem(HIDDEN_KEY, '1')
  } catch {
    // Da igual: como mucho el aviso vuelve a salir.
  }
}

/** Compartir → Añadir a pantalla de inicio. El único camino que hay en iPhone. */
function IOSSteps() {
  return (
    <ol className="flex flex-col gap-1.5 text-sm text-[var(--fg-muted)]">
      <li className="flex items-center gap-2">
        <Share className="size-4 shrink-0" aria-hidden />
        Toca Compartir, abajo en Safari
      </li>
      <li className="flex items-center gap-2">
        <SquarePlus className="size-4 shrink-0" aria-hidden />
        Elige «Añadir a pantalla de inicio»
      </li>
    </ol>
  )
}

/**
 * Instalar la app, en Perfil.
 *
 * Aquí sí se muestra siempre: es el sitio donde uno va a buscarlo. El aviso de
 * la pantalla de Hoy es otro componente y se puede descartar.
 */
export function InstallCard() {
  const { installed, canPrompt, isIOS, promptInstall } = useInstallPrompt()

  if (installed) {
    return (
      <section className="flex flex-col gap-2">
        <h2 className="eyebrow">La app</h2>
        <p className="flex items-center gap-2 text-sm text-[var(--fg-muted)]">
          <Check className="size-4 text-volt-ink" aria-hidden />
          Instalada. Funciona sin conexión.
        </p>
      </section>
    )
  }

  return (
    <section className="flex flex-col gap-2">
      <h2 className="eyebrow">Instalar la app</h2>
      <p className="text-sm text-[var(--fg-muted)]">
        En la pantalla de inicio abre a pantalla completa y entrena sin conexión.
      </p>

      {canPrompt ? (
        <Button variant="outline" size="lg" full onClick={() => void promptInstall()}>
          <Download className="size-5" aria-hidden />
          Instalar Trainway
        </Button>
      ) : isIOS ? (
        <IOSSteps />
      ) : (
        <p className="text-sm text-[var(--fg-muted)]">
          Desde el menú del navegador, busca «Instalar aplicación».
        </p>
      )}
    </section>
  )
}

/**
 * El mismo ofrecimiento en la pantalla de Hoy, una vez y descartable.
 *
 * Quien no sabe que esto se puede instalar nunca entra a Perfil a comprobarlo,
 * así que hay que decírselo donde ya está; y quien no lo quiere no tiene por
 * qué verlo otra vez.
 */
export function InstallBanner() {
  const { installed, canPrompt, isIOS, promptInstall } = useInstallPrompt()
  const [dismissed, setDismissed] = useState(isHidden)

  if (installed || dismissed) return null
  if (!canPrompt && !isIOS) return null

  const dismiss = () => {
    hide()
    setDismissed(true)
  }

  return (
    <aside className="strip flex items-start gap-3 p-3">
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <p className="text-sm leading-snug">
          <strong>Ponla en tu pantalla de inicio.</strong> Abre a pantalla completa y funciona sin
          conexión en el gimnasio.
        </p>

        {canPrompt ? (
          <Button
            variant="volt"
            size="sm"
            className="self-start"
            onClick={() => void promptInstall().then(dismiss)}
          >
            <Download className="size-4" aria-hidden />
            Instalar
          </Button>
        ) : (
          <IOSSteps />
        )}
      </div>

      <button
        type="button"
        onClick={dismiss}
        aria-label="Ocultar el aviso de instalación"
        className="-m-1 grid size-11 shrink-0 place-items-center rounded-xl text-[var(--fg-muted)] active:bg-[var(--surface-2)]"
      >
        <X className="size-4" aria-hidden />
      </button>
    </aside>
  )
}
