/**
 * Subconjunto do payload da football-data.org v4 que consumimos.
 * Docs: https://docs.football-data.org/general/v4/index.html
 */

export type FootballDataMatchStatus =
  | 'SCHEDULED'
  | 'TIMED'
  | 'IN_PLAY'
  | 'PAUSED'
  | 'FINISHED'
  | 'SUSPENDED'
  | 'POSTPONED'
  | 'CANCELLED'
  | 'AWARDED'

export interface FootballDataTeam {
  id: number
  name: string
  shortName: string
}

export interface FootballDataSeason {
  id: number
  startDate: string
  endDate: string
  currentMatchday: number
  winner: FootballDataTeam | null
}

export interface FootballDataStandingEntry {
  position: number
  team: FootballDataTeam
  points: number
  playedGames: number
}

export interface FootballDataStandingsResponse {
  competition: { id: number; name: string; code: string }
  season: FootballDataSeason
  standings: Array<{
    stage: string
    type: 'TOTAL' | 'HOME' | 'AWAY'
    group: string | null
    table: FootballDataStandingEntry[]
  }>
}

export interface FootballDataMatch {
  id: number
  utcDate: string
  status: FootballDataMatchStatus
  matchday: number
  homeTeam: FootballDataTeam
  awayTeam: FootballDataTeam
  score: {
    fullTime: { home: number | null; away: number | null }
    halfTime?: { home: number | null; away: number | null }
    winner: 'HOME_TEAM' | 'AWAY_TEAM' | 'DRAW' | null
  }
}

export interface FootballDataMatchesResponse {
  matches: FootballDataMatch[]
}
