import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

/** Redondea al múltiplo de 0.5 más cercano. Los discos de gimnasio no bajan de ahí. */
export function roundToHalf(n: number): number {
  return Math.round(n * 2) / 2
}

/** 105 -> "1:45". Para el temporizador de descanso y las duraciones de cardio. */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds))
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, '0')}`
}

const KG_TO_LB = 2.2046226218

export function toDisplayWeight(kg: number, units: 'metric' | 'imperial'): number {
  return units === 'imperial' ? Math.round(kg * KG_TO_LB * 2) / 2 : kg
}

export function fromDisplayWeight(value: number, units: 'metric' | 'imperial'): number {
  return units === 'imperial' ? roundToHalf(value / KG_TO_LB) : value
}

export function weightUnit(units: 'metric' | 'imperial'): string {
  return units === 'imperial' ? 'lb' : 'kg'
}

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

/** day_index 1..7 con lunes = 1, como se guarda en program_days. */
export function dayName(dayIndex: number): string {
  return DIAS[dayIndex % 7] ?? ''
}

/** Fecha local en formato ISO corto, sin desplazamiento de zona horaria. */
export function todayISO(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** 1..7 con lunes = 1, que es como razona un plan de entrenamiento. */
export function isoDayIndex(d: Date = new Date()): number {
  return d.getDay() === 0 ? 7 : d.getDay()
}
