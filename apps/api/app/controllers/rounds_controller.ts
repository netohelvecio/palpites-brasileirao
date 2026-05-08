import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import RoundRepository from '#repositories/round_repository'
import RoundCandidateRepository from '#repositories/round_candidate_repository'
import RoundCandidatePickService from '#services/round_candidate_pick_service'
import { presentMatch } from '#presenters/match_presenter'
import { presentMatchCandidate } from '#presenters/match_candidate_presenter'
import { updateRoundStatusValidator } from '#validators/round_validator'
import { pickCandidateValidator } from '#validators/round_candidate_validator'

@inject()
export default class RoundsController {
  constructor(
    private roundRepository: RoundRepository,
    private roundCandidateRepository: RoundCandidateRepository,
    private roundCandidatePickService: RoundCandidatePickService
  ) {}

  async indexBySeason({ params, response }: HttpContext) {
    const rounds = await this.roundRepository.listBySeason(params.seasonId)
    return response.ok(rounds)
  }

  async show({ params, response }: HttpContext) {
    const round = await this.roundRepository.findByIdWithMatchAndGuesses(params.id)
    return response.ok(round)
  }

  async updateStatus({ params, request, response }: HttpContext) {
    const round = await this.roundRepository.findByIdOrFail(params.id)
    const { status } = await request.validateUsing(updateRoundStatusValidator)
    round.status = status
    await round.save()
    return response.ok(round)
  }

  async pickCandidate({ params, request, response }: HttpContext) {
    const { candidateId } = await request.validateUsing(pickCandidateValidator)
    const result = await this.roundCandidatePickService.pick(params.id, candidateId)
    if (!result.ok) {
      if (result.reason === 'wrong_status') {
        return response.conflict({ error: 'round não está awaiting_pick' })
      }
      return response.notFound({ error: 'round ou candidato não encontrado' })
    }
    return response.ok(presentMatch(result.match))
  }

  async listMatchCandidates({ params, response }: HttpContext) {
    const round = await this.roundRepository.findByIdOrFail(params.id)
    const candidates = await this.roundCandidateRepository.list(round.id)
    return response.ok(candidates.map(presentMatchCandidate))
  }
}
