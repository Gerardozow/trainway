// Lógica pura de la Edge Function sign-in, deliberadamente sin importar
// nada de Deno. index.ts la usa en el runtime real (Deno.serve);
// tests/edge/sign-in-logic.test.ts la prueba directamente bajo Vitest/Node,
// sin necesitar el stack de Supabase levantado ni la función servida.

export function requireEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Falta la variable de entorno requerida: ${name}`)
  }
  return value
}

// Un error de GoTrue con estado 5xx es una falla del servicio, no de la
// cuenta: ocurre igual sin importar qué identificador se haya pedido, así
// que reportarlo aparte (503/UNAVAILABLE) no delata nada.
//
// Un 429 es igual de identificador-independiente y por eso también cuenta
// como falla del servicio: el límite `sign_in_sign_ups` (config.toml) es por
// IP de salida de la función, no por identificador, así que cuando el cupo
// se agota TODO inicio de sesión legítimo lo recibe. Antes este código lo
// colapsaba a INVALID con el argumento de que revelarlo delataría la cuenta
// -- ese argumento es correcto para un 400 (contraseña mala), pero un límite
// compartido por IP no distingue cuentas: decirle a cada uno de esos
// usuarios "tu contraseña está mal" en vez de "inténtalo en un momento" es
// mentirles sobre la causa real, sin ganar nada a cambio en no-oráculo.
//
// status: 0 también cuenta, por la misma razón: verificado contra
// @supabase/auth-js@2.112.0, un fallo de fetch al hablar con GoTrue (red
// caída, DNS, timeout) no lanza -- vuelve como AuthRetryableFetchError con
// status: 0, como valor normal de `error`, no como excepción. Es tan
// identificador-independiente como un 5xx: la función simplemente no pudo
// alcanzar a GoTrue, sin importar qué credencial se le haya pedido.
//
// Cualquier otro código (400 contraseña mala, cuenta no confirmada, cuenta
// suspendida, etc.) sigue colapsando a INVALID: revelar cuál de esas razones
// aplica sí delataría que la cuenta existe.
export function isServiceError(error: { status?: number }): boolean {
  return (
    typeof error.status === 'number' &&
    (error.status >= 500 || error.status === 429 || error.status === 0)
  )
}

// El piso de tiempo por defecto es 250ms (calibrado en local, ver index.ts),
// pero ese número puede no bastar en producción si la RPC + GoTrue tardan
// más ahí que en local. MIN_FAILURE_MS permite subirlo sin tocar código; si
// la variable falta, está vacía (o es solo espacios), o no es un número
// finito y estrictamente positivo, se usa el default que llama quien invoca
// esta función.
//
// Estrictamente positivo, no >= 0: `0` es un número finito y no negativo,
// así que un `MIN_FAILURE_MS=0` puesto por error pasaría un chequeo `>= 0`
// sin ningún aviso, apagando en silencio la única defensa de tiempo del
// camino de sign-in. Un secreto que desactiva un control de seguridad al
// tomar un valor que parece razonable es peor que uno que simplemente no
// parsea. trim() antes de convertir cierra la misma puerta por la otra vía:
// una variable de solo espacios no es "vacía" para `!raw` (tiene longitud
// > 0), pero Number('   ') es 0 igual.
export function resolveMinFailureMs(raw: string | undefined, fallback: number): number {
  const trimmed = raw?.trim()
  if (!trimmed) return fallback
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

// true cuando ALLOWED_ORIGINS no está configurado (undefined o cadena
// vacía): la función va a servir los orígenes de desarrollo por defecto, que
// en un despliegue real bloquean por CORS a la PWA de verdad.
export function usingDefaultOrigins(raw: string | undefined): boolean {
  return !raw || raw.length === 0
}
