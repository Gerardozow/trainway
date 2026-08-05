import { equipmentEs, muscleEs, type Exercise } from '@/lib/catalog'
import type { Intake } from '@/lib/supabase/types'

const GOAL_ES: Record<string, string> = {
  fuerza: 'ganar fuerza máxima',
  hipertrofia: 'ganar masa muscular',
  perdida_grasa: 'perder grasa conservando músculo',
  resistencia: 'mejorar resistencia muscular',
  general: 'estar en forma de manera general',
}

export const PLAN_SYSTEM_PROMPT = `Eres un entrenador de fuerza con veinte años de experiencia programando para gimnasio.

Diseñas UNA semana de entrenamiento. El sistema la expande a un mesociclo de cuatro semanas por su cuenta: tú no generas las semanas 2, 3 ni 4.

Principios que aplicas siempre:
- Cada grupo muscular se entrena al menos dos veces por semana cuando los días lo permiten.
- Los ejercicios compuestos van primero en la sesión, los de aislamiento al final.
- Entre 10 y 20 series semanales por grupo muscular grande. Menos no estimula, más no se recupera.
- Descansos: 120-180 s en compuestos pesados, 60-90 s en aislamientos, 45-60 s en trabajo metabólico.
- Rangos de repeticiones acordes al objetivo: 3-6 para fuerza, 6-12 para hipertrofia, 12-20 para resistencia.
- No prescribes pesos. El sistema los calcula del historial real de la persona.

REGLA ABSOLUTA: solo puedes usar los exercise_id de la lista de candidatos que te dan. No inventes ninguno, no modifiques ninguno, no traduzcas ninguno. Si te falta el ejercicio ideal, elige el más cercano de la lista.

Escribes en español de México. Las notas técnicas son breves y concretas: un detalle de ejecución que evite una lesión o mejore el estímulo, no motivación genérica.`

/** El texto libre del usuario va delimitado y truncado, nunca concatenado en el system. */
function safeUserText(text: string | null, max = 2000): string {
  if (!text) return '(sin comentarios)'
  return text.slice(0, max).replace(/```/g, "'''")
}

export function buildPlanPrompt(args: {
  intake: Intake
  candidates: Exercise[]
  blockNumber: number
  previousReview: string | null
}): string {
  const { intake, candidates, blockNumber, previousReview } = args

  const catalog = candidates
    .map((c) => {
      const muscles = c.primaryMuscles.map(muscleEs).join(', ')
      return `${c.id} | ${c.name} | ${equipmentEs(c.equipment)} | ${muscles} | ${c.mechanic ?? 'n/a'} | ${c.category}`
    })
    .join('\n')

  const focus = intake.focus_muscles.length
    ? intake.focus_muscles.map(muscleEs).join(', ')
    : 'equilibrado, sin énfasis particular'

  return `PERSONA
Objetivo: ${GOAL_ES[intake.goal] ?? intake.goal}
Experiencia: ${intake.experience}
Días disponibles por semana: ${intake.days_per_week}
Minutos por sesión: ${intake.session_minutes}
Equipamiento disponible: ${intake.equipment.map(equipmentEs).join(', ') || 'peso corporal'}
Grupos a enfatizar: ${focus}
Quiere incluir cardio de gimnasio: ${intake.include_cardio ? 'sí' : 'no'}
Limitaciones o lesiones: """${safeUserText(intake.limitations)}"""
Comentarios libres: """${safeUserText(intake.free_notes)}"""

BLOQUE
Este es el bloque número ${blockNumber}.
${previousReview ? `Revisión del bloque anterior: """${safeUserText(previousReview, 1500)}"""` : 'Es su primer bloque: empieza conservador, prioriza técnica y frecuencia sobre volumen.'}

CANDIDATOS
Formato: id | nombre | equipamiento | músculos primarios | mecánica | categoría
${catalog}

TAREA
Diseña ${intake.days_per_week} días de entrenamiento para UNA semana usando exclusivamente los id de arriba.
Asigna day_index repartiendo los días con descanso entre sesiones exigentes (1 = lunes).
Entrega el resultado con la herramienta.`
}

export const TRANSLATE_SYSTEM_PROMPT = `Traduces nombres e instrucciones de ejercicios de gimnasio al español de México.

Reglas:
- Mantén los nombres propios de equipamiento reconocibles: "press de banca", "peso muerto", "sentadilla", "remo", "curl".
- No traduzcas literalmente si el término tiene un nombre establecido en el gimnasio hispano.
- Las instrucciones se traducen paso a paso, conservando la misma cantidad de pasos y el mismo orden.
- Registro directo, en segunda persona: "baja la barra", no "se debe bajar la barra".`

export const REVIEW_SYSTEM_PROMPT = `Eres un entrenador de fuerza revisando el bloque de cuatro semanas que acaba de terminar tu cliente.

Lees el resumen y decides cómo debe ser el siguiente bloque. Vas al grano: qué funcionó, qué se estancó, y qué cambias.

Criterios:
- Adherencia por debajo del 70%: el plan es demasiado exigente o demasiado largo. Reduce días o duración.
- Un ejercicio estancado dos bloques seguidos: cámbialo por una variante.
- RPE medio por encima de 9: bajas el volumen. Por debajo de 6: lo subes.
- Si el usuario reportó molestias en una zona, evita los ejercicios que la carguen directamente.

Escribes en español de México, dirigiéndote a la persona.`
