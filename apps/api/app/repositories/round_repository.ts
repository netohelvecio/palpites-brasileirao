import { inject } from '@adonisjs/core'
import Round from '#models/round'
import BaseRepository from '#repositories/base_repository'

@inject()
export default class RoundRepository extends BaseRepository<typeof Round> {
  protected model = Round

  listBySeason(seasonId: string) {
    return Round.query().where('season_id', seasonId).orderBy('number', 'asc')
  }

  findByIdWithMatchAndGuesses(id: string) {
    return Round.query()
      .where('id', id)
      .preload('match', (m) => m.preload('guesses'))
      .firstOrFail()
  }
}
