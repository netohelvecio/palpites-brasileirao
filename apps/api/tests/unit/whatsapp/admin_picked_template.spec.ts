import { test } from '@japa/runner'
import { adminPickedMessage } from '#integrations/whatsapp/templates/admin_picked'

test.group('adminPickedMessage', () => {
  test('inclui número da rodada e jogo escolhido', ({ assert }) => {
    const text = adminPickedMessage({
      roundNumber: 9,
      homeTeam: 'Botafogo',
      awayTeam: 'Atlético-MG',
    })
    assert.match(text, /Rodada 9/)
    assert.match(text, /Botafogo x Atlético-MG/)
  })
})
