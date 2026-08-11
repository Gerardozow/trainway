/**
 * Prueba de humo contra producción.
 *
 * Recorre lo que hace una persona de verdad: entrar, contestar el cuestionario,
 * recibir un plan generado por MiniMax y abrir el entrenamiento del día. Crea
 * un usuario ya confirmado con la service_role y lo borra al final, pase lo que
 * pase.
 *
 * Gasta una llamada real a MiniMax. No es para CI, es para verificar un
 * despliegue.
 *
 *   node scripts/smoke-prod.mjs [url]
 */
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { chromium, devices } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

const BASE = process.argv[2] ?? 'https://gzow.dev/trainway'
const OUT = process.env.SMOKE_OUT ?? '.'

const env = {}
for (const line of readFileSync('.env', 'utf8').split('\n')) {
  const t = line.trim()
  if (!t || t.startsWith('#')) continue
  const i = t.indexOf('=')
  env[t.slice(0, i).trim()] = t.slice(i + 1).trim()
}

const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const stamp = Date.now()
const email = `smoke-${stamp}@trainway.test`
const password = `prueba-humo-${stamp}`
let userId = null
let browser = null
const pasos = []

const paso = (nombre, ok, detalle = '') => {
  pasos.push({ nombre, ok, detalle })
  console.log(`  ${ok ? '✓' : '✗'} ${nombre}${detalle ? `  ${detalle}` : ''}`)
}

try {
  console.log(`\nProbando ${BASE}\n`)

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (error) throw error
  userId = data.user.id
  paso('usuario de prueba creado', true, email)

  browser = await chromium.launch()
  const ctx = await browser.newContext({ ...devices['Pixel 7'], locale: 'es-MX' })
  const page = await ctx.newPage()

  const errores = []
  page.on('pageerror', (e) => errores.push(e.message))
  page.on('console', (m) => m.type() === 'error' && errores.push(m.text()))
  const fallos = []
  page.on('response', (r) => r.status() >= 400 && fallos.push(`${r.status()} ${r.url()}`))
  page.on('request', (r) => r.url().includes('/api/') && console.log(`    -> ${r.method()} ${r.url().split('/api/')[1]}`))
  page.on('response', async (r) => {
    if (!r.url().includes('/api/')) return
    const ruta = r.url().split('/api/')[1]
    if (r.status() >= 400) {
      const cuerpo = await r.text().catch(() => '')
      console.log(`    <- ${r.status()} ${ruta}  ${cuerpo.slice(0, 220)}`)
    } else {
      console.log(`    <- ${r.status()} ${ruta}`)
    }
  })

  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  paso('la app carga', (await page.title()) === 'Trainway')

  // La PWA solo se puede comprobar contra el sitio desplegado: el service
  // worker instalaba en localhost y fallaba en producción porque el router de
  // assets redirigía /index.html fuera del subpath. Silencioso y total.
  await page.waitForTimeout(6000)
  const sw = await page.evaluate(async () => {
    const regs = await navigator.serviceWorker.getRegistrations()
    return { n: regs.length, estado: regs[0]?.active?.state ?? null }
  })
  paso('el service worker se instala', sw.n === 1 && sw.estado === 'activated', `${sw.n} registro, estado ${sw.estado}`)

  const sinRedirigir = await page.evaluate(async (base) => {
    const r = await fetch(`${base}/index.html`, { redirect: 'manual' })
    return r.status
  }, BASE)
  paso('index.html se sirve sin redirigir', sinRedirigir === 200, `HTTP ${sinRedirigir}`)

  const fuente = await page.evaluate(() => document.fonts.check('700 28px Archivo'))
  paso('la tipografía de marca carga', fuente)

  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Contraseña').fill(password)
  await page.getByRole('button', { name: 'Entrar' }).click()

  await page.waitForURL(/\/trainway\/?(empezar)?$/, { timeout: 20_000 })
  paso('inicio de sesión', true)

  // Wizard: objetivo, días, minutos, experiencia, equipo, y enviar.
  await page.getByRole('button', { name: /Ganar músculo/ }).click()
  await page.getByRole('button', { name: 'Siguiente' }).click()
  await page.getByRole('button', { name: '3', exact: true }).click()
  await page.getByRole('button', { name: 'Siguiente' }).click()
  await page.getByRole('button', { name: /60\s*min/ }).click()
  await page.getByRole('button', { name: 'Siguiente' }).click()
  await page.getByRole('button', { name: /Intermedio/ }).click()
  await page.getByRole('button', { name: 'Siguiente' }).click()
  await page.getByRole('button', { name: 'Barra', exact: true }).click()
  await page.getByRole('button', { name: 'Mancuernas', exact: true }).click()
  await page.getByRole('button', { name: 'Máquina', exact: true }).click()
  await page.getByRole('button', { name: 'Siguiente' }).click()
  paso('cuestionario completado', true)

  await page.getByRole('button', { name: 'Crear mi plan' }).click()
  await page.waitForURL(/\/trainway\/?$/, { timeout: 180_000 })
  paso('MiniMax generó el plan', true)

  await page.waitForTimeout(2500)
  await page.screenshot({ path: `${OUT}/prod-hoy.png`, fullPage: true })

  const { data: programas } = await admin
    .from('programs')
    .select('name, block_number, ai_model')
    .eq('user_id', userId)
  paso('el plan quedó guardado', (programas?.length ?? 0) > 0, programas?.[0]?.name ?? '')

  const { count: dias } = await admin
    .from('program_days')
    .select('*', { count: 'exact', head: true })
    .eq('program_id', (await admin.from('programs').select('id').eq('user_id', userId).single()).data.id)
  paso('mesociclo de 4 semanas', dias > 0, `${dias} días`)

  const { count: traducciones } = await admin
    .from('exercise_translations')
    .select('*', { count: 'exact', head: true })
  paso('traducciones al español cacheadas', traducciones > 0, `${traducciones} ejercicios`)

  // Entrar al entrenamiento del día, si hoy toca.
  const empezar = page.getByRole('link', { name: /entrenamiento/i })
  if ((await empezar.count()) > 0) {
    await empezar.click()
    await page.waitForURL(/\/sesion\//, { timeout: 20_000 })
    await page.waitForTimeout(2500)
    await page.screenshot({ path: `${OUT}/prod-sesion.png`, fullPage: true })

    const checks = page.getByRole('button', { name: /^Marcar serie/ })
    const n = await checks.count()
    paso('la sesión abre con sus series', n > 0, `${n} series`)

    if (n > 0) {
      await checks.first().click()
      await page.waitForTimeout(1200)
      const marcada = await page.getByRole('button', { name: /^Desmarcar serie 1/ }).count()
      paso('marcar una serie funciona', marcada > 0)

      await page.waitForTimeout(7000)
      const { count: series } = await admin
        .from('set_logs')
        .select('*', { count: 'exact', head: true })
      paso('la serie se sincronizó a la base', series > 0, `${series} registro(s)`)

      // El descanso arrancó al marcar: tiene que poder ajustarse.
      const masTreinta = await page
        .getByRole('button', { name: /Añadir 30 segundos/ })
        .count()
      paso('el descanso se puede alargar', masTreinta > 0)

      const posponer = await page.getByRole('button', { name: /Dejarlo para el final/ }).count()
      paso('un ejercicio se puede posponer', posponer > 0)

      // El editor de peso. Los discos solo salen si el ejercicio va a barra,
      // así que se informa de lo que haya en vez de exigirlo.
      await page.getByRole('button', { name: 'Editar peso' }).first().click()
      await page.waitForTimeout(400)
      const editor = await page.getByRole('button', { name: 'Subir peso' }).count()
      const discos = await page.getByText('Por lado').count()
      paso('el editor de peso abre', editor > 0, discos > 0 ? 'con discos por lado' : 'sin barra')

      // --- "La vez pasada" ---------------------------------------------------
      //
      // La cuenta es nueva y no tiene historial, así que se le siembra una
      // sesión de ayer por la puerta de atrás. Es la única forma de comprobar
      // en producción lo que solo se ve con historial detrás.
      const dayId = page.url().split('/sesion/')[1]
      const { data: prescritos, error: errorPrescritos } = await admin
        .from('program_exercises')
        .select('id')
        .eq('program_day_id', dayId)
        .order('position')
        .limit(1)

      // Fecha LOCAL, como la calcula la app. En UTC-6, `toISOString` a última
      // hora del día devuelve el día siguiente y "ayer" acababa siendo hoy:
      // la sesión chocaba con la que la app ya había creado.
      const ayer = new Date(Date.now() - 86_400_000)
      const ayerISO = `${ayer.getFullYear()}-${String(ayer.getMonth() + 1).padStart(2, '0')}-${String(ayer.getDate()).padStart(2, '0')}`

      const { data: sesionAyer, error: errorSesion } = await admin
        .from('workout_sessions')
        .insert({ user_id: userId, program_day_id: dayId, performed_on: ayerISO })
        .select()
        .single()

      if (!prescritos?.[0] || !sesionAyer) {
        paso(
          'sembrar historial de ayer',
          false,
          `día ${dayId} · ${errorPrescritos?.message ?? ''} ${errorSesion?.message ?? ''}`.trim(),
        )
      }

      if (prescritos?.[0] && sesionAyer) {
        await admin.from('set_logs').insert(
          [0, 1, 2].map((i) => ({
            session_id: sesionAyer.id,
            program_exercise_id: prescritos[0].id,
            set_index: i,
            done: true,
            weight: 50,
            reps: 10 - i,
            client_id: randomUUID(),
            logged_at: `${ayerISO}T18:00:00.000Z`,
          })),
        )

        await page.reload({ waitUntil: 'networkidle' })
        await page.waitForTimeout(2500)
        const vezPasada = await page.getByText(/La vez pasada/).count()
        const cifras = await page.getByText('50 kg × 10 · 9 · 8').count()
        paso('la sesión anterior se muestra', vezPasada > 0 && cifras > 0, `${vezPasada} referencia(s)`)
        await page.screenshot({ path: `${OUT}/prod-sesion-historial.png`, fullPage: true })
      }
    }
  } else {
    paso('hoy toca descanso, sesión no probada', true)
  }

  // --- Pantallas nuevas -----------------------------------------------------
  await page.goto(`${BASE}/preferencias`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)
  const preferencias = await page.getByRole('heading', { name: 'Tu entrenamiento' }).count()
  const equipoMarcado = await page.getByRole('button', { name: 'Barra', pressed: true }).count()
  paso('las preferencias se abren con lo respondido', preferencias > 0 && equipoMarcado > 0)
  await page.screenshot({ path: `${OUT}/prod-preferencias.png`, fullPage: true })

  await page.goto(`${BASE}/progreso`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(2000)
  const racha = await page.getByText('Racha').count()
  paso('progreso muestra la racha', racha > 0)
  await page.screenshot({ path: `${OUT}/prod-progreso.png`, fullPage: true })

  await page.goto(`${BASE}/perfil`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1200)
  const instalar = await page.getByText(/Instalar la app/).count()
  const avisos = await page.getByRole('button', { name: /Sonido/ }).count()
  paso('perfil ofrece instalar y ajustar los avisos', instalar > 0 && avisos > 0)
  await page.screenshot({ path: `${OUT}/prod-perfil.png`, fullPage: true })

  const ignorables = /favicon|manifest|sw\.js|\.map$/
  const relevantes = fallos.filter((f) => !ignorables.test(f))
  paso('sin peticiones fallidas', relevantes.length === 0, relevantes.slice(0, 3).join(' | '))
  paso('sin errores de JavaScript', errores.length === 0, errores.slice(0, 2).join(' | '))
} catch (err) {
  paso('EXCEPCIÓN', false, err?.message?.split('\n')[0]?.slice(0, 160) ?? String(err))
  try {
    const page = browser?.contexts()[0]?.pages()[0]
    if (page) {
      await page.screenshot({ path: `${OUT}/prod-fallo.png`, fullPage: true })
      console.log(`\n  url: ${page.url()}`)
      const alerta = await page.getByRole('alert').allTextContents().catch(() => [])
      if (alerta.length) console.log(`  alerta en pantalla: ${alerta.join(' | ')}`)
      const texto = (await page.locator('body').innerText().catch(() => '')).replace(/\n+/g, ' | ')
      console.log(`  pantalla: ${texto.slice(0, 300)}`)
    }
  } catch {}
} finally {
  await browser?.close().catch(() => {})
  if (userId) {
    await admin.auth.admin.deleteUser(userId).catch(() => {})
    console.log(`\n  usuario de prueba borrado`)
  }
}

const fallidos = pasos.filter((p) => !p.ok)
console.log(fallidos.length === 0 ? '\nTodo correcto.\n' : `\n${fallidos.length} fallo(s).\n`)
process.exit(fallidos.length === 0 ? 0 : 1)
