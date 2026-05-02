import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import MatchReminderJob from '#jobs/match_reminder_job'
import WhatsAppClient from '#integrations/whatsapp/whatsapp_client'
import { SeasonFactory } from '#factories/season_factory'
import { RoundFactory } from '#factories/round_factory'
import { MatchFactory } from '#factories/match_factory'
import { FakeWhatsAppClient } from '#tests/helpers/whatsapp_mock'

test.group('MatchReminderJob', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  test('envia reminder e stampa flag quando kickoff está em ~28min e flag null', async ({
    assert,
  }) => {
    const season = await SeasonFactory.create()
    const round = await RoundFactory.merge({ seasonId: season.id, status: 'open' }).create()
    const match = await MatchFactory.merge({
      roundId: round.id,
      homeTeam: 'Palmeiras',
      awayTeam: 'Flamengo',
      kickoffAt: DateTime.now().plus({ minutes: 28 }),
    }).create()

    const whatsapp = new FakeWhatsAppClient()
    app.container.swap(WhatsAppClient, () => whatsapp)
    try {
      const job = await app.container.make(MatchReminderJob)
      const report = await job.run()

      assert.equal(report.sentCount, 1)
      assert.deepEqual(report.sentRoundIds, [round.id])
      assert.equal(report.errorCount, 0)

      assert.lengthOf(whatsapp.sentMessages, 1)
      assert.match(whatsapp.sentMessages[0], /Faltam 30 min/)
      assert.match(whatsapp.sentMessages[0], /Palmeiras x Flamengo/)

      const fresh = await match.refresh()
      assert.isNotNull(fresh.reminder30MinSentAt)
    } finally {
      app.container.restore(WhatsAppClient)
    }
  })

  test('não envia se flag já está stampada (idempotência)', async ({ assert }) => {
    const season = await SeasonFactory.create()
    const round = await RoundFactory.merge({ seasonId: season.id, status: 'open' }).create()
    await MatchFactory.merge({
      roundId: round.id,
      kickoffAt: DateTime.now().plus({ minutes: 15 }),
      reminder30MinSentAt: DateTime.now().minus({ minutes: 5 }),
    }).create()

    const whatsapp = new FakeWhatsAppClient()
    app.container.swap(WhatsAppClient, () => whatsapp)
    try {
      const job = await app.container.make(MatchReminderJob)
      const report = await job.run()

      assert.equal(report.sentCount, 0)
      assert.lengthOf(whatsapp.sentMessages, 0)
    } finally {
      app.container.restore(WhatsAppClient)
    }
  })

  test('ignora kickoff fora da janela (>30min)', async ({ assert }) => {
    const season = await SeasonFactory.create()
    const round = await RoundFactory.merge({ seasonId: season.id, status: 'open' }).create()
    await MatchFactory.merge({
      roundId: round.id,
      kickoffAt: DateTime.now().plus({ minutes: 60 }),
    }).create()

    const whatsapp = new FakeWhatsAppClient()
    app.container.swap(WhatsAppClient, () => whatsapp)
    try {
      const job = await app.container.make(MatchReminderJob)
      const report = await job.run()

      assert.equal(report.sentCount, 0)
      assert.lengthOf(whatsapp.sentMessages, 0)
    } finally {
      app.container.restore(WhatsAppClient)
    }
  })

  test('ignora kickoff já passado', async ({ assert }) => {
    const season = await SeasonFactory.create()
    const round = await RoundFactory.merge({ seasonId: season.id, status: 'open' }).create()
    await MatchFactory.merge({
      roundId: round.id,
      kickoffAt: DateTime.now().minus({ minutes: 5 }),
    }).create()

    const whatsapp = new FakeWhatsAppClient()
    app.container.swap(WhatsAppClient, () => whatsapp)
    try {
      const job = await app.container.make(MatchReminderJob)
      const report = await job.run()

      assert.equal(report.sentCount, 0)
      assert.lengthOf(whatsapp.sentMessages, 0)
    } finally {
      app.container.restore(WhatsAppClient)
    }
  })

  test('ignora rounds em status pending / closed / finished', async ({ assert }) => {
    const season = await SeasonFactory.create()
    const statuses = ['pending', 'closed', 'finished'] as const
    for (const [i, status] of statuses.entries()) {
      const r = await RoundFactory.merge({
        seasonId: season.id,
        number: i + 1,
        status,
      }).create()
      await MatchFactory.merge({
        roundId: r.id,
        kickoffAt: DateTime.now().plus({ minutes: 20 }),
      }).create()
    }

    const whatsapp = new FakeWhatsAppClient()
    app.container.swap(WhatsAppClient, () => whatsapp)
    try {
      const job = await app.container.make(MatchReminderJob)
      const report = await job.run()

      assert.equal(report.sentCount, 0)
      assert.lengthOf(whatsapp.sentMessages, 0)
    } finally {
      app.container.restore(WhatsAppClient)
    }
  })

  test('WhatsApp offline: não envia, flag continua null, errorCount=0', async ({ assert }) => {
    const season = await SeasonFactory.create()
    const round = await RoundFactory.merge({ seasonId: season.id, status: 'open' }).create()
    const match = await MatchFactory.merge({
      roundId: round.id,
      kickoffAt: DateTime.now().plus({ minutes: 20 }),
    }).create()

    const whatsapp = new FakeWhatsAppClient()
    whatsapp.setConnected(false)
    app.container.swap(WhatsAppClient, () => whatsapp)
    try {
      const job = await app.container.make(MatchReminderJob)
      const report = await job.run()

      assert.equal(report.sentCount, 0)
      assert.equal(report.errorCount, 0)
      assert.lengthOf(whatsapp.sentMessages, 0)

      const fresh = await match.refresh()
      assert.isNull(fresh.reminder30MinSentAt)
    } finally {
      app.container.restore(WhatsAppClient)
    }
  })

  test('send falha: não stampa flag, errorCount=1', async ({ assert }) => {
    const season = await SeasonFactory.create()
    const round = await RoundFactory.merge({ seasonId: season.id, status: 'open' }).create()
    const match = await MatchFactory.merge({
      roundId: round.id,
      kickoffAt: DateTime.now().plus({ minutes: 20 }),
    }).create()

    const whatsapp = new FakeWhatsAppClient()
    whatsapp.throwOnSend = new Error('baileys timeout')
    app.container.swap(WhatsAppClient, () => whatsapp)
    try {
      const job = await app.container.make(MatchReminderJob)
      const report = await job.run()

      assert.equal(report.sentCount, 0)
      assert.equal(report.errorCount, 1)

      const fresh = await match.refresh()
      assert.isNull(fresh.reminder30MinSentAt)
    } finally {
      app.container.restore(WhatsAppClient)
    }
  })

  test('inclui header de rodada dobrada quando match.pointsMultiplier=2', async ({ assert }) => {
    const season = await SeasonFactory.create()
    const round = await RoundFactory.merge({ seasonId: season.id, status: 'open' }).create()
    await MatchFactory.merge({
      roundId: round.id,
      homeTeam: 'Palmeiras',
      awayTeam: 'Flamengo',
      kickoffAt: DateTime.now().plus({ minutes: 28 }),
      pointsMultiplier: 2,
    }).create()

    const whatsapp = new FakeWhatsAppClient()
    app.container.swap(WhatsAppClient, () => whatsapp)
    try {
      const job = await app.container.make(MatchReminderJob)
      await job.run()

      assert.lengthOf(whatsapp.sentMessages, 1)
      assert.match(whatsapp.sentMessages[0], /🔥 \*RODADA VALENDO EM DOBRO!\*/)
    } finally {
      app.container.restore(WhatsAppClient)
    }
  })
})
