import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import MatchRepository from '#repositories/match_repository'
import RoundRepository from '#repositories/round_repository'
import { upsertMatchValidator } from '#validators/match_validator'

@inject()
export default class MatchesController {
  constructor(
    private matchRepository: MatchRepository,
    private roundRepository: RoundRepository
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
    // Stub: implementação real da API-Football vem no Plano 2.
    return response.accepted({
      message: 'refresh será implementado no plano 2',
      roundId: params.roundId,
    })
  }
}
