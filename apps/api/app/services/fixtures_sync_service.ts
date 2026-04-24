import { inject } from '@adonisjs/core'
import { DateTime } from 'luxon'
import type { MatchView } from '@palpites/shared'
import FootballDataClient from '#integrations/football_data/client'
import {
  toFixtureCandidate,
  flattenStandings,
  extractCurrentMatchday,
  extractSeasonYear,
} from '#integrations/football_data/mappers'
import { pickFeaturedMatch } from '#services/featured_match_picker'
import { presentMatch } from '#presenters/match_presenter'
import MatchRepository from '#repositories/match_repository'
import RoundRepository from '#repositories/round_repository'
import SeasonRepository from '#repositories/season_repository'

export interface SyncReport {
  seasonId: string
  currentMatchday: number
  created: boolean
  skipped: boolean
  reason?: string
  match?: MatchView
}

@inject()
export default class FixturesSyncService {
  constructor(
    private client: FootballDataClient,
    private seasonRepository: SeasonRepository,
    private roundRepository: RoundRepository,
    private matchRepository: MatchRepository
  ) {}

  async syncCurrentMatchday(seasonId: string): Promise<SyncReport> {
    const season = await this.seasonRepository.findByIdOrFail(seasonId)

    const standingsRes = await this.client.fetchStandings(season.externalCompetitionCode)
    const currentMatchday = extractCurrentMatchday(standingsRes)
    const year = extractSeasonYear(standingsRes)

    let round = await this.roundRepository.findBySeasonAndNumber(seasonId, currentMatchday)
    if (!round) {
      round = await this.roundRepository.create({
        seasonId,
        number: currentMatchday,
        status: 'pending',
      })
    }

    const existing = await this.matchRepository.findByRoundId(round.id)
    if (existing) {
      return {
        seasonId,
        currentMatchday,
        created: false,
        skipped: true,
        reason: 'round já possui match',
        match: presentMatch(existing),
      }
    }

    const matches = await this.client.fetchMatchesByMatchday(
      season.externalCompetitionCode,
      year,
      currentMatchday
    )
    const candidates = matches.map(toFixtureCandidate)
    const standings = flattenStandings(standingsRes)
    const pick = pickFeaturedMatch(candidates, standings)

    if (!pick.ok) {
      return {
        seasonId,
        currentMatchday,
        created: false,
        skipped: false,
        reason: pick.reason,
      }
    }

    const created = await this.matchRepository.create({
      roundId: round.id,
      externalId: pick.match.externalId,
      homeTeam: pick.match.homeTeamName,
      awayTeam: pick.match.awayTeamName,
      kickoffAt: DateTime.fromJSDate(pick.match.kickoffAt),
      status: 'scheduled',
    })

    return {
      seasonId,
      currentMatchday,
      created: true,
      skipped: false,
      match: presentMatch(created),
    }
  }
}
