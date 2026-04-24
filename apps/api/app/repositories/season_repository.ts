import { inject } from '@adonisjs/core'
import Season from '#models/season'
import BaseRepository from '#repositories/base_repository'

@inject()
export default class SeasonRepository extends BaseRepository<typeof Season> {
  protected model = Season

  list() {
    return Season.query().orderBy('year', 'desc')
  }

  listActive() {
    return Season.query().where('is_active', true)
  }
}
