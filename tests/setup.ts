import '@testing-library/jest-dom/vitest'

// Las pruebas de integración corren en entorno node y aquí no hay `window`.
if (typeof window === 'undefined') {
  // nada que preparar
} else if (!window.matchMedia) {
  // jsdom no implementa matchMedia y el proveedor de tema lo usa para 'system'.
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
}

// jsdom trae <dialog> pero no la top layer, así que showModal/close no existen.
// Sin esto no se puede probar nada que se abra en modal: la foto en grande, la
// hoja de cambiar ejercicio. El doble solo mueve el atributo `open`, que es lo
// único que mira el componente.
if (typeof window !== 'undefined' && !HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.open = true
  }
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.open = false
    this.dispatchEvent(new Event('close'))
  }
}
