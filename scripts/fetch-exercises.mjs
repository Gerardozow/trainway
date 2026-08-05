/**
 * Descarga el catálogo de free-exercise-db y lo versiona en data/exercises.json.
 *
 * El catálogo va dentro del repo a propósito: así el build es reproducible y la
 * app funciona sin conexión sin depender de que GitHub esté arriba.
 */
import { writeFileSync, mkdirSync } from 'node:fs'

const URL = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json'

const res = await fetch(URL)
if (!res.ok) throw new Error(`Descarga fallida: ${res.status} ${res.statusText}`)

const data = await res.json()

if (!Array.isArray(data) || data.length < 800) {
  throw new Error(`Catálogo sospechoso: se esperaban 800+ ejercicios, llegaron ${data?.length}`)
}

for (const e of data) {
  if (!e.id || !e.name || !Array.isArray(e.images) || e.images.length === 0) {
    throw new Error(`Registro inválido: ${JSON.stringify(e).slice(0, 120)}`)
  }
}

mkdirSync('data', { recursive: true })
writeFileSync('data/exercises.json', JSON.stringify(data))
console.log(`OK: ${data.length} ejercicios guardados en data/exercises.json`)
