import type { MatchCandidateView } from '@palpites/shared'
import type RoundMatchCandidate from '#models/round_match_candidate'

export function presentMatchCandidate(c: RoundMatchCandidate): MatchCandidateView {
  return {
    id: c.id,
    externalId: c.externalId,
    homeTeam: c.homeTeam,
    awayTeam: c.awayTeam,
    kickoffAt: c.kickoffAt.toISO()!,
    pointsSum: c.pointsSum,
    position: c.position,
  }
}
