/**
 * `virtual:pwa-register` lo genera el plugin al compilar, así que en las
 * pruebas no existe. Este doble deja importar el hook sin arrastrar un service
 * worker, que en jsdom tampoco existe.
 */
export function registerSW(): (reload?: boolean) => Promise<void> {
  return async () => {}
}
