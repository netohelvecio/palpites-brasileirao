import { inject } from '@adonisjs/core'
import { DateTime } from 'luxon'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import RoundMatchCandidate from '#models/round_match_candidate'
import BaseRepository from '#repositories/base_repository'
import type { TieCandidate } from '#services/featured_match_picker'

@inject()
export default class RoundCandidateRepository extends BaseRepository<typeof RoundMatchCandidate> {
  protected model = RoundMatchCandidate

  list(roundId: string) {
    return RoundMatchCandidate.query().where('round_id', roundId).orderBy('position', 'asc')
  }

  findByRoundAndPosition(roundId: string, position: number) {
    return RoundMatchCandidate.query()
      .where('round_id', roundId)
      .where('position', position)
      .first()
  }

  async bulkCreate(
    roundId: string,
    candidates: TieCandidate[],
    trx?: TransactionClientContract
  ): Promise<void> {
    const rows = candidates.map((c) => ({
      roundId,
      externalId: c.match.externalId,
      homeTeam: c.match.homeTeamName,
      awayTeam: c.match.awayTeamName,
      kickoffAt: DateTime.fromJSDate(c.match.kickoffAt),
      pointsSum: c.pointsSum,
      position: c.position,
      pollMessageId: null,
    }))
    await RoundMatchCandidate.createMany(rows, { client: trx })
  }

  async markPollSent(roundId: string, messageId: string): Promise<void> {
    await RoundMatchCandidate.query()
      .where('round_id', roundId)
      .update({ poll_message_id: messageId })
  }

  async softDeleteAllByRound(roundId: string, trx?: TransactionClientContract): Promise<void> {
    const query = RoundMatchCandidate.query({ client: trx }).where('round_id', roundId)
    await query.update({ is_deleted: true })
  }
}
