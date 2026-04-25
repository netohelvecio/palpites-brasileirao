import { test } from '@japa/runner'
import { roundClosedMessage } from '#integrations/whatsapp/templates/round_closed'

test.group('templates/round_closed', () => {
  test('lista palpites em ordem alfabética por nome', ({ assert }) => {
    const text = roundClosedMessage({
      roundNumber: 7,
      homeTeam: 'Palmeiras',
      awayTeam: 'Flamengo',
      guesses: [
        { userName: 'Helvécio', userEmoji: '⚽', homeScore: 2, awayScore: 1 },
        { userName: 'Ana', userEmoji: '🦊', homeScore: 1, awayScore: 1 },
        { userName: 'Bruno', userEmoji: '🐺', homeScore: 0, awayScore: 2 },
      ],
    })

    assert.equal(
      text,
      '⏱️ Rodada 7 fechada — Palmeiras x Flamengo\n' +
        '\n' +
        'Palpites:\n' +
        'Ana 🦊 — 1x1\n' +
        'Bruno 🐺 — 0x2\n' +
        'Helvécio ⚽ — 2x1'
    )
  })

  test('mensagem específica quando não houve palpites', ({ assert }) => {
    const text = roundClosedMessage({
      roundNumber: 3,
      homeTeam: 'Santos',
      awayTeam: 'Corinthians',
      guesses: [],
    })

    assert.equal(
      text,
      '⏱️ Rodada 3 fechada — Santos x Corinthians\n' + '\n' + 'Nenhum palpite registrado.'
    )
  })
})
