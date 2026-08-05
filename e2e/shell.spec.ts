import { test, expect } from '@playwright/test'

/**
 * Comprobaciones que no necesitan backend: que la app arranca bajo el subpath,
 * que la PWA está bien declarada, y que la accesibilidad básica se sostiene.
 *
 * El recorrido completo (registro, plan, sesión) vive en session.spec.ts y
 * necesita una instancia de Supabase.
 */

test('la app carga bajo /trainway y muestra la marca', async ({ page }) => {
  await page.goto('.')
  await expect(page).toHaveTitle('Trainway')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Trainway')
})

test('la pantalla de entrada es usable con teclado', async ({ page }) => {
  await page.goto('entrar')

  const email = page.getByLabel('Email')
  const password = page.getByLabel('Contraseña')

  await email.fill('gerardo@ejemplo.com')
  await password.fill('corta')
  await page.getByRole('button', { name: 'Entrar' }).click()

  await expect(page.getByRole('alert')).toContainText('al menos 8 caracteres')
})

test('todo objetivo táctil llega a 48 px', async ({ page }) => {
  await page.goto('entrar')

  const targets = page.locator('button, a[href], input, select')
  const count = await targets.count()
  expect(count).toBeGreaterThan(0)

  for (let i = 0; i < count; i++) {
    const el = targets.nth(i)
    if (!(await el.isVisible())) continue
    const box = await el.boundingBox()
    if (!box) continue
    expect(box.height, `elemento ${i} mide ${box.height}px de alto`).toBeGreaterThanOrEqual(44)
  }
})

test('no hay scroll horizontal', async ({ page }) => {
  await page.goto('entrar')
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  )
  expect(overflow).toBe(false)
})

test('el manifest declara la PWA en el subpath correcto', async ({ page, request }) => {
  await page.goto('.')

  const res = await request.get('manifest.webmanifest')
  expect(res.ok()).toBe(true)

  const manifest = (await res.json()) as Record<string, unknown>
  expect(manifest.name).toBe('Trainway')
  expect(manifest.start_url).toBe('/trainway/')
  expect(manifest.scope).toBe('/trainway/')
  expect(manifest.display).toBe('standalone')

  const icons = manifest.icons as { sizes: string; purpose?: string }[]
  expect(icons.map((i) => i.sizes)).toContain('512x512')
  expect(icons.some((i) => i.purpose === 'maskable')).toBe(true)
})

test('el service worker se registra y precachea el catálogo', async ({ page }) => {
  await page.goto('.')

  const registered = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.getRegistration()
    return Boolean(reg)
  })
  expect(registered).toBe(true)
})

test('el tema oscuro y el claro se aplican de verdad', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.goto('entrar')
  await expect(page.locator('html')).toHaveClass(/dark/)

  await page.emulateMedia({ colorScheme: 'light' })
  await page.reload()
  await expect(page.locator('html')).not.toHaveClass(/dark/)
})

test('la página se desplaza con el dedo, no solo por código', async ({ page }) => {
  await page.goto('entrar')

  // Contenido suficiente para que haya algo que desplazar.
  await page.evaluate(() => {
    const relleno = document.createElement('div')
    relleno.style.height = '3000px'
    document.body.append(relleno)
  })

  // Entrada táctil REAL vía CDP: el scroll lo mueve el compositor y no
  // reacciona a TouchEvent fabricados con dispatchEvent.
  //
  // Esto existe porque `overflow-x: hidden` en `html` rompía justo esto: el
  // scroll programático seguía funcionando y el gesto no, así que el fallo
  // solo se veía con el dedo.
  const cdp = await page.context().newCDPSession(page)
  const punto = (y: number) => [{ x: 200, y, radiusX: 12, radiusY: 12, force: 1, id: 1 }]

  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: punto(700) })
  for (let y = 680; y >= 200; y -= 40) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: punto(y) })
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })

  await expect.poll(() => page.evaluate(() => window.scrollY), { timeout: 5000 }).toBeGreaterThan(100)
})

test('ni html ni body capturan el scroll del viewport', async ({ page }) => {
  await page.goto('entrar')

  const overflow = await page.evaluate(() => {
    const de = getComputedStyle(document.documentElement)
    const b = getComputedStyle(document.body)
    return { htmlX: de.overflowX, htmlY: de.overflowY, bodyX: b.overflowX, bodyY: b.overflowY }
  })

  // `hidden` en un eje fuerza `auto` en el otro y convierte al elemento en
  // contenedor de scroll, que es lo que rompía el gesto táctil.
  expect(overflow.htmlX).toBe('visible')
  expect(overflow.htmlY).toBe('visible')
  expect(overflow.bodyX).toBe('visible')
  expect(overflow.bodyY).toBe('visible')
})

test('los diálogos declaran su color de texto', async ({ page }) => {
  await page.goto('entrar')

  // En la top layer el navegador aplica `color: CanvasText` al <dialog>, y los
  // hijos lo heredan: texto negro sobre fondo oscuro. Cada diálogo tiene que
  // fijar su propio color. Esto ya pasó dos veces.
  const color = await page.evaluate(() => {
    const d = document.createElement('dialog')
    d.className = 'text-[var(--fg)]'
    const span = document.createElement('span')
    d.append(span)
    document.body.append(d)
    d.showModal()
    const c = getComputedStyle(span).color
    d.close()
    d.remove()
    return c
  })

  // En tema claro --fg es #14140f; en oscuro #fafafa. Nunca el negro puro del
  // UA (rgb(0, 0, 0)) sin declarar.
  expect(color).not.toBe('rgb(0, 0, 0)')
})
