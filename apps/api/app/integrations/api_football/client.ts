import axios, { type AxiosInstance } from 'axios'
import env from '#start/env'
import type {
  ApiFootballEnvelope,
  ApiFootballFixture,
  ApiFootballStandingsResponse,
} from './types.js'

export class ApiFootballError extends Error {
  constructor(
    public status: number,
    public body: unknown,
    message: string
  ) {
    super(message)
    this.name = 'ApiFootballError'
  }
}

export default class ApiFootballClient {
  private http: AxiosInstance

  constructor() {
    this.http = axios.create({
      baseURL: env.get('API_FOOTBALL_BASE_URL'),
      timeout: 15_000,
      headers: {
        'x-apisports-key': env.get('API_FOOTBALL_KEY') ?? '',
      },
    })
  }

  async fetchFixturesByRound(
    leagueId: number,
    season: number,
    roundLabel: string
  ): Promise<ApiFootballFixture[]> {
    return this.get<ApiFootballFixture>('/fixtures', {
      league: leagueId,
      season,
      round: roundLabel,
    })
  }

  async fetchFixtureById(fixtureId: number): Promise<ApiFootballFixture | null> {
    const rows = await this.get<ApiFootballFixture>('/fixtures', { id: fixtureId })
    return rows[0] ?? null
  }

  async fetchStandings(leagueId: number, season: number): Promise<ApiFootballStandingsResponse[]> {
    return this.get<ApiFootballStandingsResponse>('/standings', {
      league: leagueId,
      season,
    })
  }

  private async get<T>(path: string, params: Record<string, unknown>): Promise<T[]> {
    try {
      const res = await this.http.get<ApiFootballEnvelope<T>>(path, { params })
      return res.data.response ?? []
    } catch (err) {
      if (axios.isAxiosError(err)) {
        throw new ApiFootballError(
          err.response?.status ?? 0,
          err.response?.data,
          `API-Football ${path} failed: ${err.message}`
        )
      }
      throw err
    }
  }
}
