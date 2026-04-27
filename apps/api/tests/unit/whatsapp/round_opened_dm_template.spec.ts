import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import { roundOpenedDmMessage } from '#integrations/whatsapp/templates/round_opened_dm'

test.group('templates/round_opened_dm', () => {
  test('formata DM personalizada com nome, emoji, jogo e kickoff', ({ assert }) => {
    const text = roundOpenedDmMessage({
      userName: 'Helvécio',
      userEmoji: '⚽',
      roundNumber: 12,
      homeTeam: 'Palmeiras',
      awayTeam: 'Flamengo',
      kickoffAt: DateTime.fromISO('2026-05-04T20:00:00', { zone: 'America/Sao_Paulo' }),
    })

    assert.equal(
      text,
      'Oi Helvécio ⚽!\n' +
        '📢 Rodada 12 aberta — Palmeiras x Flamengo\n' +
        'Kickoff: 04/05 20:00\n' +
        '\n' +
        'Manda o palpite aqui no privado. Ex: 2x1 Palmeiras'
    )
  })

  test('força timezone America/Sao_Paulo independente do input', ({ assert }) => {
    const text = roundOpenedDmMessage({
      userName: 'Ana',
      userEmoji: '🦊',
      roundNumber: 1,
      homeTeam: 'A',
      awayTeam: 'B',
      kickoffAt: DateTime.fromISO('2026-05-04T23:00:00', { zone: 'utc' }),
    })
    assert.match(text, /Kickoff: 04\/05 20:00/)
  })
})
