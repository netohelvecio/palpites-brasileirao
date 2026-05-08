export interface AdminPickedInput {
  roundNumber: number
  homeTeam: string
  awayTeam: string
}

export function adminPickedMessage(input: AdminPickedInput): string {
  return [
    `🎯 *Rodada ${input.roundNumber} — jogo definido pelo admin:*`,
    `${input.homeTeam} x ${input.awayTeam}`,
  ].join('\n')
}
