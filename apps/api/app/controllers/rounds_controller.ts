import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import RoundRepository from '#repositories/round_repository'
import { updateRoundStatusValidator } from '#validators/round_validator'

@inject()
export default class RoundsController {
  constructor(private roundRepository: RoundRepository) {}

  async indexBySeason({ params, response }: HttpContext) {
    const rounds = await this.roundRepository.listBySeason(params.seasonId)
    return response.ok(rounds)
  }

  async show({ params, response }: HttpContext) {
    const round = await this.roundRepository.findByIdWithMatchAndGuesses(params.id)
    return response.ok(round)
  }

  async updateStatus({ params, request, response }: HttpContext) {
    const round = await this.roundRepository.findByIdOrFail(params.id)
    const { status } = await request.validateUsing(updateRoundStatusValidator)
    round.status = status
    await round.save()
    return response.ok(round)
  }
}
