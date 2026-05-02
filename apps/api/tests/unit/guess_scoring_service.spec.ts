import { test } from '@japa/runner'
import { calculatePoints } from '#services/guess_scoring_service'

test.group('GuessScoringService — multiplier=1 (default)', () => {
  test('placar exato = 3 pts, isExact=true', ({ assert }) => {
    const r = calculatePoints({ guessHome: 2, guessAway: 1 }, { finalHome: 2, finalAway: 1 })
    assert.deepEqual(r, { points: 3, isExact: true })
  })

  test('acertou vencedor (home) = 1 pt, isExact=false', ({ assert }) => {
    const r = calculatePoints({ guessHome: 3, guessAway: 1 }, { finalHome: 2, finalAway: 0 })
    assert.deepEqual(r, { points: 1, isExact: false })
  })

  test('acertou vencedor (away) = 1 pt', ({ assert }) => {
    const r = calculatePoints({ guessHome: 0, guessAway: 2 }, { finalHome: 1, finalAway: 3 })
    assert.deepEqual(r, { points: 1, isExact: false })
  })

  test('acertou empate sem placar exato = 1 pt', ({ assert }) => {
    const r = calculatePoints({ guessHome: 1, guessAway: 1 }, { finalHome: 2, finalAway: 2 })
    assert.deepEqual(r, { points: 1, isExact: false })
  })

  test('acertou empate com placar exato = 3 pts', ({ assert }) => {
    const r = calculatePoints({ guessHome: 1, guessAway: 1 }, { finalHome: 1, finalAway: 1 })
    assert.deepEqual(r, { points: 3, isExact: true })
  })

  test('errou vencedor = 0 pts', ({ assert }) => {
    const r = calculatePoints({ guessHome: 2, guessAway: 1 }, { finalHome: 0, finalAway: 3 })
    assert.deepEqual(r, { points: 0, isExact: false })
  })

  test('palpitou empate, deu vitória = 0 pts', ({ assert }) => {
    const r = calculatePoints({ guessHome: 1, guessAway: 1 }, { finalHome: 2, finalAway: 0 })
    assert.deepEqual(r, { points: 0, isExact: false })
  })

  test('palpitou vitória, deu empate = 0 pts', ({ assert }) => {
    const r = calculatePoints({ guessHome: 2, guessAway: 1 }, { finalHome: 1, finalAway: 1 })
    assert.deepEqual(r, { points: 0, isExact: false })
  })
})

test.group('GuessScoringService — multiplier=2 (rodada dobrada)', () => {
  test('placar exato = 6 pts, isExact=true', ({ assert }) => {
    const r = calculatePoints({ guessHome: 2, guessAway: 1 }, { finalHome: 2, finalAway: 1 }, 2)
    assert.deepEqual(r, { points: 6, isExact: true })
  })

  test('acertou vencedor = 2 pts, isExact=false', ({ assert }) => {
    const r = calculatePoints({ guessHome: 3, guessAway: 1 }, { finalHome: 2, finalAway: 0 }, 2)
    assert.deepEqual(r, { points: 2, isExact: false })
  })

  test('errou = 0 pts, isExact=false (zero não dobra mesmo com multiplier)', ({ assert }) => {
    const r = calculatePoints({ guessHome: 2, guessAway: 1 }, { finalHome: 0, finalAway: 3 }, 2)
    assert.deepEqual(r, { points: 0, isExact: false })
  })

  test('isExact independe do multiplier — só do palpite vs placar', ({ assert }) => {
    const r1 = calculatePoints({ guessHome: 1, guessAway: 1 }, { finalHome: 1, finalAway: 1 }, 1)
    const r2 = calculatePoints({ guessHome: 1, guessAway: 1 }, { finalHome: 1, finalAway: 1 }, 2)
    assert.equal(r1.isExact, true)
    assert.equal(r2.isExact, true)
  })
})
