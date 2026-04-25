export interface GuessEntry {
  userName: string
  userEmoji: string
  homeScore: number
  awayScore: number
}

export interface RoundClosedInput {
  roundNumber: number
  homeTeam: string
  awayTeam: string
  guesses: GuessEntry[]
}

export function roundClosedMessage(input: RoundClosedInput): string {
  const header = `⏱️ Rodada ${input.roundNumber} fechada — ${input.homeTeam} x ${input.awayTeam}`

  if (input.guesses.length === 0) {
    return `${header}\n\nNenhum palpite registrado.`
  }

  const sorted = [...input.guesses].sort((a, b) => a.userName.localeCompare(b.userName, 'pt'))
  const lines = sorted.map((g) => `${g.userName} ${g.userEmoji} — ${g.homeScore}x${g.awayScore}`)
  return `${header}\n\nPalpites:\n${lines.join('\n')}`
}
