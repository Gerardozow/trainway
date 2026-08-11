/**
 * El aviso de fin de descanso.
 *
 * Se sintetiza con WebAudio en vez de cargar un mp3: son dos tonos, pesa cero
 * bytes y no hay nada más que cachear para que funcione sin conexión.
 *
 * El navegador solo deja sonar tras un gesto del usuario. Aquí siempre lo hay
 * —el descanso arranca al marcar una serie—, pero el contexto puede quedarse
 * suspendido si la pestaña estuvo en segundo plano, así que se reanuda antes
 * de cada aviso.
 */

let context: AudioContext | null = null

function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null

  const Ctor =
    window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null

  context ??= new Ctor()
  return context
}

function tone(ctx: AudioContext, at: number, frequency: number, seconds: number): void {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()

  osc.type = 'sine'
  osc.frequency.value = frequency

  // Rampa en vez de encendido y apagado seco: un corte brusco chasquea.
  gain.gain.setValueAtTime(0, at)
  gain.gain.linearRampToValueAtTime(0.25, at + 0.01)
  gain.gain.linearRampToValueAtTime(0, at + seconds)

  osc.connect(gain).connect(ctx.destination)
  osc.start(at)
  osc.stop(at + seconds)
}

/** Dos pitidos cortos: se oye por encima del gimnasio sin ser una alarma. */
export function playRestDone(): void {
  try {
    const ctx = getContext()
    if (!ctx) return

    void ctx.resume?.()

    const now = ctx.currentTime
    tone(ctx, now, 880, 0.12)
    tone(ctx, now + 0.18, 1174, 0.16)
  } catch {
    // Sin audio disponible el temporizador sigue siendo válido: la vibración y
    // la pantalla ya avisan.
  }
}
