import axios, { type AxiosInstance } from 'axios'
import env from '#start/env'
import type {
  FootballDataMatch,
  FootballDataMatchesResponse,
  FootballDataStandingsResponse,
} from './types.js'

export class FootballDataError extends Error {
  constructor(
    public status: number,
    public body: unknown,
    message: string
  ) {
    super(message)
    this.name = 'FootballDataError'
  }
}

export default class FootballDataClient {
  private http: AxiosInstance

  constructor() {
    this.http = axios.create({
      baseURL: env.get('FOOTBALL_DATA_BASE_URL'),
      timeout: 15_000,
      headers: {
        'X-Auth-Token': env.get('FOOTBALL_DATA_TOKEN') ?? '',
      },
    })
  }

  async fetchStandings(competitionCode: string): Promise<FootballDataStandingsResponse> {
    return this.get<FootballDataStandingsResponse>(`/competitions/${competitionCode}/standings`)
  }

  async fetchMatchesByMatchday(
    competitionCode: string,
    season: number,
    matchday: number
  ): Promise<FootballDataMatch[]> {
    const res = await this.get<FootballDataMatchesResponse>(
      `/competitions/${competitionCode}/matches`,
      { season, matchday }
    )
    return res.matches ?? []
  }

  async fetchMatchById(matchId: number): Promise<FootballDataMatch | null> {
    try {
      return await this.get<FootballDataMatch>(`/matches/${matchId}`)
    } catch (err) {
      if (err instanceof FootballDataError && err.status === 404) return null
      throw err
    }
  }

  private async get<T>(path: string, params?: Record<string, unknown>): Promise<T> {
    try {
      const res = await this.http.get<T>(path, { params })
      return res.data
    } catch (err) {
      if (axios.isAxiosError(err)) {
        throw new FootballDataError(
          err.response?.status ?? 0,
          err.response?.data,
          `football-data ${path} failed: ${err.message}`
        )
      }
      throw err
    }
  }
}
