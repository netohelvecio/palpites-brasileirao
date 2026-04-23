/**
 * Subconjunto do payload da API-Football que consumimos.
 * Docs: https://www.api-football.com/documentation-v3
 */

export interface ApiFootballEnvelope<T> {
  errors?: unknown
  results: number
  response: T[]
}

export interface ApiFootballFixture {
  fixture: {
    id: number
    date: string
    status: {
      short: ApiFootballFixtureStatus
      long: string
    }
  }
  league: {
    id: number
    season: number
    round: string
  }
  teams: {
    home: { id: number; name: string }
    away: { id: number; name: string }
  }
  goals: {
    home: number | null
    away: number | null
  }
}

export type ApiFootballFixtureStatus =
  // Scheduled-ish
  | 'TBD'
  | 'NS'
  | 'PST'
  | 'CANC'
  | 'ABD'
  | 'AWD'
  | 'WO'
  // Live-ish
  | '1H'
  | 'HT'
  | '2H'
  | 'ET'
  | 'BT'
  | 'P'
  | 'SUSP'
  | 'INT'
  | 'LIVE'
  // Finished
  | 'FT'
  | 'AET'
  | 'PEN'

export interface ApiFootballStandingEntry {
  rank: number
  team: { id: number; name: string }
  points: number
}

export interface ApiFootballStandingsResponse {
  league: {
    id: number
    season: number
    standings: ApiFootballStandingEntry[][]
  }
}
