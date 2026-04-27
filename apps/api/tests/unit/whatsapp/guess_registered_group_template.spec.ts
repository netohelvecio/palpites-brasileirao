import { test } from '@japa/runner'
import { guessRegisteredGroupMessage } from '#integrations/whatsapp/templates/guess_registered_group'

test.group('templates/guess_registered_group', () => {
  test('formata anúncio do palpite no grupo', ({ assert }) => {
    const text = guessRegisteredGroupMessage({
      userName: 'Helvécio',
      userEmoji: '⚽',
      homeTeam: 'Palmeiras',
      awayTeam: 'Flamengo',
      homeScore: 2,
      awayScore: 1,
    })

    assert.equal(text, 'Helvécio ⚽ palpitou: Palmeiras 2 x 1 Flamengo')
  })

  test('lida com empate', ({ assert }) => {
    const text = guessRegisteredGroupMessage({
      userName: 'Ana',
      userEmoji: '🦊',
      homeTeam: 'A',
      awayTeam: 'B',
      homeScore: 1,
      awayScore: 1,
    })

    assert.equal(text, 'Ana 🦊 palpitou: A 1 x 1 B')
  })
})
