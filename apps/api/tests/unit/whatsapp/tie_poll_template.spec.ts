import { test } from '@japa/runner'
import { tiePollMessage } from '#integrations/whatsapp/templates/tie_poll'

test.group('tiePollMessage', () => {
  test('produz question com número da rodada e options ordenadas', ({ assert }) => {
    const r = tiePollMessage({
      roundNumber: 12,
      candidates: [
        { homeTeam: 'Flamengo', awayTeam: 'Palmeiras', position: 1 },
        { homeTeam: 'Corinthians', awayTeam: 'São Paulo', position: 2 },
      ],
    })
    assert.equal(r.question, '🗳️ Empate na escolha do jogo da Rodada 12 — vote no jogo da rodada!')
    assert.deepEqual(r.options, ['Flamengo x Palmeiras', 'Corinthians x São Paulo'])
  })

  test('respeita ordem da `position`', ({ assert }) => {
    const r = tiePollMessage({
      roundNumber: 1,
      candidates: [
        { homeTeam: 'B', awayTeam: 'B2', position: 2 },
        { homeTeam: 'A', awayTeam: 'A2', position: 1 },
      ],
    })
    assert.deepEqual(r.options, ['A x A2', 'B x B2'])
  })
})
