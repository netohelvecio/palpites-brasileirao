export interface GuessScore {
  guessHome: number
  guessAway: number
}

export interface FinalScore {
  finalHome: number
  finalAway: number
}

function outcome(h: number, a: number): 'home' | 'away' | 'draw' {
  if (h > a) return 'home'
  if (a > h) return 'away'
  return 'draw'
}

export function calculatePoints(guess: GuessScore, final: FinalScore): number {
  if (guess.guessHome === final.finalHome && guess.guessAway === final.finalAway) return 3
  if (outcome(guess.guessHome, guess.guessAway) === outcome(final.finalHome, final.finalAway))
    return 1
  return 0
}
