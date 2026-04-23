import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import GuessRepository from '#repositories/guess_repository'
import MatchRepository from '#repositories/match_repository'
import { createGuessValidator, updateGuessValidator } from '#validators/guess_validator'

@inject()
export default class GuessesController {
  constructor(
    private guessRepository: GuessRepository,
    private matchRepository: MatchRepository
  ) {}

  async store({ request, response }: HttpContext) {
    const payload = await request.validateUsing(createGuessValidator)

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
    if (!match) return response.ok([])
    const guesses = await this.guessRepository.listByMatchId(match.id)
    return response.ok(guesses)
  }

  async update({ params, request, response }: HttpContext) {
    const guess = await this.guessRepository.findByIdOrFail(params.id)
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
