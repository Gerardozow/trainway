# Desplegar Trainway

Guía escrita contra la infraestructura real de `gzow.dev`, no genérica. Todo lo
que aparece aquí está comprobado salvo el último paso.

## Estado actual

| Pieza | Estado |
|---|---|
| Proyecto de Supabase | Creado, 8 tablas, RLS verificado con 11 pruebas |
| Claves en `.env` | Las 4 correctas (`npm run check:keys`) |
| Token de Cloudflare | Válido, con permisos de DNS, Workers y rutas |
| DNS de `gzow.dev` | **Ya listo, no hay que tocarlo** |
| Worker | Compila y enruta bien (probado con `wrangler dev`) |
| Secrets del Worker | **Pendiente** |
| Publicación | **Pendiente** |

## Antes de empezar

```bash
npm run check:keys     # las 4 claves, con el rol correcto
npm test               # 108 pruebas
npm run build          # falla si falta configuración, a propósito
```

El `build` aborta si faltan `VITE_SUPABASE_URL` o `VITE_SUPABASE_ANON_KEY`. No
es una molestia: sin ellas, Vite pliega los guardias de configuración a
constantes y el bundler elimina la aplicación entera como código muerto,
dejando un build "exitoso" que no contiene nada.

## 1. Cargar los secrets del Worker

Estos dos **nunca** van en `wrangler.jsonc` ni con prefijo `VITE_`: acabarían en
el bundle que descarga cualquiera.

```bash
export CLOUDFLARE_API_TOKEN="$CF"      # el token que está en .env

npx wrangler secret put MINIMAX_API_KEY
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
```

Cada comando pide el valor por entrada estándar. Cópialos de `.env`.

La primera vez wrangler pregunta si crear el Worker `trainway`. Sí.

Comprobar que quedaron los dos, sin verlos:

```bash
npx wrangler secret list
```

## 2. Publicar

```bash
npm run deploy         # build + wrangler deploy
```

Esto monta la ruta `gzow.dev/trainway*`. El resto del dominio no se toca: el
parking de Dondominio sigue respondiendo en la raíz y en todo lo demás.

## 3. Comprobar que funciona

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://gzow.dev/trainway/
# 200

curl -s -X POST https://gzow.dev/trainway/api/plan \
     -H 'Content-Type: application/json' -d '{}'
# {"error":"Falta el token de sesión."}   <- correcto: la API exige sesión
```

Si la API devuelve HTML en vez de JSON, el Worker no está recibiendo la
petición: revisa que `assets.run_worker_first` siga en `true`.

Después, desde el celular:

1. Entrar a `gzow.dev/trainway`, crear cuenta, **confirmar el email**
2. Completar el cuestionario — el plan tarda unos 20 segundos
3. Abrir el entrenamiento del día y marcar una serie
4. Menú del navegador → "Añadir a pantalla de inicio"
5. Activar modo avión a media sesión, marcar dos series, volver a conectar y
   comprobar que el indicador de pendientes se vacía

## Sobre el registro abierto

Ahora mismo cualquiera con el enlace puede crear cuenta y generar planes, y
esos son tus créditos de MiniMax. Hay un límite de 10 planes al día por usuario,
pero no hay límite de usuarios.

Para cerrarlo: **Supabase → Authentication → Sign In / Providers → Email →
desactivar "Allow new users to sign up"**. Después creas las cuentas a mano
desde **Authentication → Users → Add user**.

Se puede cambiar cuando quieras; no afecta a las cuentas ya creadas.

## Revertir

```bash
npx wrangler delete
```

Quita el Worker y su ruta. `gzow.dev` vuelve exactamente a como estaba: el DNS
no se modificó en ningún momento. Los datos de Supabase siguen intactos.

## Actualizar después

```bash
git pull
npm run deploy
```

Los secrets siguen puestos, no hay que volver a cargarlos.

## Si algo falla

| Síntoma | Causa probable |
|---|---|
| Pantalla "Falta conectar la base de datos" | El build salió sin `.env` |
| La API devuelve HTML | `run_worker_first` desactivado en `wrangler.jsonc` |
| Los ejercicios salen en inglés | `SUPABASE_SERVICE_ROLE_KEY` mal o ausente |
| "La IA no logró armar un plan válido" | MiniMax sin créditos o caído — reintentar |
| El plan no se genera y da 401 | La sesión caducó; volver a entrar |

Para ver qué pasa en producción:

```bash
npx wrangler tail
```
