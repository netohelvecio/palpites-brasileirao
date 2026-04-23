import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import SeasonRepository from '#repositories/season_repository'
import { createSeasonValidator, updateSeasonValidator } from '#validators/season_validator'

@inject()
export default class SeasonsController {
  constructor(private seasonRepository: SeasonRepository) {}

  async store({ request, response }: HttpContext) {
    const payload = await request.validateUsing(createSeasonValidator)
    const season = await this.seasonRepository.create(payload)
    return response.created(season)
  }

  async index({ response }: HttpContext) {
    const seasons = await this.seasonRepository.list()
    return response.ok(seasons)
  }

  async update({ params, request, response }: HttpContext) {
    const season = await this.seasonRepository.findByIdOrFail(params.id)
    const payload = await request.validateUsing(updateSeasonValidator)
    await this.seasonRepository.update(season, payload)
    return response.ok(season)
  }

  async sync({ params, response }: HttpContext) {
    // Stub: implementação real da API-Football vem no Plano 2.
    return response.accepted({
      message: 'sync será implementado no plano 2',
      seasonId: params.id,
    })
  }
}
