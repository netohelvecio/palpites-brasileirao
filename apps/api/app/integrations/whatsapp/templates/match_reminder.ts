import type { DateTime } from 'luxon'

export interface MatchReminderInput {
  homeTeam: string
  awayTeam: string
  kickoffAt: DateTime
}

export function matchReminderMessage(input: MatchReminderInput): string {
  const kickoff = input.kickoffAt.setZone('America/Sao_Paulo').toFormat('HH:mm')
  return [
    `⏰ Faltam 30 min!`,
    `⚽ ${input.homeTeam} x ${input.awayTeam}`,
    `🕘 Início: ${kickoff}`,
  ].join('\n')
}
