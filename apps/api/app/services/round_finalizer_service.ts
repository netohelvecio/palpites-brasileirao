import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import { calculatePoints } from '#services/guess_scoring_service'
import GuessRepository from '#repositories/guess_repository'
import MatchRepository from '#repositories/match_repository'
import RoundRepository from '#repositories/round_repository'
import ScoreRepository from '#repositories/score_repository'

@inject()
export default class RoundFinalizerService {
  constructor(
    private roundRepository: RoundRepository,
    private matchRepository: MatchRepository,
    private guessRepository: GuessRepository,
    private scoreRepository: ScoreRepository
  ) {}

  async finalize(roundId: string): Promise<void> {
    const round = await this.roundRepository.findByIdOrFail(roundId)
    const match = await this.matchRepository.findByRoundId(round.id)
    if (!match || match.status !== 'finished') {
      throw new Error('match não finalizado — não é possível finalizar o round')
    }
    if (match.homeScore === null || match.awayScore === null) {
      throw new Error('match finalizado mas sem placar — bug no provider/refresh')
    }

    const final = { finalHome: match.homeScore, finalAway: match.awayScore }
    const guesses = await this.guessRepository.listByMatchId(match.id)

    await db.transaction(async (trx) => {
      const affectedUserIds = new Set<string>()
      for (const guess of guesses) {
        const points = calculatePoints(
          { guessHome: guess.homeScore, guessAway: guess.awayScore },
          final
        )
        await this.guessRepository.update(guess, { points }, trx)
        affectedUserIds.add(guess.userId)
      }

      const seasonId = round.seasonId
      for (const userId of affectedUserIds) {
        const userGuesses = await this.guessRepository.listBySeasonAndUser(seasonId, userId)
        const totalPoints = userGuesses.reduce((acc, g) => acc + (g.points ?? 0), 0)
        const exactScoresCount = userGuesses.filter((g) => g.points === 3).length
        await this.scoreRepository.upsert(userId, seasonId, { totalPoints, exactScoresCount }, trx)
      }

      await this.roundRepository.update(round, { status: 'finished' }, trx)
    })
  }
}
