import type { MatchView } from '@palpites/shared'
import type Match from '#models/match'

export function presentMatch(match: Match): MatchView {
  return {
    id: match.id,
    homeTeam: match.homeTeam,
    awayTeam: match.awayTeam,
    kickoffAt: match.kickoffAt.toISO()!,
    homeScore: match.homeScore,
    awayScore: match.awayScore,
    status: match.status,
    pointsMultiplier: match.pointsMultiplier,
  }
}
