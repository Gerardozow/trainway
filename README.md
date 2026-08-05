<p align="center">
  <img src="brand/logo.png" alt="Trainway" width="420">
</p>

Aplicación web de entrenamiento de gimnasio. Respondes un cuestionario guiado, una IA te arma un mesociclo de cuatro semanas con ejercicios reales e imágenes, y registras series desde el celular — también sin señal. Al cerrar el bloque, la IA revisa tu historial y genera el siguiente.

- **Diseño:** [`docs/superpowers/specs/2026-08-05-trainway-design.md`](docs/superpowers/specs/2026-08-05-trainway-design.md)
- **Plan de implementación:** [`docs/superpowers/plans/2026-08-05-trainway.md`](docs/superpowers/plans/2026-08-05-trainway.md)

## Cómo está montado

```
             gzow.dev/trainway/*
                     |
     Cloudflare Worker (assets estáticos + /api/*)
                     |
        +------------+-------------+
        |                          |
   Supabase                    MiniMax
   auth + Postgres + RLS       MiniMax-M3
   el navegador va directo     solo desde el Worker
```

El Worker existe por una sola razón: **la key de MiniMax no puede estar en el cliente**. Todo lo demás (auth, lecturas, escrituras) va del navegador a Supabase, protegido por RLS.

El catálogo de ejercicios ([free-exercise-db](https://github.com/yuhonas/free-exercise-db), 873 ejercicios, dominio público) va versionado en el repo, no se pide en runtime. Por eso la app funciona en un sótano sin cobertura.

## Empezar

```bash
npm install
npm run fetch:exercises     # descarga data/exercises.json
cp .env.example .env        # y rellena las credenciales de Supabase
npm run dev
```

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo en `localhost:5173/trainway/` |
| `npm test` | Vitest: 89 pruebas de lógica pura |
| `npm run e2e` | Playwright en perfil móvil |
| `npm run typecheck` | TypeScript en modo estricto |
| `npm run build` | Compila a `dist/` |
| `npm run deploy` | Compila y publica el Worker |

## Base de datos

Aplica las dos migraciones de [`supabase/migrations/`](supabase/migrations/) en orden. La segunda contiene las políticas RLS, que **son** la seguridad del sistema: el navegador habla directo con Postgres. Hay un test de aislamiento entre usuarios en `tests/rls.test.ts` que se ejecuta si defines `SUPABASE_TEST_URL`.

## Desplegar

```bash
# 1. Secrets del Worker (nunca en .env, nunca con prefijo VITE_)
npx wrangler secret put MINIMAX_API_KEY
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY

# 2. Variables públicas en wrangler.jsonc -> vars
#    SUPABASE_URL y SUPABASE_ANON_KEY

# 3. Publicar
npm run deploy
```

### DNS

`gzow.dev` está en Cloudflare sin origen real. Una ruta de Worker necesita un registro DNS que resuelva, así que se crea uno **proxied** (nube naranja) apuntando a la dirección de descarte de IPv6:

```
AAAA   gzow.dev   100::   (proxied)
```

Cloudflare intercepta la petición antes de llegar a ningún sitio y la entrega al Worker. La raíz del dominio queda libre para otra cosa: solo `/trainway*` pertenece a este proyecto.

## Decisiones que conviene conocer

**La IA elige de un catálogo cerrado, nunca inventa.** El Worker le pasa ~60 candidatos con sus id y exige que elija solo de ahí. `validatePlan` rechaza cualquier otro; si reincide tras un reintento, `repairPlan` sustituye por el candidato más cercano. Sin esto el modelo devuelve ejercicios plausibles que no existen y el plan queda con huecos donde debería ir la imagen.

**La IA genera una semana, no cuatro.** Las semanas 2 a 4 se derivan en código (`expandBlock`): semana 3 suma una serie a los compuestos, semana 4 es descarga. Pedirle 96 entradas de JSON a un modelo es caro y es justo donde empieza a contradecirse.

**El peso no se guarda en el plan.** Se calcula al abrir la sesión leyendo tus últimas series reales. Por eso saltarte un día no rompe nada, y por eso la semana 1 es de calibración: ningún sistema puede prescribir kilos el primer día.

**`set_logs.client_id` es la clave de idempotencia.** Lo genera el celular antes de tocar la red y no cambia nunca, ni al editar la serie. Un reintento tras un corte de señal no duplica la fila.

**El build falla si faltan las variables de entorno.** Vite sustituye `import.meta.env.*` por literales al compilar; sin ellas, cualquier guardia de configuración se pliega a una constante y el bundler elimina la aplicación entera como código muerto, con el build marcado como exitoso. `vite.config.ts` aborta antes de que eso pase.

**El amarillo de marca nunca es color de texto sobre fondo claro.** `#FFC603` sobre blanco da 1.51:1. El token `--volt-ink` usa un paso más oscuro (5.21:1) para texto, y las gráficas usan colores validados aparte.

## Créditos

Ejercicios e imágenes de [free-exercise-db](https://github.com/yuhonas/free-exercise-db), bajo Unlicense (dominio público).
Tipografía [Archivo](https://fonts.google.com/specimen/Archivo), Open Font License.
