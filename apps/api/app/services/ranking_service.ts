export interface RankingEntry {
  userId: string
  name: string
  emoji: string
  totalPoints: number
  exactScoresCount: number
}

export function sortRanking(entries: RankingEntry[]): RankingEntry[] {
  return [...entries].sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints
    return b.exactScoresCount - a.exactScoresCount
  })
}
