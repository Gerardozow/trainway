export function formatWeight(kg: number): string {
  const rounded = Math.round(kg * 10) / 10
  return `${rounded} kg`
}
