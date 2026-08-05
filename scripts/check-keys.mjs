/**
 * Comprueba que las claves de .env sean las correctas, sin imprimirlas.
 *
 * Un JWT lleva su payload en claro (base64), así que se puede leer qué rol
 * declara sin descifrar nada. Es la forma fiable de saber si copiaste la anon
 * o la service_role: no hay que adivinarlo mirando la cadena.
 *
 *   node scripts/check-keys.mjs
 */
import { readFileSync } from 'node:fs'

const env = {}
for (const line of readFileSync('.env', 'utf8').split('\n')) {
  const t = line.trim()
  if (!t || t.startsWith('#')) continue
  const i = t.indexOf('=')
  env[t.slice(0, i).trim()] = t.slice(i + 1).trim()
}

function role(token = '') {
  if (token.startsWith('sb_publishable_')) return 'publishable (formato nuevo)'
  if (token.startsWith('sb_secret_')) return 'secret (formato nuevo)'
  try {
    const payload = token.split('.')[1]
    return JSON.parse(Buffer.from(payload, 'base64url').toString()).role ?? '¿sin rol?'
  } catch {
    return 'no es un JWT válido'
  }
}

const checks = [
  {
    name: 'VITE_SUPABASE_URL',
    ok: (v) => /^https:\/\/[a-z0-9]+\.supabase\.co$/.test(v),
    esperado: 'https://<proyecto>.supabase.co',
    actual: (v) => (v ? `${v.slice(0, 16)}…` : '(vacío)'),
  },
  {
    name: 'VITE_SUPABASE_ANON_KEY',
    ok: (v) => role(v) === 'anon' || role(v).startsWith('publishable'),
    esperado: 'rol anon',
    actual: (v) => `rol ${role(v)}`,
  },
  {
    name: 'SUPABASE_SERVICE_ROLE_KEY',
    ok: (v) => role(v) === 'service_role' || role(v).startsWith('secret'),
    esperado: 'rol service_role',
    actual: (v) => `rol ${role(v)}`,
  },
  {
    name: 'MINIMAX_API_KEY',
    ok: (v) => v?.length > 40,
    esperado: 'cadena larga',
    actual: (v) => (v ? `${v.length} caracteres` : '(vacío)'),
  },
]

let fallos = 0
console.log()
for (const c of checks) {
  const v = env[c.name] ?? ''
  const bien = Boolean(v) && c.ok(v)
  if (!bien) fallos++
  console.log(`  ${bien ? '✓' : '✗'} ${c.name.padEnd(26)} ${c.actual(v)}${bien ? '' : `   (se esperaba: ${c.esperado})`}`)
}

if (env.VITE_SUPABASE_ANON_KEY && env.VITE_SUPABASE_ANON_KEY === env.SUPABASE_SERVICE_ROLE_KEY) {
  fallos++
  console.log('\n  ✗ La anon key y la service_role son la MISMA cadena. Son claves distintas:')
  console.log('    Supabase -> Project Settings -> API Keys -> pestaña "Legacy API Keys"')
  console.log('    La de abajo (service_role, marcada como secret). Hay que pulsar "Reveal".')
}

console.log(fallos === 0 ? '\n  Todo correcto.\n' : `\n  ${fallos} problema(s).\n`)
process.exit(fallos === 0 ? 0 : 1)
