import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import { MatchStatus, RoundStatus } from '@palpites/shared'
import type Match from '#models/match'
import MatchRepository from '#repositories/match_repository'
import RoundRepository from '#repositories/round_repository'
import RoundCandidateRepository from '#repositories/round_candidate_repository'
import RefreshMatchService from '#services/refresh_match_service'
import { presentMatch } from '#presenters/match_presenter'
import { upsertMatchValidator } from '#validators/match_validator'

@inject()
export default class MatchesController {
  constructor(
    private matchRepository: MatchRepository,
    private roundRepository: RoundRepository,
    private refreshMatchService: RefreshMatchService,
    private roundCandidateRepository: RoundCandidateRepository
  ) {}

  async show({ params, response }: HttpContext) {
    const match = await this.matchRepository.findByRoundId(params.roundId)
    if (!match) return response.notFound({ error: 'match not found' })
    return response.ok(presentMatch(match))
  }

  async upsert({ params, request, response }: HttpContext) {
    const round = await this.roundRepository.findByIdOrFail(params.roundId)
    const payload = await request.validateUsing(upsertMatchValidator)
    const pointsMultiplier = payload.pointsMultiplier ?? 1

    const result = await db.transaction(async (trx) => {
      const existing = await this.matchRepository.findByRoundId(round.id)

      let match: Match
      if (existing) {
        match = await this.matchRepository.update(
          existing,
          {
            externalId: payload.externalId,
            homeTeam: payload.homeTeam,
            awayTeam: payload.awayTeam,
            kickoffAt: payload.kickoffAt,
            status: MatchStatus.SCHEDULED,
            homeScore: null,
            awayScore: null,
            pointsMultiplier,
          },
          trx
        )
      } else {
        match = await this.matchRepository.create(
          {
            roundId: round.id,
            externalId: payload.externalId,
            homeTeam: payload.homeTeam,
            awayTeam: payload.awayTeam,
            kickoffAt: payload.kickoffAt,
            status: MatchStatus.SCHEDULED,
            pointsMultiplier,
          },
          trx
        )
      }

      if (round.status === RoundStatus.AWAITING_PICK) {
        await this.roundRepository.update(round, { status: RoundStatus.PENDING }, trx)
        await this.roundCandidateRepository.softDeleteAllByRound(round.id, trx)
      }

      return match
    })

    return response.ok(presentMatch(result))
  }

  async refreshScore({ params, response }: HttpContext) {
    const match = await this.matchRepository.findByRoundId(params.roundId)
    if (!match) return response.notFound({ error: 'match not found' })
    const report = await this.refreshMatchService.refresh(match.id)
    return response.ok(report)
  }
}
