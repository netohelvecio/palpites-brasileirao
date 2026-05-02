import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import { matchReminderMessage } from '#integrations/whatsapp/templates/match_reminder'

test.group('matchReminderMessage', () => {
  test('formata mensagem com kickoff em America/Sao_Paulo', ({ assert }) => {
    // 19:00 UTC = 16:00 America/Sao_Paulo (UTC-3)
    const kickoffAt = DateTime.fromISO('2026-05-04T19:00:00.000Z')
    const text = matchReminderMessage({
      homeTeam: 'Palmeiras',
      awayTeam: 'Flamengo',
      kickoffAt,
    })

    assert.equal(
      text,
      ['⏰ Faltam 30 min!', '⚽ Palmeiras x Flamengo', '🕘 Início: 16:00'].join('\n')
    )
  })

  test('respeita timezone independente da TZ do input', ({ assert }) => {
    // mesmo instante, mas DateTime construído em UTC vs SP — output deve ser igual
    const utc = DateTime.fromISO('2026-05-04T22:30:00.000Z', { zone: 'utc' })
    const text = matchReminderMessage({
      homeTeam: 'A',
      awayTeam: 'B',
      kickoffAt: utc,
    })

    assert.match(text, /🕘 Início: 19:30/)
  })
})
