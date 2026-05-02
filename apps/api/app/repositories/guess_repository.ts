import { inject } from '@adonisjs/core'
import { MatchStatus } from '@palpites/shared'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
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

  listByRound(roundId: string) {
    return Guess.query()
      .whereHas('match', (m) => {
        m.where('round_id', roundId)
      })
      .preload('user')
      .preload('match')
  }

  async upsertByUserAndMatch(
    userId: string,
    matchId: string,
    payload: { homeScore: number; awayScore: number }
  ) {
    const existing = await this.findByUserAndMatch(userId, matchId)
    if (existing) {
      existing.merge({
        homeScore: payload.homeScore,
        awayScore: payload.awayScore,
        points: null,
        isExact: null,
      })
      await existing.save()
      return existing
    }
    return Guess.create({
      userId,
      matchId,
      homeScore: payload.homeScore,
      awayScore: payload.awayScore,
      points: null,
      isExact: null,
    })
  }

  listBySeasonAndUser(seasonId: string, userId: string, trx?: TransactionClientContract) {
    return Guess.query({ client: trx })
      .where('user_id', userId)
      .whereHas('match', (m) => {
        m.where('status', MatchStatus.FINISHED).whereHas('round', (r) => {
          r.where('season_id', seasonId)
        })
      })
  }

  async softDelete(guess: Guess) {
    guess.isDeleted = true
    await guess.save()
    return guess
  }
}
