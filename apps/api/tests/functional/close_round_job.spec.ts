import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import CloseRoundJob from '#jobs/close_round_job'
import WhatsAppClient from '#integrations/whatsapp/whatsapp_client'
import Guess from '#models/guess'
import { SeasonFactory } from '#factories/season_factory'
import { RoundFactory } from '#factories/round_factory'
import { MatchFactory } from '#factories/match_factory'
import { UserFactory } from '#factories/user_factory'
import { FakeWhatsAppClient } from '#tests/helpers/whatsapp_mock'

test.group('CloseRoundJob', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  test('flipa round open → closed quando kickoff passou e envia mensagem com palpites', async ({
    assert,
  }) => {
    const season = await SeasonFactory.create()
    const round = await RoundFactory.merge({ seasonId: season.id, status: 'open' }).create()
    const match = await MatchFactory.merge({
      roundId: round.id,
      homeTeam: 'Palmeiras',
      awayTeam: 'Flamengo',
      kickoffAt: DateTime.now().minus({ minutes: 10 }),
    }).create()

    const user = await UserFactory.merge({ name: 'Helvécio', emoji: '⚽' }).create()
    await Guess.create({
      matchId: match.id,
      userId: user.id,
      homeScore: 2,
      awayScore: 1,
    } as any)

    const whatsapp = new FakeWhatsAppClient()
    app.container.swap(WhatsAppClient, () => whatsapp)
    try {
      const job = await app.container.make(CloseRoundJob)
      const report = await job.run()

      assert.equal(report.closedCount, 1)
      const fresh = await round.refresh()
      assert.equal(fresh.status, 'closed')

      assert.lengthOf(whatsapp.sentMessages, 1)
      assert.match(whatsapp.sentMessages[0], /Rodada \d+ fechada — Palmeiras x Flamengo/)
      assert.match(whatsapp.sentMessages[0], /Helvécio ⚽ — 2x1/)
    } finally {
      app.container.restore(WhatsAppClient)
    }
  })

  test('round sem palpites: mensagem com "Nenhum palpite registrado"', async ({ assert }) => {
    const season = await SeasonFactory.create()
    const round = await RoundFactory.merge({ seasonId: season.id, status: 'open' }).create()
    await MatchFactory.merge({
      roundId: round.id,
      kickoffAt: DateTime.now().minus({ minutes: 1 }),
    }).create()

    const whatsapp = new FakeWhatsAppClient()
    app.container.swap(WhatsAppClient, () => whatsapp)
    try {
      const job = await app.container.make(CloseRoundJob)
      await job.run()

      assert.lengthOf(whatsapp.sentMessages, 1)
      assert.match(whatsapp.sentMessages[0], /Nenhum palpite registrado/)
    } finally {
      app.container.restore(WhatsAppClient)
    }
  })

  test('WhatsApp offline: não flipa status nem envia', async ({ assert }) => {
    const season = await SeasonFactory.create()
    const round = await RoundFactory.merge({ seasonId: season.id, status: 'open' }).create()
    await MatchFactory.merge({
      roundId: round.id,
      kickoffAt: DateTime.now().minus({ minutes: 10 }),
    }).create()

    const whatsapp = new FakeWhatsAppClient()
    whatsapp.setConnected(false)
    app.container.swap(WhatsAppClient, () => whatsapp)
    try {
      const job = await app.container.make(CloseRoundJob)
      const report = await job.run()

      assert.equal(report.closedCount, 0)
      assert.lengthOf(whatsapp.sentMessages, 0)
      const fresh = await round.refresh()
      assert.equal(fresh.status, 'open')
    } finally {
      app.container.restore(WhatsAppClient)
    }
  })

  test('send falha: não flipa status, registra erro', async ({ assert }) => {
    const season = await SeasonFactory.create()
    const round = await RoundFactory.merge({ seasonId: season.id, status: 'open' }).create()
    await MatchFactory.merge({
      roundId: round.id,
      kickoffAt: DateTime.now().minus({ minutes: 10 }),
    }).create()

    const whatsapp = new FakeWhatsAppClient()
    whatsapp.throwOnSend = new Error('baileys timeout')
    app.container.swap(WhatsAppClient, () => whatsapp)
    try {
      const job = await app.container.make(CloseRoundJob)
      const report = await job.run()

      assert.equal(report.closedCount, 0)
      assert.equal(report.errorCount, 1)
      const fresh = await round.refresh()
      assert.equal(fresh.status, 'open')
    } finally {
      app.container.restore(WhatsAppClient)
    }
  })

  test('ignora round open com kickoff futuro', async ({ assert }) => {
    const season = await SeasonFactory.create()
    const round = await RoundFactory.merge({ seasonId: season.id, status: 'open' }).create()
    await MatchFactory.merge({
      roundId: round.id,
      kickoffAt: DateTime.now().plus({ hours: 3 }),
    }).create()

    const whatsapp = new FakeWhatsAppClient()
    app.container.swap(WhatsAppClient, () => whatsapp)
    try {
      const job = await app.container.make(CloseRoundJob)
      const report = await job.run()

      assert.equal(report.closedCount, 0)
      assert.lengthOf(whatsapp.sentMessages, 0)
      const fresh = await round.refresh()
      assert.equal(fresh.status, 'open')
    } finally {
      app.container.restore(WhatsAppClient)
    }
  })

  test('ignora rounds pending / closed / finished', async ({ assert }) => {
    const season = await SeasonFactory.create()
    const statuses = ['pending', 'closed', 'finished'] as const
    const rounds = await Promise.all(
      statuses.map(async (status, i) => {
        const r = await RoundFactory.merge({
          seasonId: season.id,
          number: i + 1,
          status,
        }).create()
        await MatchFactory.merge({
          roundId: r.id,
          kickoffAt: DateTime.now().minus({ hours: 1 }),
        }).create()
        return r
      })
    )

    const whatsapp = new FakeWhatsAppClient()
    app.container.swap(WhatsAppClient, () => whatsapp)
    try {
      const job = await app.container.make(CloseRoundJob)
      const report = await job.run()

      assert.equal(report.closedCount, 0)
      assert.lengthOf(whatsapp.sentMessages, 0)
      for (const [i, r] of rounds.entries()) {
        const fresh = await r.refresh()
        assert.equal(fresh.status, statuses[i])
      }
    } finally {
      app.container.restore(WhatsAppClient)
    }
  })
})
