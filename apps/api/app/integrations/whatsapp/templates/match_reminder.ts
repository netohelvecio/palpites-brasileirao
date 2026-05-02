import type { DateTime } from 'luxon'

export interface MatchReminderInput {
  homeTeam: string
  awayTeam: string
  kickoffAt: DateTime
  pointsMultiplier?: number
}

const DOUBLE_POINTS_HEADER = '🔥 *RODADA VALENDO EM DOBRO!* (1º × 2º na tabela)'

export function matchReminderMessage(input: MatchReminderInput): string {
  const kickoff = input.kickoffAt.setZone('America/Sao_Paulo').toFormat('HH:mm')
  const lines = [
    `⏰ Faltam 30 min!`,
    `⚽ ${input.homeTeam} x ${input.awayTeam}`,
    `🕘 Início: ${kickoff}`,
  ]
  if ((input.pointsMultiplier ?? 1) > 1) {
    lines.unshift(DOUBLE_POINTS_HEADER)
  }
  return lines.join('\n')
}
