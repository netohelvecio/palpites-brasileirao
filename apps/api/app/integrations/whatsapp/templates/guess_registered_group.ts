export interface GuessRegisteredGroupInput {
  userName: string
  userEmoji: string
  homeTeam: string
  awayTeam: string
  homeScore: number
  awayScore: number
}

export function guessRegisteredGroupMessage(input: GuessRegisteredGroupInput): string {
  return `${input.userName} ${input.userEmoji} palpitou: ${input.homeTeam} ${input.homeScore} x ${input.awayScore} ${input.awayTeam}`
}
