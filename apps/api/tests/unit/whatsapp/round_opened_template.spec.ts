import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import { roundOpenedMessage } from '#integrations/whatsapp/templates/round_opened'

test.group('templates/round_opened', () => {
  test('formata anúncio com número da rodada, times e kickoff', ({ assert }) => {
    const text = roundOpenedMessage({
      roundNumber: 12,
      homeTeam: 'Palmeiras',
      awayTeam: 'Flamengo',
      kickoffAt: DateTime.fromISO('2026-05-04T20:00:00', { zone: 'America/Sao_Paulo' }),
    })

    assert.equal(
      text,
      '📢 Rodada 12 aberta!\n' + 'Jogo: Palmeiras x Flamengo\n' + 'Kickoff: 04/05 20:00'
    )
  })

  test('formata data com zero-padding', ({ assert }) => {
    const text = roundOpenedMessage({
      roundNumber: 1,
      homeTeam: 'Santos',
      awayTeam: 'São Paulo',
      kickoffAt: DateTime.fromISO('2026-04-09T08:30:00', { zone: 'America/Sao_Paulo' }),
    })
    assert.match(text, /Kickoff: 09\/04 08:30/)
  })

  test('força timezone America/Sao_Paulo independente do input', ({ assert }) => {
    const text = roundOpenedMessage({
      roundNumber: 4,
      homeTeam: 'A',
      awayTeam: 'B',
      kickoffAt: DateTime.fromISO('2026-05-04T23:00:00', { zone: 'utc' }),
    })
    assert.match(text, /Kickoff: 04\/05 20:00/)
  })
})
