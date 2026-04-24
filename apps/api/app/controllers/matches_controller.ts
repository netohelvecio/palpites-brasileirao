import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import MatchRepository from '#repositories/match_repository'
import RoundRepository from '#repositories/round_repository'
import RefreshMatchService from '#services/refresh_match_service'
import { upsertMatchValidator } from '#validators/match_validator'

@inject()
export default class MatchesController {
  constructor(
    private matchRepository: MatchRepository,
    private roundRepository: RoundRepository,
    private refreshMatchService: RefreshMatchService
  ) {}

  async show({ params, response }: HttpContext) {
    const match = await this.matchRepository.findByRoundId(params.roundId)
    if (!match) return response.notFound({ error: 'match not found' })
    return response.ok(match)
  }

  async upsert({ params, request, response }: HttpContext) {
    const round = await this.roundRepository.findByIdOrFail(params.roundId)
    const payload = await request.validateUsing(upsertMatchValidator)

    const existing = await this.matchRepository.findByRoundId(round.id)
    if (existing) {
      await this.matchRepository.update(existing, {
        ...payload,
        status: 'scheduled',
        homeScore: null,
        awayScore: null,
      })
      return response.ok(existing)
    }

    const match = await this.matchRepository.create({
      roundId: round.id,
      ...payload,
      status: 'scheduled',
    })
    return response.ok(match)
  }

  async refreshScore({ params, response }: HttpContext) {
    const match = await this.matchRepository.findByRoundId(params.roundId)
    if (!match) return response.notFound({ error: 'match not found' })
    const report = await this.refreshMatchService.refresh(match.id)
    return response.ok(report)
  }
}
