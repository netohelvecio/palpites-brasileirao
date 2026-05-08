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

function fixture(
  id: number,
  homeId: number,
  awayId: number,
  kickoffAt: Date = new Date('2026-05-04T20:00:00Z')
): FixtureCandidate {
  return {
    externalId: id,
    homeTeamId: homeId,
    homeTeamName: `Team${homeId}`,
    awayTeamId: awayId,
    awayTeamName: `Team${awayId}`,
    kickoffAt,
  }
}

test.group('FeaturedMatchPicker — kind: unique', () => {
  test('escolhe o confronto com maior soma de pontos', ({ assert }) => {
    const r = pickFeaturedMatch(
      [fixture(100, 3, 4), fixture(101, 1, 2), fixture(102, 5, 1)],
      STANDINGS
    )
    assert.equal(r.ok, true)
    if (r.ok && r.kind === 'unique') {
      assert.equal(r.match.externalId, 101)
      assert.equal(r.pointsMultiplier, 2)
    } else {
      assert.fail('expected unique')
    }
  })

  test('1 fixture apenas → unique', ({ assert }) => {
    const r = pickFeaturedMatch([fixture(400, 1, 5)], STANDINGS)
    assert.equal(r.ok, true)
    if (r.ok && r.kind === 'unique') assert.equal(r.match.externalId, 400)
    else assert.fail('expected unique')
  })

  test('times sem registro contam 0', ({ assert }) => {
    const r = pickFeaturedMatch([fixture(300, 999, 888), fixture(301, 1, 2)], STANDINGS)
    assert.equal(r.ok, true)
    if (r.ok && r.kind === 'unique') assert.equal(r.match.externalId, 301)
    else assert.fail('expected unique')
  })

  test('lista vazia → ok:false', ({ assert }) => {
    const r = pickFeaturedMatch([], STANDINGS)
    assert.equal(r.ok, false)
  })

  test('standings vazio com múltiplos fixtures → tie (todos somam 0)', ({ assert }) => {
    const r = pickFeaturedMatch([fixture(500, 1, 2), fixture(501, 3, 4)], [])
    assert.equal(r.ok, true)
    if (r.ok && r.kind === 'tie') assert.equal(r.candidates.length, 2)
    else assert.fail('expected tie')
  })
})

test.group('FeaturedMatchPicker — multiplier 1×2', () => {
  test('pick é 1º × 2º (home=1, away=2) → multiplier=2', ({ assert }) => {
    const r = pickFeaturedMatch([fixture(101, 1, 2), fixture(102, 3, 4)], STANDINGS)
    if (r.ok && r.kind === 'unique') assert.equal(r.pointsMultiplier, 2)
    else assert.fail('expected unique')
  })

  test('pick é 1º × 2º invertido (home=2, away=1) → multiplier=2', ({ assert }) => {
    const r = pickFeaturedMatch([fixture(101, 2, 1), fixture(102, 3, 4)], STANDINGS)
    if (r.ok && r.kind === 'unique') assert.equal(r.pointsMultiplier, 2)
    else assert.fail('expected unique')
  })

  test('pick é 1º × 3º → multiplier=1', ({ assert }) => {
    const r = pickFeaturedMatch([fixture(101, 1, 3)], STANDINGS)
    if (r.ok && r.kind === 'unique') assert.equal(r.pointsMultiplier, 1)
    else assert.fail('expected unique')
  })

  test('standings com 1 entrada → multiplier=1 (fallback seguro)', ({ assert }) => {
    const r = pickFeaturedMatch([fixture(101, 1, 2)], [{ teamId: 1, points: 5 }])
    if (r.ok && r.kind === 'unique') assert.equal(r.pointsMultiplier, 1)
    else assert.fail('expected unique')
  })
})

test.group('FeaturedMatchPicker — kind: tie', () => {
  test('≥2 fixtures empatados no max e nenhum é 1×2 → tie', ({ assert }) => {
    const standings: StandingEntry[] = [
      { teamId: 10, points: 30 },
      { teamId: 11, points: 25 },
      { teamId: 20, points: 20 },
      { teamId: 21, points: 20 },
      { teamId: 30, points: 15 },
      { teamId: 31, points: 15 },
    ]
    const r = pickFeaturedMatch(
      [
        fixture(100, 20, 30, new Date('2026-05-05T18:00:00Z')), // 35
        fixture(101, 21, 31, new Date('2026-05-04T22:00:00Z')), // 35
        fixture(102, 30, 31, new Date('2026-05-06T20:00:00Z')), // 30
      ],
      standings
    )
    assert.equal(r.ok, true)
    if (r.ok && r.kind === 'tie') {
      assert.equal(r.candidates.length, 2)
      // ordenado por kickoffAt ASC → 101 vem antes
      assert.equal(r.candidates[0].match.externalId, 101)
      assert.equal(r.candidates[0].position, 1)
      assert.equal(r.candidates[1].match.externalId, 100)
      assert.equal(r.candidates[1].position, 2)
      assert.equal(r.candidates[0].pointsSum, 35)
      assert.equal(r.candidates[1].pointsSum, 35)
    } else {
      assert.fail('expected tie')
    }
  })

  test('tie-break 1×2 — empate inclui o jogo 1×2 → unique multiplier=2', ({ assert }) => {
    const standings: StandingEntry[] = [
      { teamId: 1, points: 30 },
      { teamId: 2, points: 25 },
      { teamId: 3, points: 30 },
      { teamId: 4, points: 25 },
    ]
    // 1+2 = 55 ; 3+4 = 55 ; mas 1+2 é o 1×2 da tabela
    const r = pickFeaturedMatch([fixture(100, 3, 4), fixture(101, 1, 2)], standings)
    assert.equal(r.ok, true)
    if (r.ok && r.kind === 'unique') {
      assert.equal(r.match.externalId, 101)
      assert.equal(r.pointsMultiplier, 2)
    } else {
      assert.fail('expected unique (tie-break 1×2)')
    }
  })
})
