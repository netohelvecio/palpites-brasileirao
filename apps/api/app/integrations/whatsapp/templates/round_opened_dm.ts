import type { DateTime } from 'luxon'

export interface RoundOpenedDmInput {
  userName: string
  userEmoji: string
  roundNumber: number
  homeTeam: string
  awayTeam: string
  kickoffAt: DateTime
  pointsMultiplier?: number
}

const DOUBLE_POINTS_HEADER = '🔥 *RODADA VALENDO EM DOBRO!* (1º × 2º na tabela)'

export function roundOpenedDmMessage(input: RoundOpenedDmInput): string {
  const kickoff = input.kickoffAt.setZone('America/Sao_Paulo').toFormat("dd/MM 'às' HH:mm")
  const lines = [
    `Oi ${input.userName} ${input.userEmoji}!`,
    `📢 Rodada ${input.roundNumber} aberta — ${input.homeTeam} x ${input.awayTeam} 🔥`,
    `⏰ Início: ${kickoff}`,
    '',
    `Manda o palpite aqui no privado. Ex: 2x1 ${input.homeTeam}`,
  ]
  if ((input.pointsMultiplier ?? 1) > 1) {
    lines.splice(1, 0, DOUBLE_POINTS_HEADER)
  }
  return lines.join('\n')
}
