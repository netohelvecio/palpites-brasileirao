export interface GuessScore {
  guessHome: number
  guessAway: number
}

export interface FinalScore {
  finalHome: number
  finalAway: number
}

export interface ScoringResult {
  points: number
  isExact: boolean
}

function outcome(h: number, a: number): 'home' | 'away' | 'draw' {
  if (h > a) return 'home'
  if (a > h) return 'away'
  return 'draw'
}

export function calculatePoints(
  guess: GuessScore,
  final: FinalScore,
  multiplier: number = 1
): ScoringResult {
  const isExact = guess.guessHome === final.finalHome && guess.guessAway === final.finalAway
  if (isExact) return { points: 3 * multiplier, isExact: true }
  if (outcome(guess.guessHome, guess.guessAway) === outcome(final.finalHome, final.finalAway)) {
    return { points: 1 * multiplier, isExact: false }
  }
  return { points: 0, isExact: false }
}
