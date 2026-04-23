import { test } from '@japa/runner'
import { calculatePoints } from '#services/guess_scoring_service'

test.group('GuessScoringService', () => {
  test('placar exato = 3 pts', ({ assert }) => {
    assert.equal(calculatePoints({ guessHome: 2, guessAway: 1 }, { finalHome: 2, finalAway: 1 }), 3)
  })

  test('acertou vencedor (home) = 1 pt', ({ assert }) => {
    assert.equal(calculatePoints({ guessHome: 3, guessAway: 1 }, { finalHome: 2, finalAway: 0 }), 1)
  })

  test('acertou vencedor (away) = 1 pt', ({ assert }) => {
    assert.equal(calculatePoints({ guessHome: 0, guessAway: 2 }, { finalHome: 1, finalAway: 3 }), 1)
  })

  test('acertou empate com placar diferente = 1 pt', ({ assert }) => {
    assert.equal(calculatePoints({ guessHome: 1, guessAway: 1 }, { finalHome: 2, finalAway: 2 }), 1)
  })

  test('acertou empate com placar exato = 3 pts', ({ assert }) => {
    assert.equal(calculatePoints({ guessHome: 1, guessAway: 1 }, { finalHome: 1, finalAway: 1 }), 3)
  })

  test('errou vencedor = 0 pts', ({ assert }) => {
    assert.equal(calculatePoints({ guessHome: 2, guessAway: 1 }, { finalHome: 0, finalAway: 3 }), 0)
  })

  test('palpitou empate, deu vitória = 0 pts', ({ assert }) => {
    assert.equal(calculatePoints({ guessHome: 1, guessAway: 1 }, { finalHome: 2, finalAway: 0 }), 0)
  })

  test('palpitou vitória, deu empate = 0 pts', ({ assert }) => {
    assert.equal(calculatePoints({ guessHome: 2, guessAway: 1 }, { finalHome: 1, finalAway: 1 }), 0)
  })
})
