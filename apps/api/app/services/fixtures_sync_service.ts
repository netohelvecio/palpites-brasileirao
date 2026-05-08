import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import {
  MatchStatus,
  PickKind,
  RoundStatus,
  type MatchCandidateView,
  type MatchView,
} from '@palpites/shared'
import FootballDataClient from '#integrations/football_data/client'
import {
  toFixtureCandidate,
  flattenStandings,
  extractCurrentMatchday,
  extractSeasonYear,
} from '#integrations/football_data/mappers'
import { pickFeaturedMatch } from '#services/featured_match_picker'
import { presentMatch } from '#presenters/match_presenter'
import { presentMatchCandidate } from '#presenters/match_candidate_presenter'
import MatchRepository from '#repositories/match_repository'
import RoundRepository from '#repositories/round_repository'
import RoundCandidateRepository from '#repositories/round_candidate_repository'
import SeasonRepository from '#repositories/season_repository'

export interface SyncReport {
  seasonId: string
  currentMatchday: number
  created: boolean
  skipped: boolean
  reason?: string
  match?: MatchView
  candidates?: MatchCandidateView[]
}

@inject()
export default class FixturesSyncService {
  constructor(
    private client: FootballDataClient,
    private seasonRepository: SeasonRepository,
    private roundRepository: RoundRepository,
    private matchRepository: MatchRepository,
    private roundCandidateRepository: RoundCandidateRepository
  ) {}

  async syncCurrentMatchday(seasonId: string): Promise<SyncReport> {
    const season = await this.seasonRepository.findByIdOrFail(seasonId)

    const standingsRes = await this.client.fetchStandings(season.externalCompetitionCode)
    const currentMatchday = extractCurrentMatchday(standingsRes)
    const year = extractSeasonYear(standingsRes)

    const existingRound = await this.roundRepository.findBySeasonAndNumber(
      seasonId,
      currentMatchday
    )

    if (existingRound?.status === RoundStatus.AWAITING_PICK) {
      const candidates = await this.roundCandidateRepository.list(existingRound.id)
      return {
        seasonId,
        currentMatchday,
        created: false,
        skipped: true,
        reason: 'awaiting admin pick',
        candidates: candidates.map(presentMatchCandidate),
      }
    }

    if (existingRound) {
      const existingMatch = await this.matchRepository.findByRoundId(existingRound.id)
      if (existingMatch) {
        return {
          seasonId,
          currentMatchday,
          created: false,
          skipped: true,
          reason: 'round já possui match',
          match: presentMatch(existingMatch),
        }
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

    if (pick.kind === PickKind.UNIQUE) {
      const created = await db.transaction(async (trx) => {
        const round =
          existingRound ??
          (await this.roundRepository.create(
            { seasonId, number: currentMatchday, status: RoundStatus.PENDING },
            trx
          ))

        return this.matchRepository.create(
          {
            roundId: round.id,
            externalId: pick.match.externalId,
            homeTeam: pick.match.homeTeamName,
            awayTeam: pick.match.awayTeamName,
            kickoffAt: DateTime.fromJSDate(pick.match.kickoffAt),
            status: MatchStatus.SCHEDULED,
            pointsMultiplier: pick.pointsMultiplier,
          },
          trx
        )
      })

      return {
        seasonId,
        currentMatchday,
        created: true,
        skipped: false,
        match: presentMatch(created),
      }
    }

    // pick.kind === PickKind.TIE
    await db.transaction(async (trx) => {
      let round = existingRound
      if (!round) {
        round = await this.roundRepository.create(
          { seasonId, number: currentMatchday, status: RoundStatus.AWAITING_PICK },
          trx
        )
      } else if (round.status === RoundStatus.PENDING) {
        await this.roundRepository.update(round, { status: RoundStatus.AWAITING_PICK }, trx)
      }
      await this.roundCandidateRepository.bulkCreate(round.id, pick.candidates, trx)
    })

    const round = await this.roundRepository.findBySeasonAndNumber(seasonId, currentMatchday)
    const persisted = await this.roundCandidateRepository.list(round!.id)
    return {
      seasonId,
      currentMatchday,
      created: false,
      skipped: false,
      reason: 'awaiting admin pick',
      candidates: persisted.map(presentMatchCandidate),
    }
  }
}
