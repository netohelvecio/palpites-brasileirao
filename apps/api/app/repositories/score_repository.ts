import { inject } from '@adonisjs/core'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import Score from '#models/score'
import BaseRepository from '#repositories/base_repository'

@inject()
export default class ScoreRepository extends BaseRepository<typeof Score> {
  protected model = Score

  listBySeasonWithUser(seasonId: string) {
    return Score.query().where('season_id', seasonId).preload('user')
  }

  async upsert(
    userId: string,
    seasonId: string,
    totals: { totalPoints: number; exactScoresCount: number },
    trx?: TransactionClientContract
  ) {
    const query = Score.query({ client: trx }).where('user_id', userId).where('season_id', seasonId)
    const existing = await query.first()

    if (existing) {
      if (trx) existing.useTransaction(trx)
      existing.merge(totals)
      await existing.save()
      return existing
    }
    return Score.create({ userId, seasonId, ...totals }, { client: trx })
  }
}
