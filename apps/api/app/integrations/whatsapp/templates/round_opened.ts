import type { DateTime } from 'luxon'

export interface RoundOpenedInput {
  roundNumber: number
  homeTeam: string
  awayTeam: string
  kickoffAt: DateTime
}

export function roundOpenedMessage(input: RoundOpenedInput): string {
  const kickoff = input.kickoffAt.setZone('America/Sao_Paulo').toFormat('dd/MM HH:mm')
  return [
    `📢 Rodada ${input.roundNumber} aberta!`,
    `Jogo: ${input.homeTeam} x ${input.awayTeam}`,
    `Kickoff: ${kickoff}`,
  ].join('\n')
}
