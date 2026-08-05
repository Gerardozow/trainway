import { useState, type ReactNode } from 'react'
import { Table2 } from 'lucide-react'

/**
 * Envoltorio común de las gráficas.
 *
 * Incluye la vista de tabla porque el color nunca puede ser el único canal:
 * quien no distinga la marca, o use lector de pantalla, lee los números.
 */
export function ChartFrame({
  title,
  hint,
  rows,
  columns,
  children,
}: {
  title: string
  hint?: string
  rows: (string | number)[][]
  columns: [string, string]
  children: ReactNode
}) {
  const [asTable, setAsTable] = useState(false)

  return (
    <section className="strip flex flex-col gap-3 p-4">
      <header className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col">
          <h2 className="display text-lg">{title}</h2>
          {hint && <p className="text-xs text-[var(--fg-muted)]">{hint}</p>}
        </div>

        <button
          type="button"
          onClick={() => setAsTable((v) => !v)}
          aria-pressed={asTable}
          aria-label={asTable ? 'Ver como gráfica' : 'Ver como tabla'}
          className="grid size-11 shrink-0 place-items-center rounded-lg text-[var(--fg-muted)] active:bg-[var(--surface-2)]"
        >
          <Table2 className="size-4" aria-hidden />
        </button>
      </header>

      {asTable ? (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--line)]">
              <th scope="col" className="eyebrow py-2 text-left">
                {columns[0]}
              </th>
              <th scope="col" className="eyebrow py-2 text-right">
                {columns[1]}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, value]) => (
              <tr key={String(label)} className="border-b border-[var(--line)] last:border-0">
                <td className="py-2">{label}</td>
                <td className="num py-2 text-right text-base">{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        children
      )}
    </section>
  )
}
