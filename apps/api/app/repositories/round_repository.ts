import { inject } from '@adonisjs/core'
import { DateTime } from 'luxon'
import { RoundStatus } from '@palpites/shared'
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
      .where('status', RoundStatus.OPEN)
      .whereHas('match', (m) => {
        m.where('kickoff_at', '<=', date.toJSDate())
      })
      .preload('match')
  }

  findOpenInActiveSeason() {
    return Round.query()
      .where('status', RoundStatus.OPEN)
      .whereHas('season', (s) => {
        s.where('is_active', true)
      })
      .preload('match')
      .first()
  }

  listOpenWithKickoffWithin(now: DateTime, windowMinutes: number) {
    const upper = now.plus({ minutes: windowMinutes })
    return Round.query()
      .where('status', RoundStatus.OPEN)
      .whereHas('match', (m) => {
        m.where('kickoff_at', '>', now.toJSDate())
          .andWhere('kickoff_at', '<=', upper.toJSDate())
          .whereNull('reminder_30_min_sent_at')
      })
      .preload('match')
  }

  findCurrentAwaitingPickAcrossSeasons() {
    return Round.query()
      .where('status', RoundStatus.AWAITING_PICK)
      .whereHas('season', (s) => {
        s.where('is_active', true)
      })
      .orderBy('created_at', 'asc')
      .first()
  }
}
