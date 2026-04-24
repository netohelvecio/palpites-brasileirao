import type {
  FootballDataMatch,
  FootballDataStandingsResponse,
} from '#integrations/football_data/types'

export class FakeFootballDataClient {
  public standings: FootballDataStandingsResponse | null = null
  public matchesByMatchday = new Map<string, FootballDataMatch[]>()
  public matchById = new Map<number, FootballDataMatch>()

  async fetchStandings(_competitionCode: string) {
    if (!this.standings) throw new Error('FakeFootballDataClient: standings não setado')
    return this.standings
  }

  async fetchMatchesByMatchday(_code: string, season: number, matchday: number) {
    return this.matchesByMatchday.get(`${season}:${matchday}`) ?? []
  }

  async fetchMatchById(id: number) {
    return this.matchById.get(id) ?? null
  }
}

export function fakeStandings(
  currentMatchday: number,
  year: number,
  pointsByTeamId: Record<number, number>
): FootballDataStandingsResponse {
  return {
    competition: { id: 2013, name: 'Brasileirão', code: 'BSA' },
    season: {
      id: 1,
      startDate: `${year}-04-12`,
      endDate: `${year}-12-08`,
      currentMatchday,
      winner: null,
    },
    standings: [
      {
        stage: 'REGULAR_SEASON',
        type: 'TOTAL',
        group: null,
        table: Object.entries(pointsByTeamId).map(([id, points], idx) => ({
          position: idx + 1,
          team: { id: Number(id), name: `Team${id}` },
          points,
          playedGames: Math.max(0, currentMatchday - 1),
        })),
      },
    ],
  }
}

export function fakeMatch(
  id: number,
  homeId: number,
  awayId: number,
  matchday: number,
  overrides?: Partial<FootballDataMatch>
): FootballDataMatch {
  return {
    id,
    utcDate: '2026-05-04T20:00:00Z',
    status: 'SCHEDULED',
    matchday,
    homeTeam: { id: homeId, name: `Team${homeId}` },
    awayTeam: { id: awayId, name: `Team${awayId}` },
    score: { fullTime: { home: null, away: null }, winner: null },
    ...overrides,
  }
}
