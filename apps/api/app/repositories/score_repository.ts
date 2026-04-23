import { inject } from '@adonisjs/core'
import Score from '#models/score'
import BaseRepository from '#repositories/base_repository'

@inject()
export default class ScoreRepository extends BaseRepository<typeof Score> {
  protected model = Score

  listBySeasonWithUser(seasonId: string) {
    return Score.query().where('season_id', seasonId).preload('user')
  }
}
