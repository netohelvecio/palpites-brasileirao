import type { RankingEntry } from '#services/ranking_service'
import type { RoundScoreEntry } from './types.js'

export interface MatchFinishedInput {
  roundNumber: number
  homeTeam: string
  awayTeam: string
  finalHome: number
  finalAway: number
  roundScores: RoundScoreEntry[]
  seasonRanking: RankingEntry[]
}

function ptsLabel(n: number): string {
  return n === 1 ? '1 pt' : `${n} pts`
}

function exactScoresLabel(n: number): string {
  return n === 1 ? '1 placar exato' : `${n} placares exatos`
}

export function matchFinishedMessage(input: MatchFinishedInput): string {
  const final = `🏁 Final: ${input.homeTeam} ${input.finalHome} x ${input.finalAway} ${input.awayTeam}`

  const roundLines = input.roundScores.map((e) => `${e.name} ${e.emoji} — ${ptsLabel(e.points)}`)
  const roundBlock = `Pontuação da rodada ${input.roundNumber}:\n${roundLines.join('\n')}`

  const rankingLines = input.seasonRanking.map(
    (e, idx) =>
      `${idx + 1}. ${e.name} ${e.emoji} — ${ptsLabel(e.totalPoints)} (${exactScoresLabel(e.exactScoresCount)})`
  )
  const rankingBlock = `🏆 Ranking da temporada:\n${rankingLines.join('\n')}`

  return [final, roundBlock, rankingBlock].join('\n\n')
}
