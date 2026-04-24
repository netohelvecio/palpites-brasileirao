import { inject } from '@adonisjs/core'
import Match from '#models/match'
import BaseRepository from '#repositories/base_repository'

@inject()
export default class MatchRepository extends BaseRepository<typeof Match> {
  protected model = Match

  findByRoundId(roundId: string) {
    return Match.query().where('round_id', roundId).first()
  }

  listActiveNonFinished() {
    return Match.query()
      .whereNot('status', 'finished')
      .whereHas('round', (r) => {
        r.whereHas('season', (s) => {
          s.where('is_active', true)
        })
      })
      .preload('round')
  }
}
