import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import { MatchStatus, RoundStatus } from '@palpites/shared'
import { calculatePoints } from '#services/guess_scoring_service'
import { sortRanking, type RankingEntry } from '#services/ranking_service'
import GuessRepository from '#repositories/guess_repository'
import MatchRepository from '#repositories/match_repository'
import RoundRepository from '#repositories/round_repository'
import ScoreRepository from '#repositories/score_repository'
import type Match from '#models/match'
import type Round from '#models/round'
import type { RoundScoreEntry } from '#integrations/whatsapp/templates/types'

export interface FinalizePreview {
  pointsMultiplier: number
  roundScores: RoundScoreEntry[]
  seasonRanking: RankingEntry[]
}

@inject()
export default class RoundFinalizerService {
  constructor(
    private roundRepository: RoundRepository,
    private matchRepository: MatchRepository,
    private guessRepository: GuessRepository,
    private scoreRepository: ScoreRepository
  ) {}

  async previewFinalize(roundId: string): Promise<FinalizePreview> {
    const { round, match } = await this.loadFinishedContext(roundId)
    const final = { finalHome: match.homeScore!, finalAway: match.awayScore! }
    const multiplier = match.pointsMultiplier
    const guesses = await this.guessRepository.listByMatchId(match.id)

    const scoredGuesses = guesses.map((g) => ({
      guess: g,
      result: calculatePoints(
        { guessHome: g.homeScore, guessAway: g.awayScore },
        final,
        multiplier
      ),
    }))

    const roundScores: RoundScoreEntry[] = scoredGuesses
      .map(({ guess, result }) => ({
        userId: guess.userId,
        name: guess.user.name,
        emoji: guess.user.emoji,
        points: result.points,
      }))
      .sort((a, b) => b.points - a.points)

    const seasonId = round.seasonId
    const currentScores = await this.scoreRepository.listBySeasonWithUser(seasonId)
    const userIdsInRound = new Set(scoredGuesses.map((s) => s.guess.userId))

    const ranking: RankingEntry[] = []
    for (const { guess, result } of scoredGuesses) {
      const userGuesses = await this.guessRepository.listBySeasonAndUser(seasonId, guess.userId)
      let guessPoints = 0
      let guessExact = 0
      for (const ug of userGuesses) {
        if (ug.id === guess.id) {
          guessPoints += result.points
          guessExact += result.isExact ? 1 : 0
        } else {
          guessPoints += ug.points ?? 0
          guessExact += ug.isExact === true ? 1 : 0
        }
      }

      const existing = await this.scoreRepository.findByUserAndSeason(guess.userId, seasonId)
      ranking.push({
        userId: guess.userId,
        name: guess.user.name,
        emoji: guess.user.emoji,
        totalPoints: (existing?.baselinePoints ?? 0) + guessPoints,
        exactScoresCount: (existing?.baselineExactScoresCount ?? 0) + guessExact,
      })
    }

    for (const score of currentScores) {
      if (userIdsInRound.has(score.userId)) continue
      ranking.push({
        userId: score.userId,
        name: score.user.name,
        emoji: score.user.emoji,
        totalPoints: score.totalPoints,
        exactScoresCount: score.exactScoresCount,
      })
    }

    return {
      pointsMultiplier: multiplier,
      roundScores,
      seasonRanking: sortRanking(ranking),
    }
  }

  async finalize(roundId: string): Promise<void> {
    const { round, match } = await this.loadFinishedContext(roundId)
    const final = { finalHome: match.homeScore!, finalAway: match.awayScore! }
    const multiplier = match.pointsMultiplier
    const guesses = await this.guessRepository.listByMatchId(match.id)

    await db.transaction(async (trx) => {
      const affectedUserIds = new Set<string>()
      for (const guess of guesses) {
        const { points, isExact } = calculatePoints(
          { guessHome: guess.homeScore, guessAway: guess.awayScore },
          final,
          multiplier
        )
        await this.guessRepository.update(guess, { points, isExact }, trx)
        affectedUserIds.add(guess.userId)
      }

      const seasonId = round.seasonId
      for (const userId of affectedUserIds) {
        const userGuesses = await this.guessRepository.listBySeasonAndUser(seasonId, userId, trx)
        const guessPoints = userGuesses.reduce((acc, g) => acc + (g.points ?? 0), 0)
        const guessExact = userGuesses.filter((g) => g.isExact === true).length

        const existing = await this.scoreRepository.findByUserAndSeason(userId, seasonId, trx)
        const totalPoints = (existing?.baselinePoints ?? 0) + guessPoints
        const exactScoresCount = (existing?.baselineExactScoresCount ?? 0) + guessExact

        await this.scoreRepository.upsert(userId, seasonId, { totalPoints, exactScoresCount }, trx)
      }

      await this.roundRepository.update(round, { status: RoundStatus.FINISHED }, trx)
    })
  }

  private async loadFinishedContext(roundId: string): Promise<{ round: Round; match: Match }> {
    const round = await this.roundRepository.findByIdOrFail(roundId)
    const match = await this.matchRepository.findByRoundId(round.id)
    if (!match || match.status !== MatchStatus.FINISHED) {
      throw new Error('match não finalizado — não é possível finalizar o round')
    }
    if (match.homeScore === null || match.awayScore === null) {
      throw new Error('match finalizado mas sem placar — bug no provider/refresh')
    }
    return { round, match }
  }
}
