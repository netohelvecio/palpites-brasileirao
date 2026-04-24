import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import SeasonRepository from '#repositories/season_repository'
import FixturesSyncService from '#services/fixtures_sync_service'
import { createSeasonValidator, updateSeasonValidator } from '#validators/season_validator'

@inject()
export default class SeasonsController {
  constructor(
    private seasonRepository: SeasonRepository,
    private fixturesSyncService: FixturesSyncService
  ) {}

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
    const report = await this.fixturesSyncService.syncCurrentMatchday(params.id)
    return response.ok(report)
  }
}
