import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import ScoreRepository from '#repositories/score_repository'
import MatchRepository from '#repositories/match_repository'
import GuessRepository from '#repositories/guess_repository'
import { sortRanking, type RankingEntry } from '#services/ranking_service'

@inject()
export default class RankingController {
  constructor(
    private scoreRepository: ScoreRepository,
    private matchRepository: MatchRepository,
    private guessRepository: GuessRepository
  ) {}

  async bySeason({ params, response }: HttpContext) {
    const scores = await this.scoreRepository.listBySeasonWithUser(params.seasonId)
    const entries: RankingEntry[] = scores.map((s) => ({
      userId: s.userId,
      name: s.user.name,
      emoji: s.user.emoji,
      totalPoints: s.totalPoints,
      exactScoresCount: s.exactScoresCount,
    }))
    return response.ok(sortRanking(entries))
  }

  async byRound({ params, response }: HttpContext) {
    const match = await this.matchRepository.findByRoundId(params.roundId)
    if (!match) return response.ok([])
    const guesses = await this.guessRepository.listByMatchId(match.id)
    const rows = guesses
      .map((g) => ({
        userId: g.userId,
        name: g.user.name,
        emoji: g.user.emoji,
        points: g.points ?? 0,
      }))
      .sort((a, b) => b.points - a.points)
    return response.ok(rows)
  }
}
