# Probar Trainway en local

Instrucciones para levantar la app y ver qué hace. Unos cinco minutos la
primera vez; la mayor parte es la descarga de las imágenes del catálogo.

## Levantarla

Con Docker corriendo:

```bash
pnpm install
pnpm db:start
pnpm supabase status          # copia las claves
cp .env.example .env.local    # y llénalo con esas claves
pnpm db:reset
pnpm seed:exercises           # 873 ejercicios + 1746 imágenes, tarda unos minutos
pnpm seed:demo                # cuenta de demostración con datos
pnpm dev
```

Abre la URL que imprime `pnpm dev` (normalmente <http://localhost:5173>).

**Entra con:**

- usuario: `demo` — o el correo `demo@trainway.test`
- contraseña: `demo1234`

La cuenta ya trae una rutina llamada *Fuerza básica* y dos entrenos pasados,
para que se vea la referencia de "la última vez" desde el primer momento.

## Qué mirar

**1. Entrar con usuario o con correo.** Ambos funcionan. El correo no es
público: la traducción de usuario a correo ocurre en el servidor, en una
función que el navegador no puede llamar.

**2. Entrenar.** Toca *Entrenar*, empieza un entreno y elige un ejercicio. Bajo
el nombre aparece en gris lo que levantaste la última vez. Registra una serie:
el peso se queda puesto y las repeticiones se vacían, porque normalmente
repites el mismo peso varias series seguidas.

**3. Sin conexión.** Con el entreno abierto, pon el navegador en modo offline
(herramientas de desarrollo → Network → Offline). Registra dos series más:
aparecen al instante y sale un aviso de que hay cambios por subir. Vuelve a
poner red y el aviso desaparece solo. Nada se pierde en el camino.

**4. Recargar a media serie.** Con el entreno abierto, recarga la página. El
entreno sigue ahí con sus series. Es lo que pasa cuando el teléfono mata la app.

**5. Buscar ejercicios.** *Rutinas* → *Ver el catálogo*. Escribe `biceps` sin
acento: encuentra *bíceps* igual. Filtra por músculo. Esta pantalla funciona
sin red, porque el catálogo entero está cacheado en el navegador.

**6. Rutinas.** Crea una, añade ejercicios, reordénalos con las flechas, ponles
series y repeticiones objetivo. Guarda. Luego toca *Entrenar* en esa rutina: la
pantalla de entreno arranca con sus ejercicios como acceso rápido, mostrando
cuántas series llevas de las que tocan.

**7. Tema claro y oscuro.** *Perfil* → *Tema*. Arranca siguiendo el del sistema.
Al recargar con el oscuro puesto no destella en blanco.

**8. Instalarla.** En Chrome, el icono de instalar en la barra de direcciones.
Se abre sin barra del navegador, con el icono amarillo de Trainway.

## Lo que todavía no hace

- **Compartir rutinas con amigos.** Es lo siguiente (Plan 5).
- **Progreso y gráficas.** Después (Plan 6).
- **Coach IA.** Falta la clave de MiniMax (Plan 7).
- **Cambiar la contraseña o recuperarla.** No está.
- **Entrar con Google.** El proveedor no está configurado; el registro con
  contraseña cubre el caso completo.

## Si algo falla

**Las pruebas o la app fallan con un error de red contra el servidor de
autenticación.** Tras `pnpm db:reset` los contenedores cambian de IP y Kong se
queda con las viejas:

```bash
docker restart supabase_kong_trainway
```

**El catálogo aparece vacío.** `pnpm db:reset` borra los ejercicios, porque la
siembra no es una migración. Usa `pnpm db:reset:full`, que hace las dos cosas, o
corre `pnpm seed:exercises` después.

**Quieres empezar de cero.**

```bash
pnpm db:reset:full && pnpm seed:demo
```

## Comprobar que todo está sano

```bash
pnpm test        # 267 pruebas unitarias; no necesita Docker ni .env.local
pnpm test:rls    # 62 pruebas de aislamiento de la base; necesita el stack
pnpm build       # compilación de producción
```
