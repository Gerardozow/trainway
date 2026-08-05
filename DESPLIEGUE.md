# Desplegar Trainway

Todo lo que necesita credenciales tuyas está marcado con **(tú)**. Lo demás
está listo o es un comando que corro yo cuando tenga los datos.

## Lo que hace falta de ti

1. **(tú)** Un proyecto de Supabase en <https://supabase.com/dashboard>.
   - Región: **us-east-1** — la más cercana a México con capa gratuita.
   - Guarda la contraseña de la base que te pide al crearlo, donde tú la
     controles. No me la pases: no la necesito.
   - Del panel copia el **project ref** (el subdominio, algo como
     `abcdefghijklm`) y la **anon key**. Esos dos sí me hacen falta.
   - La `service_role` **no me la pases**. Se configura como secreto dentro de
     Supabase, no vive en el repositorio.

2. **(tú)** Un remitente de correo. Sin esto **ninguna cuenta puede
   confirmarse**, y sin confirmar no se puede entrar. Es el único bloqueo duro.
   - Lo más rápido: [Resend](https://resend.com) tiene capa gratuita y da
     credenciales SMTP en cinco minutos.
   - En el panel de Supabase: *Authentication → Emails → SMTP Settings*.

3. **(tú)** Una cuenta en Vercel o Netlify para el sitio. Cualquiera sirve: la
   app compila a archivos estáticos.

## Lo que hago yo con eso

```bash
# 1. conectar el repositorio al proyecto
pnpm supabase link --project-ref <TU_PROJECT_REF>

# 2. subir el esquema: las 9 migraciones
pnpm supabase db push

# 3. sembrar el catálogo en producción (873 ejercicios + 1746 imágenes)
#    con las variables apuntando al proyecto de producción
pnpm seed:exercises

# 4. desplegar la Edge Function de acceso
pnpm supabase functions deploy sign-in

# 5. el secreto que la función necesita
pnpm supabase secrets set ALLOWED_ORIGINS=https://<tu-dominio>

# 6. compilar y subir el sitio
pnpm build   # deja todo en dist/
```

Y en el panel de Supabase, *Authentication → URL Configuration*:

- **Site URL**: `https://<tu-dominio>`
- **Redirect URLs**: `https://<tu-dominio>` y `https://<tu-dominio>/`

## Cosas que se romperían si se olvidan

Están todas documentadas en el código, pero conviene tenerlas juntas:

**Sin `ALLOWED_ORIGINS`** la función de acceso rechaza al navegador por CORS y
el usuario ve *"No se pudo conectar. Revisa tu conexión."* — un mensaje que
culpa a su red de un problema nuestro.

**Sin SMTP** nadie puede confirmar su correo, y un intento de entrar sin
confirmar devuelve *"Credenciales inválidas"* — correcto para no delatar qué
cuentas existen, pero indistinguible de una contraseña mal escrita. No hay
reenvío ni recuperación todavía.

**Sin `Site URL` y `Redirect URLs`** los enlaces de confirmación apuntan a
localhost.

**El catálogo no viaja en las migraciones.** Hay que sembrarlo aparte, y son
unos minutos por las imágenes.

## Huecos conocidos que llevamos a producción

Están medidos y documentados, no son sorpresas:

**No hay límite de intentos por usuario en el acceso.** Todos los intentos
llegan a Supabase desde la misma dirección de la Edge Function, así que su
limitador por IP no distingue entre personas. Reenviar la IP del llamante se
probó y se descartó: ese encabezado lo controla quien llama, y rotándolo
obtendría intentos ilimitados — peor que el problema. El cierre real es un
captcha, ya previsto en la configuración. **Recomiendo activarlo antes de
compartir la app fuera de tus amigos.**

**Se puede averiguar si un correo tiene cuenta.** Por tres caminos, medidos:
el registro responde distinto a un correo ya registrado, reclamar un username
delata si el alta ocurrió, y `/auth/v1/token` tarda ~14 ms con un correo
inexistente contra ~140 ms con uno real. El tercero es de Supabase, no
nuestro, y no se puede cerrar mientras la clave anónima sea pública. Los
usernames son públicos por diseño —así se encuentran los amigos—, pero los
correos no deberían serlo. Está documentado en `supabase/config.toml` y en el
plan correspondiente.

**Sin recuperación de contraseña.** Si alguien la olvida, no hay camino de
vuelta salvo que le crees la cuenta de nuevo.

## Antes de compartirla con tus amigos

Mi recomendación, en orden:

1. Configurar SMTP. Sin esto no funciona nada.
2. Activar el captcha en el acceso.
3. Añadir recuperación de contraseña.

Los tres son trabajo acotado y ninguno depende de lo demás.
