import { inject } from '@adonisjs/core'
import { DateTime } from 'luxon'
import type { MatchView } from '@palpites/shared'
import FootballDataClient from '#integrations/football_data/client'
import MatchRepository from '#repositories/match_repository'
import { mapMatchStatus } from '#services/match_status_mapper'
import { presentMatch } from '#presenters/match_presenter'

export interface RefreshReport {
  matchId: string
  updated: boolean
  reason?: string
  match?: MatchView
}

@inject()
export default class RefreshMatchService {
  constructor(
    private client: FootballDataClient,
    private matchRepository: MatchRepository
  ) {}

  async refresh(matchId: string): Promise<RefreshReport> {
    const match = await this.matchRepository.findByIdOrFail(matchId)
    const data = await this.client.fetchMatchById(match.externalId)
    if (!data) {
      return {
        matchId,
        updated: false,
        reason: 'match não encontrado no provider',
        match: presentMatch(match),
      }
    }

    await this.matchRepository.update(match, {
      homeScore: data.score.fullTime.home,
      awayScore: data.score.fullTime.away,
      status: mapMatchStatus(data.status),
      kickoffAt: DateTime.fromISO(data.utcDate),
    })

    return { matchId, updated: true, match: presentMatch(match) }
  }
}
