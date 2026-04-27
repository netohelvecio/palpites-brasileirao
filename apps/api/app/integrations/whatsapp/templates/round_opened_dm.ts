import type { DateTime } from 'luxon'

export interface RoundOpenedDmInput {
  userName: string
  userEmoji: string
  roundNumber: number
  homeTeam: string
  awayTeam: string
  kickoffAt: DateTime
}

export function roundOpenedDmMessage(input: RoundOpenedDmInput): string {
  const kickoff = input.kickoffAt.setZone('America/Sao_Paulo').toFormat('dd/MM HH:mm')
  return [
    `Oi ${input.userName} ${input.userEmoji}!`,
    `📢 Rodada ${input.roundNumber} aberta — ${input.homeTeam} x ${input.awayTeam}`,
    `Kickoff: ${kickoff}`,
    '',
    `Manda o palpite aqui no privado. Ex: 2x1 ${input.homeTeam}`,
  ].join('\n')
}
