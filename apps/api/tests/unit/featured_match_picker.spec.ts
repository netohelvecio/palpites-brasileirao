import { test } from '@japa/runner'
import {
  pickFeaturedMatch,
  type FixtureCandidate,
  type StandingEntry,
} from '#services/featured_match_picker'

const STANDINGS: StandingEntry[] = [
  { teamId: 1, points: 30 },
  { teamId: 2, points: 25 },
  { teamId: 3, points: 20 },
  { teamId: 4, points: 15 },
  { teamId: 5, points: 10 },
]

function fixture(id: number, homeId: number, awayId: number): FixtureCandidate {
  return {
    externalId: id,
    homeTeamId: homeId,
    homeTeamName: `Team${homeId}`,
    awayTeamId: awayId,
    awayTeamName: `Team${awayId}`,
    kickoffAt: new Date('2026-05-04T20:00:00Z'),
  }
}

test.group('FeaturedMatchPicker — escolha do pick', () => {
  test('escolhe o confronto com maior soma de pontos dos dois times', ({ assert }) => {
    const r = pickFeaturedMatch(
      [fixture(100, 3, 4), fixture(101, 1, 2), fixture(102, 5, 1)],
      STANDINGS
    )
    assert.equal(r.ok, true)
    if (r.ok) assert.equal(r.match.externalId, 101)
  })

  test('mantém o primeiro em caso de empate total', ({ assert }) => {
    const r = pickFeaturedMatch(
      [fixture(200, 3, 4), fixture(201, 2, 3)],
      [
        { teamId: 2, points: 15 },
        { teamId: 3, points: 20 },
        { teamId: 4, points: 15 },
      ]
    )
    assert.equal(r.ok, true)
    if (r.ok) assert.equal(r.match.externalId, 200)
  })

  test('times sem registro no standings contam como 0 pts', ({ assert }) => {
    const r = pickFeaturedMatch([fixture(300, 999, 888), fixture(301, 1, 2)], STANDINGS)
    assert.equal(r.ok, true)
    if (r.ok) assert.equal(r.match.externalId, 301)
  })

  test('retorna erro quando lista de fixtures é vazia', ({ assert }) => {
    const r = pickFeaturedMatch([], STANDINGS)
    assert.equal(r.ok, false)
  })

  test('funciona com 1 fixture apenas', ({ assert }) => {
    const r = pickFeaturedMatch([fixture(400, 1, 5)], STANDINGS)
    assert.equal(r.ok, true)
    if (r.ok) assert.equal(r.match.externalId, 400)
  })

  test('standings vazio: todos contam 0, primeiro vence', ({ assert }) => {
    const r = pickFeaturedMatch([fixture(500, 1, 2), fixture(501, 3, 4)], [])
    assert.equal(r.ok, true)
    if (r.ok) assert.equal(r.match.externalId, 500)
  })
})

test.group('FeaturedMatchPicker — pointsMultiplier (rodada dobrada)', () => {
  test('pick é 1º × 2º (home=1, away=2) → multiplier=2', ({ assert }) => {
    const r = pickFeaturedMatch([fixture(101, 1, 2), fixture(102, 3, 4)], STANDINGS)
    assert.equal(r.ok, true)
    if (r.ok) {
      assert.equal(r.match.externalId, 101)
      assert.equal(r.pointsMultiplier, 2)
    }
  })

  test('pick é 1º × 2º invertido (home=2, away=1) → multiplier=2', ({ assert }) => {
    const r = pickFeaturedMatch([fixture(101, 2, 1), fixture(102, 3, 4)], STANDINGS)
    assert.equal(r.ok, true)
    if (r.ok) {
      assert.equal(r.match.externalId, 101)
      assert.equal(r.pointsMultiplier, 2)
    }
  })

  test('pick é 1º × 3º → multiplier=1', ({ assert }) => {
    const r = pickFeaturedMatch([fixture(101, 1, 3)], STANDINGS)
    assert.equal(r.ok, true)
    if (r.ok) assert.equal(r.pointsMultiplier, 1)
  })

  test('pick é 2º × 3º → multiplier=1', ({ assert }) => {
    const r = pickFeaturedMatch([fixture(101, 2, 3)], STANDINGS)
    assert.equal(r.ok, true)
    if (r.ok) assert.equal(r.pointsMultiplier, 1)
  })

  test('standings com menos de 2 entradas → multiplier=1 (fallback seguro)', ({ assert }) => {
    const r = pickFeaturedMatch([fixture(101, 1, 2)], [{ teamId: 1, points: 5 }])
    assert.equal(r.ok, true)
    if (r.ok) assert.equal(r.pointsMultiplier, 1)
  })

  test('standings vazio → multiplier=1', ({ assert }) => {
    const r = pickFeaturedMatch([fixture(101, 1, 2)], [])
    assert.equal(r.ok, true)
    if (r.ok) assert.equal(r.pointsMultiplier, 1)
  })
})
