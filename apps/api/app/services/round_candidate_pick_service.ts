import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import { MatchStatus, RoundStatus } from '@palpites/shared'
import type Match from '#models/match'
import MatchRepository from '#repositories/match_repository'
import RoundRepository from '#repositories/round_repository'
import RoundCandidateRepository from '#repositories/round_candidate_repository'

export type PickFailureReason = 'round_not_found' | 'wrong_status' | 'candidate_not_found'

export type PickOutcome = { ok: true; match: Match } | { ok: false; reason: PickFailureReason }

@inject()
export default class RoundCandidatePickService {
  constructor(
    private roundRepository: RoundRepository,
    private matchRepository: MatchRepository,
    private roundCandidateRepository: RoundCandidateRepository
  ) {}

  /**
   * Carrega round (forUpdate, pra serializar com outros picks concorrentes) e
   * candidato dentro da transação, valida invariantes de domínio (status
   * awaiting_pick, candidato pertence à round) e, se OK, cria o match, flipa
   * status pra pending e soft-deleta candidatos. Próximo tick do OpenRoundJob
   * vê pending+match e abre normalmente.
   */
  async pick(roundId: string, candidateId: string): Promise<PickOutcome> {
    return db.transaction(async (trx) => {
      const round = await this.roundRepository.findByIdForUpdate(roundId, trx)
      if (!round) return { ok: false, reason: 'round_not_found' }
      if (round.status !== RoundStatus.AWAITING_PICK) {
        return { ok: false, reason: 'wrong_status' }
      }

      const candidate = await this.roundCandidateRepository.findByIdInRound(
        candidateId,
        roundId,
        trx
      )
      if (!candidate) return { ok: false, reason: 'candidate_not_found' }

      const match = await this.matchRepository.create(
        {
          roundId: round.id,
          externalId: candidate.externalId,
          homeTeam: candidate.homeTeam,
          awayTeam: candidate.awayTeam,
          kickoffAt: candidate.kickoffAt,
          status: MatchStatus.SCHEDULED,
          pointsMultiplier: 1,
        },
        trx
      )
      await this.roundRepository.update(round, { status: RoundStatus.PENDING }, trx)
      await this.roundCandidateRepository.softDeleteAllByRound(round.id, trx)
      return { ok: true, match }
    })
  }
}
