export type Exercise = {
  id: string
  name: string
  category: string | null
  equipment: string | null
  force: string | null
  level: string | null
  mechanic: string | null
  primaryMuscles: string[]
  secondaryMuscles: string[]
  instructions: string[]
  imagePaths: string[]
}
