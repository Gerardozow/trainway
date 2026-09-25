import type { Criteria, Exercise, Experience, Level } from './types'

/**
 * Cardio que existe dentro de un gimnasio. Se excluyen a propósito Bicycling,
 * Skating y Trail_Running_Walking: son de exterior y el alcance del proyecto es
 * solo gimnasio, sin GPS.
 */
export const GYM_CARDIO_IDS: readonly string[] = [
  'Bicycling_Stationary',
  'Elliptical_Trainer',
  'Jogging_Treadmill',
  'Prowler_Sprint',
  'Recumbent_Bike',
  'Rope_Jumping',
  'Rowing_Stationary',
  'Running_Treadmill',
  'Stairmaster',
  'Step_Mill',
  'Walking_Treadmill',
]

/**
 * Ejercicios que tiene prácticamente cualquier gimnasio comercial.
 *
 * El catálogo trae ochocientos ejercicios y muchos piden un aparato raro o son
 * variantes de nicho. Estos van primero en la lista de candidatos para que el
 * plan se pueda hacer en el gimnasio de la esquina, no solo en uno de
 * powerlifting.
 */
export const GYM_STAPLE_IDS: readonly string[] = [
  // Pecho
  'Barbell_Bench_Press_-_Medium_Grip',
  'Barbell_Incline_Bench_Press_-_Medium_Grip',
  'Dumbbell_Bench_Press',
  'Incline_Dumbbell_Press',
  'Dumbbell_Flyes',
  'Incline_Dumbbell_Flyes',
  'Machine_Bench_Press',
  'Leverage_Chest_Press',
  'Leverage_Incline_Chest_Press',
  'Smith_Machine_Bench_Press',
  'Smith_Machine_Incline_Bench_Press',
  'Butterfly',
  'Cable_Crossover',
  'Pushups',
  // Espalda
  'Wide-Grip_Lat_Pulldown',
  'Close-Grip_Front_Lat_Pulldown',
  'Seated_Cable_Rows',
  'Bent_Over_Barbell_Row',
  'One-Arm_Dumbbell_Row',
  'T-Bar_Row_with_Handle',
  'Leverage_High_Row',
  'Leverage_Iso_Row',
  'Straight-Arm_Pulldown',
  'Pullups',
  'Chin-Up',
  'Barbell_Deadlift',
  'Hyperextensions_Back_Extensions',
  'Barbell_Shrug',
  'Dumbbell_Shrug',
  // Hombro
  'Barbell_Shoulder_Press',
  'Dumbbell_Shoulder_Press',
  'Seated_Dumbbell_Press',
  'Arnold_Dumbbell_Press',
  'Machine_Shoulder_Military_Press',
  'Leverage_Shoulder_Press',
  'Side_Lateral_Raise',
  'Cable_Seated_Lateral_Raise',
  'Front_Dumbbell_Raise',
  'Reverse_Flyes',
  'Reverse_Machine_Flyes',
  'Face_Pull',
  'Upright_Barbell_Row',
  // Pierna y glúteo
  'Barbell_Squat',
  'Smith_Machine_Squat',
  'Hack_Squat',
  'Leg_Press',
  'Goblet_Squat',
  'Dumbbell_Squat',
  'Dumbbell_Lunges',
  'Barbell_Lunge',
  'Dumbbell_Step_Ups',
  'Romanian_Deadlift',
  'Stiff-Legged_Dumbbell_Deadlift',
  'Sumo_Deadlift',
  'Leg_Extensions',
  'Lying_Leg_Curls',
  'Seated_Leg_Curl',
  'Barbell_Hip_Thrust',
  'Barbell_Glute_Bridge',
  'Glute_Kickback',
  'Thigh_Abductor',
  'Thigh_Adductor',
  'Standing_Calf_Raises',
  'Seated_Calf_Raise',
  'Bodyweight_Squat',
  // Brazo
  'Barbell_Curl',
  'EZ-Bar_Curl',
  'Dumbbell_Bicep_Curl',
  'Dumbbell_Alternate_Bicep_Curl',
  'Hammer_Curls',
  'Incline_Dumbbell_Curl',
  'Concentration_Curls',
  'Preacher_Curl',
  'Machine_Preacher_Curls',
  'Cable_Hammer_Curls_-_Rope_Attachment',
  'Triceps_Pushdown',
  'Triceps_Pushdown_-_Rope_Attachment',
  'Cable_Rope_Overhead_Triceps_Extension',
  'EZ-Bar_Skullcrusher',
  'Standing_Dumbbell_Triceps_Extension',
  'Tricep_Dumbbell_Kickback',
  'Dips_-_Triceps_Version',
  'Bench_Dips',
  // Core
  'Plank',
  'Crunches',
  'Cable_Crunch',
  'Pallof_Press',
  'Russian_Twist',
]

const STAPLES = new Set(GYM_STAPLE_IDS)

/** Un principiante no debe recibir un arranque de potencia como tercer ejercicio. */
const LEVELS_FOR: Record<Experience, Level[]> = {
  principiante: ['beginner'],
  intermedio: ['beginner', 'intermediate'],
  avanzado: ['beginner', 'intermediate', 'expert'],
}

/** Categorías que nunca se prescriben como ejercicio de un plan. */
const EXCLUDED_CATEGORIES = new Set(['stretching'])

/** Cuántas máquinas de cardio ve el modelo cuando la persona lo pidió. */
const CARDIO_SLOTS = 5

/** Por debajo de estos básicos se usa el catálogo entero, sin recortar. */
const MIN_STAPLES = 40

/** Variantes fuera de los básicos que entran por cada músculo del foco. */
const FOCUS_EXTRAS = 4

const ALWAYS_AVAILABLE = 'body only'

function scoreOf(e: Exercise, focus: Set<string>): number {
  let score = 0
  /*
   * Un básico pesa más que coincidir con el foco. Si no, un foco en pecho
   * llenaba los sesenta huecos con variantes de pecho y el día de pierna se
   * quedaba sin prensa ni sentadilla. El énfasis lo da el orden entre básicos
   * y la línea "Grupos a enfatizar" del prompt.
   */
  if (STAPLES.has(e.id)) score -= 200
  if (e.primaryMuscles.some((m) => focus.has(m))) score -= 100
  else if (e.secondaryMuscles.some((m) => focus.has(m))) score -= 50
  if (e.mechanic === 'compound') score -= 10
  return score
}

/**
 * Reduce el catálogo a los candidatos que la IA puede elegir.
 *
 * Este filtro es la barrera que impide que el modelo invente ejercicios: solo
 * recibe estos ids, y `validatePlan` rechaza cualquier otro. Sin esto, el plan
 * acaba con ejercicios plausibles que no tienen imagen.
 */
export function filterCandidates(criteria: Criteria, catalog: Exercise[]): Exercise[] {
  const { equipment, level, focusMuscles, includeCardio, limit } = criteria
  const allowedLevels = new Set(LEVELS_FOR[level])
  const focus = new Set(focusMuscles)

  const pick = (allowedEquipment: Set<string>) =>
    catalog.filter((e) => {
      if (EXCLUDED_CATEGORIES.has(e.category)) return false
      if (!allowedLevels.has(e.level)) return false

      if (e.category === 'cardio') {
        return includeCardio && GYM_CARDIO_IDS.includes(e.id)
      }

      return allowedEquipment.has(e.equipment ?? 'other')
    })

  let result = pick(new Set([...equipment, ALWAYS_AVAILABLE]))

  // Sin equipamiento declarado la lista se queda muy corta; caer a peso corporal
  // es mejor que devolver vacío y romper la generación del plan.
  if (result.length === 0) result = pick(new Set([ALWAYS_AVAILABLE]))

  // Orden estable: relevancia, luego alfabético. El desempate por nombre es lo
  // que hace la función determinista entre llamadas.
  result.sort((a, b) => {
    const diff = scoreOf(a, focus) - scoreOf(b, focus)
    return diff !== 0 ? diff : a.id.localeCompare(b.id)
  })

  if (!limit) return result

  /*
   * Con equipamiento suficiente, el modelo ve los básicos y unas pocas
   * variantes por músculo del foco, que van delante para que el recorte nunca
   * se las lleve: los básicos no cubren antebrazo ni todos los ángulos, y sin
   * ellas pedir énfasis en un grupo no cambiaba la lista.
   *
   * Con poco equipamiento —solo mancuernas, solo peso corporal— hay pocos
   * básicos y se queda la lista entera ordenada. Recortar ahí dejaba al resto
   * de grupos con dos opciones mientras el foco se llevaba todo.
   */
  const strength = result.filter((e) => e.category !== 'cardio')
  const staples = strength.filter((e) => STAPLES.has(e.id))
  if (staples.length >= MIN_STAPLES) {
    const extras: Exercise[] = []
    for (const m of focusMuscles) {
      extras.push(
        ...strength
          .filter((e) => !STAPLES.has(e.id) && !extras.includes(e) && e.primaryMuscles.includes(m))
          .slice(0, FOCUS_EXTRAS),
      )
    }
    result = [...extras, ...staples, ...result.filter((e) => e.category === 'cardio')]
  }

  /*
   * El cardio necesita sitio reservado.
   *
   * Se puntúa por músculos trabajados, y una cinta no trabaja el pecho: caía al
   * final de una lista de ochocientos y el recorte a sesenta se lo llevaba
   * entero. El resultado era que pedir cardio en el cuestionario no cambiaba
   * absolutamente nada — el modelo nunca llegó a ver un solo ejercicio de
   * cardio que poder elegir.
   */
  const cardio = result.filter((e) => e.category === 'cardio')
  if (cardio.length === 0) return result.slice(0, limit)

  const reservados = Math.min(CARDIO_SLOTS, cardio.length, limit)
  const resto = result.filter((e) => e.category !== 'cardio')

  return [...resto.slice(0, limit - reservados), ...cardio.slice(0, reservados)]
}
