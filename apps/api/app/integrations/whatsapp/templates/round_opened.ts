import type { DateTime } from 'luxon'

export interface RoundOpenedInput {
  roundNumber: number
  homeTeam: string
  awayTeam: string
  kickoffAt: DateTime
  pointsMultiplier?: number
}

const DOUBLE_POINTS_HEADER = '🔥 *RODADA VALENDO EM DOBRO!* (1º × 2º na tabela)'

export function roundOpenedMessage(input: RoundOpenedInput): string {
  const kickoff = input.kickoffAt.setZone('America/Sao_Paulo').toFormat("dd/MM 'às' HH:mm")
  const lines = [
    `📢 Rodada ${input.roundNumber} aberta! 🔥`,
    `⚽ Jogo: ${input.homeTeam} x ${input.awayTeam}`,
    `⏰ Início: ${kickoff}`,
  ]
  if ((input.pointsMultiplier ?? 1) > 1) {
    lines.unshift(DOUBLE_POINTS_HEADER)
  }
  return lines.join('\n')
}
