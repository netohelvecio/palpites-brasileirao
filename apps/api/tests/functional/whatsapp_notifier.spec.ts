import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import app from '@adonisjs/core/services/app'
import { TiePollMode } from '@palpites/shared'
import WhatsAppClient from '#integrations/whatsapp/whatsapp_client'
import WhatsAppNotifier from '#services/whatsapp_notifier'
import { FakeWhatsAppClient } from '#tests/helpers/whatsapp_mock'

const TIE_PAYLOAD = {
  roundNumber: 12,
  candidates: [
    { homeTeam: 'A', awayTeam: 'B', position: 1 },
    { homeTeam: 'C', awayTeam: 'D', position: 2 },
  ],
}

test.group('WhatsAppNotifier', () => {
  test('isReady() reflete client.isConnected()', async ({ assert }) => {
    const fake = new FakeWhatsAppClient()
    app.container.swap(WhatsAppClient, () => fake)
    try {
      const notifier = await app.container.make(WhatsAppNotifier)

      fake.setConnected(true)
      assert.isTrue(notifier.isReady())

      fake.setConnected(false)
      assert.isFalse(notifier.isReady())
    } finally {
      app.container.restore(WhatsAppClient)
    }
  })

  test('notifyRoundOpened envia texto correto', async ({ assert }) => {
    const fake = new FakeWhatsAppClient()
    app.container.swap(WhatsAppClient, () => fake)
    try {
      const notifier = await app.container.make(WhatsAppNotifier)
      await notifier.notifyRoundOpened({
        roundNumber: 5,
        homeTeam: 'Palmeiras',
        awayTeam: 'Flamengo',
        kickoffAt: DateTime.fromISO('2026-05-04T20:00:00', { zone: 'America/Sao_Paulo' }),
      })

      assert.lengthOf(fake.sentMessages, 1)
      assert.match(fake.sentMessages[0], /📢 Rodada 5 aberta!/)
      assert.match(fake.sentMessages[0], /Palmeiras x Flamengo/)
      assert.match(fake.sentMessages[0], /04\/05 às 20:00/)
    } finally {
      app.container.restore(WhatsAppClient)
    }
  })

  test('notifyRoundClosed envia lista de palpites', async ({ assert }) => {
    const fake = new FakeWhatsAppClient()
    app.container.swap(WhatsAppClient, () => fake)
    try {
      const notifier = await app.container.make(WhatsAppNotifier)
      await notifier.notifyRoundClosed({
        roundNumber: 3,
        homeTeam: 'A',
        awayTeam: 'B',
        guesses: [{ userName: 'Helvécio', userEmoji: '⚽', homeScore: 2, awayScore: 0 }],
      })

      assert.match(fake.sentMessages[0], /Helvécio ⚽ — 2x0/)
    } finally {
      app.container.restore(WhatsAppClient)
    }
  })

  test('notifyMatchFinished envia mensagem única com 3 blocos', async ({ assert }) => {
    const fake = new FakeWhatsAppClient()
    app.container.swap(WhatsAppClient, () => fake)
    try {
      const notifier = await app.container.make(WhatsAppNotifier)
      await notifier.notifyMatchFinished({
        roundNumber: 1,
        homeTeam: 'A',
        awayTeam: 'B',
        finalHome: 1,
        finalAway: 0,
        roundScores: [{ userId: 'u', name: 'X', emoji: '🎯', points: 3 }],
        seasonRanking: [
          { userId: 'u', name: 'X', emoji: '🎯', totalPoints: 3, exactScoresCount: 1 },
        ],
      })

      assert.lengthOf(fake.sentMessages, 1)
      assert.match(fake.sentMessages[0], /🏁 Final/)
      assert.match(fake.sentMessages[0], /Pontuação da rodada/)
      assert.match(fake.sentMessages[0], /🏆 Ranking da temporada/)
    } finally {
      app.container.restore(WhatsAppClient)
    }
  })

  test('propaga erro do client.sendToGroup', async ({ assert }) => {
    const fake = new FakeWhatsAppClient()
    fake.throwOnSend = new Error('boom')
    app.container.swap(WhatsAppClient, () => fake)
    try {
      const notifier = await app.container.make(WhatsAppNotifier)
      await assert.rejects(
        () =>
          notifier.notifyRoundOpened({
            roundNumber: 1,
            homeTeam: 'A',
            awayTeam: 'B',
            kickoffAt: DateTime.now(),
          }),
        /boom/
      )
    } finally {
      app.container.restore(WhatsAppClient)
    }
  })

  test('notifyRoundOpenedToUser envia DM com nome/emoji do user', async ({ assert }) => {
    const fake = new FakeWhatsAppClient()
    app.container.swap(WhatsAppClient, () => fake)
    try {
      const notifier = await app.container.make(WhatsAppNotifier)
      await notifier.notifyRoundOpenedToUser({
        user: { whatsappNumber: '5511987654321', name: 'Helvécio', emoji: '⚽' },
        roundNumber: 12,
        homeTeam: 'Palmeiras',
        awayTeam: 'Flamengo',
        kickoffAt: DateTime.fromISO('2026-05-04T20:00:00', { zone: 'America/Sao_Paulo' }),
      })

      assert.lengthOf(fake.sentDms, 1)
      assert.equal(fake.sentDms[0].number, '5511987654321')
      assert.match(fake.sentDms[0].text, /Oi Helvécio ⚽!/)
      assert.match(fake.sentDms[0].text, /Rodada 12 aberta — Palmeiras x Flamengo/)
    } finally {
      app.container.restore(WhatsAppClient)
    }
  })

  test('notifyGuessRegistered posta no grupo', async ({ assert }) => {
    const fake = new FakeWhatsAppClient()
    app.container.swap(WhatsAppClient, () => fake)
    try {
      const notifier = await app.container.make(WhatsAppNotifier)
      await notifier.notifyGuessRegistered({
        userName: 'Helvécio',
        userEmoji: '⚽',
        homeTeam: 'Palmeiras',
        awayTeam: 'Flamengo',
        homeScore: 2,
        awayScore: 1,
      })

      assert.lengthOf(fake.sentMessages, 1)
      assert.equal(fake.sentMessages[0], 'Helvécio ⚽ palpitou: Palmeiras 2 x 1 Flamengo')
    } finally {
      app.container.restore(WhatsAppClient)
    }
  })

  test('notifyTieCandidatesPoll: poll OK → mode=poll, messageId retornado', async ({ assert }) => {
    const fake = new FakeWhatsAppClient()
    fake.pollMessageId = 'msg-1'
    app.container.swap(WhatsAppClient, () => fake)
    try {
      const notifier = await app.container.make(WhatsAppNotifier)
      const r = await notifier.notifyTieCandidatesPoll(TIE_PAYLOAD)

      assert.equal(r.mode, TiePollMode.POLL)
      assert.equal(r.messageId, 'msg-1')
      assert.lengthOf(fake.sentPolls, 1)
      assert.lengthOf(fake.sentMessages, 0)
    } finally {
      app.container.restore(WhatsAppClient)
    }
  })

  test('notifyTieCandidatesPoll: poll throws → fallback emoji, mode=emoji, messageId=null', async ({
    assert,
  }) => {
    const fake = new FakeWhatsAppClient()
    fake.throwOnSendPoll = new Error('poll not supported')
    app.container.swap(WhatsAppClient, () => fake)
    try {
      const notifier = await app.container.make(WhatsAppNotifier)
      const r = await notifier.notifyTieCandidatesPoll(TIE_PAYLOAD)

      assert.equal(r.mode, TiePollMode.EMOJI)
      assert.isNull(r.messageId)
      assert.lengthOf(fake.sentMessages, 1)
      assert.match(fake.sentMessages[0], /1️⃣ A x B/)
      assert.match(fake.sentMessages[0], /2️⃣ C x D/)
    } finally {
      app.container.restore(WhatsAppClient)
    }
  })
})
