import type { DateTime } from 'luxon'

export interface RoundOpenedInput {
  roundNumber: number
  homeTeam: string
  awayTeam: string
  kickoffAt: DateTime
}

export function roundOpenedMessage(input: RoundOpenedInput): string {
  const kickoff = input.kickoffAt.setZone('America/Sao_Paulo').toFormat("dd/MM 'às' HH:mm")
  return [
    `📢 Rodada ${input.roundNumber} aberta! 🔥`,
    `⚽ Jogo: ${input.homeTeam} x ${input.awayTeam}`,
    `⏰ Início: ${kickoff}`,
  ].join('\n')
}
