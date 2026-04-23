import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import GuessRepository from '#repositories/guess_repository'
import MatchRepository from '#repositories/match_repository'
import RoundRepository from '#repositories/round_repository'
import { canAcceptGuess } from '#services/betting_policy'
import { presentGuessList } from '#presenters/guess_list_presenter'
import { createGuessValidator, updateGuessValidator } from '#validators/guess_validator'

@inject()
export default class GuessesController {
  constructor(
    private guessRepository: GuessRepository,
    private matchRepository: MatchRepository,
    private roundRepository: RoundRepository
  ) {}

  private async checkBettingAllowed(matchId: string) {
    const match = await this.matchRepository.findByIdOrFail(matchId)
    const round = await this.roundRepository.findByIdOrFail(match.roundId)
    return canAcceptGuess(round, match)
  }

  async store({ request, response }: HttpContext) {
    const payload = await request.validateUsing(createGuessValidator)

    const check = await this.checkBettingAllowed(payload.matchId)
    if (!check.allowed) {
      return response.unprocessableEntity({ error: check.reason })
    }

    const existing = await this.guessRepository.findByUserAndMatch(payload.userId, payload.matchId)
    if (existing) {
      return response.unprocessableEntity({
        error: 'palpite já existe para esse usuário e jogo',
      })
    }

    const guess = await this.guessRepository.create(payload)
    return response.created(guess)
  }

  async indexByRound({ params, response }: HttpContext) {
    const match = await this.matchRepository.findByRoundId(params.roundId)
    const guesses = match ? await this.guessRepository.listByMatchId(match.id) : []
    return response.ok(presentGuessList(match, guesses))
  }

  async update({ params, request, response }: HttpContext) {
    const guess = await this.guessRepository.findByIdOrFail(params.id)

    const check = await this.checkBettingAllowed(guess.matchId)
    if (!check.allowed) {
      return response.unprocessableEntity({ error: check.reason })
    }

    const payload = await request.validateUsing(updateGuessValidator)
    await this.guessRepository.update(guess, payload)
    return response.ok(guess)
  }

  async destroy({ params, response }: HttpContext) {
    const guess = await this.guessRepository.findByIdOrFail(params.id)
    await this.guessRepository.softDelete(guess)
    return response.noContent()
  }
}
