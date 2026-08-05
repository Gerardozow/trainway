import { Wordmark } from '@/components/Wordmark'

/**
 * Se muestra cuando faltan las variables de Supabase. Un error de configuración
 * tiene que verse y explicarse, no dejar una pantalla en blanco.
 */
export function SetupNeeded() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-5 px-6">
      <Wordmark className="h-7 self-start" />

      <div className="flex flex-col gap-2">
        <h1 className="display text-2xl">Falta conectar la base de datos</h1>
        <p className="text-[var(--fg-muted)]">
          Trainway necesita las credenciales de Supabase para arrancar. Créalas en tu proyecto y
          añádelas al archivo <code className="text-[var(--fg)]">.env</code> de la raíz:
        </p>
      </div>

      <pre className="overflow-x-auto rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 text-sm">
        <code>{`VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...`}</code>
      </pre>

      <p className="text-sm text-[var(--fg-muted)]">
        Después vuelve a compilar. En Cloudflare, las mismas variables van en la configuración del
        Worker.
      </p>
    </main>
  )
}
