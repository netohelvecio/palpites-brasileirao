import { test } from '@japa/runner'
import { sortRanking } from '#services/ranking_service'

test.group('RankingService', () => {
  test('ordena por pontos desc', ({ assert }) => {
    const r = sortRanking([
      { userId: 'a', name: 'A', emoji: '⚽', totalPoints: 10, exactScoresCount: 1 },
      { userId: 'b', name: 'B', emoji: '🐍', totalPoints: 20, exactScoresCount: 0 },
    ])
    assert.deepEqual(
      r.map((e) => e.userId),
      ['b', 'a']
    )
  })

  test('desempate por exactScoresCount desc', ({ assert }) => {
    const r = sortRanking([
      { userId: 'a', name: 'A', emoji: '⚽', totalPoints: 10, exactScoresCount: 1 },
      { userId: 'b', name: 'B', emoji: '🐍', totalPoints: 10, exactScoresCount: 3 },
    ])
    assert.deepEqual(
      r.map((e) => e.userId),
      ['b', 'a']
    )
  })

  test('estabilidade em empate total', ({ assert }) => {
    const r = sortRanking([
      { userId: 'a', name: 'A', emoji: '⚽', totalPoints: 10, exactScoresCount: 1 },
      { userId: 'b', name: 'B', emoji: '🐍', totalPoints: 10, exactScoresCount: 1 },
    ])
    assert.deepEqual(
      r.map((e) => e.userId),
      ['a', 'b']
    )
  })
})
