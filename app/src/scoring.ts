export const PASSING_SCORE = 34
export const TECHNICAL_DURATION_SECONDS = 40 * 60

export function qualifiesForCoding(score: number) {
  return score >= PASSING_SCORE
}
