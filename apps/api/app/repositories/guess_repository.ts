import { inject } from '@adonisjs/core'
import Guess from '#models/guess'
import BaseRepository from '#repositories/base_repository'

@inject()
export default class GuessRepository extends BaseRepository<typeof Guess> {
  protected model = Guess

  findByUserAndMatch(userId: string, matchId: string) {
    return Guess.query().where('user_id', userId).where('match_id', matchId).first()
  }

  listByMatchId(matchId: string) {
    return Guess.query().where('match_id', matchId).preload('user')
  }

  async softDelete(guess: Guess) {
    guess.isDeleted = true
    await guess.save()
    return guess
  }
}
