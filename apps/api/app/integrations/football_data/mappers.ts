import type { FixtureCandidate, StandingEntry } from '#services/featured_match_picker'
import type { FootballDataMatch, FootballDataStandingsResponse } from './types.js'

export function toFixtureCandidate(m: FootballDataMatch): FixtureCandidate {
  return {
    externalId: m.id,
    homeTeamId: m.homeTeam.id,
    homeTeamName: m.homeTeam.shortName,
    awayTeamId: m.awayTeam.id,
    awayTeamName: m.awayTeam.shortName,
    kickoffAt: new Date(m.utcDate),
  }
}

export function flattenStandings(res: FootballDataStandingsResponse): StandingEntry[] {
  const total = res.standings.find((s) => s.type === 'TOTAL')
  if (!total) return []
  return total.table.map((e) => ({ teamId: e.team.id, points: e.points }))
}

export function extractCurrentMatchday(res: FootballDataStandingsResponse): number {
  return res.season.currentMatchday
}

export function extractSeasonYear(res: FootballDataStandingsResponse): number {
  return new Date(res.season.startDate).getUTCFullYear()
}
