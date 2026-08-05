/**
 * Los músculos, el equipamiento y las categorías son conjuntos cerrados de ~30
 * valores. Se traducen con un diccionario estático: gastar una llamada de IA en
 * esto sería absurdo. Los nombres e instrucciones de los ejercicios sí van por
 * IA, porque son texto libre (ver worker/routes/translate.ts).
 */

export const MUSCLE_ES: Record<string, string> = {
  abdominals: 'Abdominales',
  abductors: 'Abductores',
  adductors: 'Aductores',
  biceps: 'Bíceps',
  calves: 'Gemelos',
  chest: 'Pecho',
  forearms: 'Antebrazos',
  glutes: 'Glúteos',
  hamstrings: 'Isquiotibiales',
  lats: 'Dorsales',
  'lower back': 'Lumbares',
  'middle back': 'Espalda media',
  neck: 'Cuello',
  quadriceps: 'Cuádriceps',
  shoulders: 'Hombros',
  traps: 'Trapecios',
  triceps: 'Tríceps',
}

export const EQUIPMENT_ES: Record<string, string> = {
  barbell: 'Barra',
  dumbbell: 'Mancuernas',
  machine: 'Máquina',
  cable: 'Poleas',
  'body only': 'Peso corporal',
  kettlebells: 'Pesas rusas',
  bands: 'Bandas',
  'medicine ball': 'Balón medicinal',
  'exercise ball': 'Fitball',
  'foam roll': 'Rodillo',
  'e-z curl bar': 'Barra Z',
  other: 'Otro',
}

export const CATEGORY_ES: Record<string, string> = {
  strength: 'Fuerza',
  stretching: 'Estiramiento',
  plyometrics: 'Pliometría',
  strongman: 'Strongman',
  powerlifting: 'Powerlifting',
  cardio: 'Cardio',
  'olympic weightlifting': 'Halterofilia',
}

export const LEVEL_ES: Record<string, string> = {
  beginner: 'Principiante',
  intermediate: 'Intermedio',
  expert: 'Avanzado',
}

export const FORCE_ES: Record<string, string> = {
  push: 'Empuje',
  pull: 'Tirón',
  static: 'Isométrico',
}

/** Grupos que se ofrecen en el wizard, en el orden en que se muestran. */
export const FOCUS_GROUPS: { key: string; label: string; muscles: string[] }[] = [
  { key: 'chest', label: 'Pecho', muscles: ['chest'] },
  { key: 'back', label: 'Espalda', muscles: ['lats', 'middle back', 'lower back', 'traps'] },
  { key: 'shoulders', label: 'Hombros', muscles: ['shoulders'] },
  { key: 'arms', label: 'Brazos', muscles: ['biceps', 'triceps', 'forearms'] },
  { key: 'legs', label: 'Piernas', muscles: ['quadriceps', 'hamstrings', 'calves', 'glutes'] },
  { key: 'core', label: 'Core', muscles: ['abdominals'] },
]

export function muscleEs(m: string): string {
  return MUSCLE_ES[m] ?? m
}

export function equipmentEs(e: string | null): string {
  return e ? (EQUIPMENT_ES[e] ?? e) : 'Sin equipo'
}
