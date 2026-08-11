import { test, expect, type Page } from '@playwright/test'

/**
 * El recorrido crítico completo, contra una instancia real de Supabase.
 *
 * Sin E2E_EMAIL y E2E_PASSWORD (una cuenta de prueba con plan activo) estas
 * pruebas se saltan, para no romper CI sin infraestructura. Las que no
 * necesitan backend están en shell.spec.ts.
 */
const EMAIL = process.env.E2E_EMAIL
const PASSWORD = process.env.E2E_PASSWORD

test.skip(!EMAIL || !PASSWORD, 'Necesita E2E_EMAIL y E2E_PASSWORD')

async function entrar(page: Page) {
  await page.goto('/entrar')
  await page.getByLabel('Email').fill(EMAIL!)
  await page.getByLabel('Contraseña').fill(PASSWORD!)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await page.waitForURL('**/trainway/')
}

test('el entrenamiento del día se abre y las series se marcan', async ({ page }) => {
  await entrar(page)

  const empezar = page.getByRole('link', { name: /entrenamiento/i })
  if ((await empezar.count()) === 0) {
    test.skip(true, 'Hoy toca descanso en la cuenta de prueba')
  }
  await empezar.click()
  await page.waitForURL('**/sesion/**')

  const checks = page.getByRole('button', { name: /^Marcar serie/ })
  await expect(checks.first()).toBeVisible()

  const antes = await checks.count()
  await checks.first().click()

  // Al marcar arranca el descanso.
  await expect(page.getByRole('timer')).toBeVisible()

  // Y el contador de la cabecera avanza.
  await expect(page.getByRole('button', { name: /^Desmarcar serie 1/ })).toBeVisible()
  expect(antes).toBeGreaterThan(0)
})

test('la carga se pone una vez y baja a todas las series', async ({ page }) => {
  await entrar(page)
  const empezar = page.getByRole('link', { name: /entrenamiento/i })
  test.skip((await empezar.count()) === 0, 'Hoy toca descanso')
  await empezar.click()
  await page.waitForURL('**/sesion/**')

  const carga = page.getByRole('button', { name: 'Editar peso de todas las series' })
  test.skip((await carga.count()) === 0, 'El primer ejercicio de hoy es de cardio')

  await carga.click()
  const subir = page.getByRole('button', { name: 'Subir peso de todas las series' })
  await expect(subir).toBeVisible()
  await subir.click()
  await subir.click()

  // `exact` importa: sin él "Editar peso" también casaría con el control del
  // ejercicio, que es justo lo que NO se está comprobando aquí.
  const filas = page.getByRole('button', { name: 'Editar peso', exact: true })
  const pesos = await filas.allTextContents()
  expect(pesos.length).toBeGreaterThan(1)
  expect(new Set(pesos).size).toBe(1)
})

test('tocar la foto la abre en grande sin cerrar el ejercicio', async ({ page }) => {
  await entrar(page)
  const empezar = page.getByRole('link', { name: /entrenamiento/i })
  test.skip((await empezar.count()) === 0, 'Hoy toca descanso')
  await empezar.click()
  await page.waitForURL('**/sesion/**')

  const abierto = page.getByRole('button', { expanded: true }).first()
  await expect(abierto).toBeVisible()

  await page.getByRole('button', { name: /en grande/ }).first().click()

  await expect(page.getByRole('img', { name: /posición inicial/ })).toBeVisible()
  await page.getByRole('button', { name: 'Cerrar' }).click()

  // Y el ejercicio sigue desplegado: la foto no era un interruptor.
  await expect(page.getByRole('button', { expanded: true }).first()).toBeVisible()
})

test('la sesión se abre de cero sin red, con lo que quedó guardado', async ({ page, context }) => {
  await entrar(page)
  const empezar = page.getByRole('link', { name: /entrenamiento/i })
  test.skip((await empezar.count()) === 0, 'Hoy toca descanso')
  await empezar.click()
  await page.waitForURL('**/sesion/**')
  await expect(page.getByRole('button', { name: /^Marcar serie/ }).first()).toBeVisible()

  // Se recarga sin red: nada de esto sale del móvil.
  await context.setOffline(true)
  await page.reload()

  await expect(page.getByText(/Sin conexión/)).toBeVisible({ timeout: 15_000 })
  await expect(page.getByRole('button', { name: /^Marcar serie/ }).first()).toBeVisible()

  await context.setOffline(false)
})

test('sin red la sesión sigue funcionando y luego sincroniza sin duplicar', async ({
  page,
  context,
}) => {
  await entrar(page)
  const empezar = page.getByRole('link', { name: /entrenamiento/i })
  test.skip((await empezar.count()) === 0, 'Hoy toca descanso')
  await empezar.click()
  await page.waitForURL('**/sesion/**')

  await context.setOffline(true)

  const checks = page.getByRole('button', { name: /^Marcar serie/ })
  await checks.nth(0).click()
  await checks.nth(1).click()

  // La interfaz responde igual: nunca espera a la red.
  await expect(page.getByRole('button', { name: /^Desmarcar serie 1/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Desmarcar serie 2/ })).toBeVisible()

  // Y avisa de lo que falta por subir.
  await expect(page.getByText(/sin subir/)).toBeVisible()

  await context.setOffline(false)
  await page.getByText(/sin subir/).click()

  // Al recuperar la red el indicador desaparece: todo subió.
  await expect(page.getByText(/sin subir/)).toBeHidden({ timeout: 15_000 })

  // Y no hay duplicados: recargando, siguen siendo exactamente 2 marcadas.
  await page.reload()
  await expect(page.getByRole('button', { name: /^Desmarcar serie/ })).toHaveCount(2)
})
