import { inject } from '@adonisjs/core'
import { DateTime } from 'luxon'
import Round from '#models/round'
import BaseRepository from '#repositories/base_repository'

@inject()
export default class RoundRepository extends BaseRepository<typeof Round> {
  protected model = Round

  listBySeason(seasonId: string) {
    return Round.query().where('season_id', seasonId).orderBy('number', 'asc')
  }

  findBySeasonAndNumber(seasonId: string, number: number) {
    return Round.query().where('season_id', seasonId).where('number', number).first()
  }

  findByIdWithMatchAndGuesses(id: string) {
    return Round.query()
      .where('id', id)
      .preload('match', (m) => m.preload('guesses'))
      .firstOrFail()
  }

  listOpenPastKickoff(date: DateTime) {
    return Round.query()
      .where('status', 'open')
      .whereHas('match', (m) => {
        m.where('kickoff_at', '<=', date.toJSDate())
      })
      .preload('match')
  }
}
