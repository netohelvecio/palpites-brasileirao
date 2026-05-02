import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import FootballDataClient from '#integrations/football_data/client'
import WhatsAppClient from '#integrations/whatsapp/whatsapp_client'
import SyncScoresJob from '#jobs/sync_scores_job'
import Guess from '#models/guess'
import { SeasonFactory } from '#factories/season_factory'
import { RoundFactory } from '#factories/round_factory'
import { MatchFactory } from '#factories/match_factory'
import { UserFactory } from '#factories/user_factory'
import { FakeFootballDataClient, fakeMatch } from '#tests/helpers/football_data_mock'
import { FakeWhatsAppClient } from '#tests/helpers/whatsapp_mock'

test.group('SyncScoresJob', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  function setupFakes() {
    const football = new FakeFootballDataClient()
    const whatsapp = new FakeWhatsAppClient()
    app.container.swap(FootballDataClient, () => football as any)
    app.container.swap(WhatsAppClient, () => whatsapp)
    return { football, whatsapp }
  }

  function teardownFakes() {
    app.container.restore(FootballDataClient)
    app.container.restore(WhatsAppClient)
  }

  test('match vira FINISHED com round closed → mensagem + finalize', async ({ assert }) => {
    const season = await SeasonFactory.merge({ isActive: true }).create()
    const round = await RoundFactory.merge({
      seasonId: season.id,
      number: 7,
      status: 'closed',
    }).create()
    const match = await MatchFactory.merge({
      roundId: round.id,
      externalId: 1001,
      homeTeam: 'Palmeiras',
      awayTeam: 'Flamengo',
      status: 'live',
      homeScore: null,
      awayScore: null,
    }).create()
    const user = await UserFactory.merge({ name: 'Helvécio', emoji: '⚽' }).create()
    await Guess.create({
      matchId: match.id,
      userId: user.id,
      homeScore: 2,
      awayScore: 1,
    })

    const { football, whatsapp } = setupFakes()
    football.matchById.set(
      1001,
      fakeMatch(1001, 1, 2, 7, {
        status: 'FINISHED',
        score: { fullTime: { home: 2, away: 1 }, winner: 'HOME_TEAM' },
      })
    )

    try {
      const job = await app.container.make(SyncScoresJob)
      const report = await job.run()

      assert.lengthOf(report.runs, 1)
      assert.isTrue(report.runs[0].refreshed)
      assert.isTrue(report.runs[0].finalized)

      const freshRound = await round.refresh()
      assert.equal(freshRound.status, 'finished')

      assert.lengthOf(whatsapp.sentMessages, 1)
      assert.match(whatsapp.sentMessages[0], /🏁 Final: Palmeiras 2 x 1 Flamengo/)
      assert.match(whatsapp.sentMessages[0], /Helvécio ⚽ — 3 pts/)
      assert.match(whatsapp.sentMessages[0], /🏆 Ranking da temporada/)
    } finally {
      teardownFakes()
    }
  })

  test('WhatsApp offline: refresh mas não finalize, sem mensagem', async ({ assert }) => {
    const season = await SeasonFactory.merge({ isActive: true }).create()
    const round = await RoundFactory.merge({
      seasonId: season.id,
      status: 'closed',
    }).create()
    await MatchFactory.merge({
      roundId: round.id,
      externalId: 1002,
      status: 'live',
    }).create()

    const { football, whatsapp } = setupFakes()
    whatsapp.setConnected(false)
    football.matchById.set(
      1002,
      fakeMatch(1002, 1, 2, 7, {
        status: 'FINISHED',
        score: { fullTime: { home: 1, away: 0 }, winner: 'HOME_TEAM' },
      })
    )

    try {
      const job = await app.container.make(SyncScoresJob)
      const report = await job.run()

      assert.isTrue(report.runs[0].refreshed)
      assert.isFalse(report.runs[0].finalized)
      assert.lengthOf(whatsapp.sentMessages, 0)

      const freshRound = await round.refresh()
      assert.equal(freshRound.status, 'closed')
    } finally {
      teardownFakes()
    }
  })

  test('send falha: não finaliza, registra erro', async ({ assert }) => {
    const season = await SeasonFactory.merge({ isActive: true }).create()
    const round = await RoundFactory.merge({
      seasonId: season.id,
      status: 'closed',
    }).create()
    await MatchFactory.merge({
      roundId: round.id,
      externalId: 1003,
      status: 'live',
    }).create()

    const { football, whatsapp } = setupFakes()
    whatsapp.throwOnSend = new Error('baileys timeout')
    football.matchById.set(
      1003,
      fakeMatch(1003, 1, 2, 7, {
        status: 'FINISHED',
        score: { fullTime: { home: 1, away: 0 }, winner: 'HOME_TEAM' },
      })
    )

    try {
      const job = await app.container.make(SyncScoresJob)
      const report = await job.run()

      assert.isTrue(report.runs[0].refreshed)
      assert.isFalse(report.runs[0].finalized)
      assert.isDefined(report.runs[0].error)

      const freshRound = await round.refresh()
      assert.equal(freshRound.status, 'closed')
    } finally {
      teardownFakes()
    }
  })

  test('match scheduled → só refresh, sem mensagem', async ({ assert }) => {
    const season = await SeasonFactory.merge({ isActive: true }).create()
    const round = await RoundFactory.merge({
      seasonId: season.id,
      status: 'open',
    }).create()
    await MatchFactory.merge({
      roundId: round.id,
      externalId: 1004,
      status: 'scheduled',
    }).create()

    const { football, whatsapp } = setupFakes()
    football.matchById.set(
      1004,
      fakeMatch(1004, 1, 2, 7, {
        status: 'IN_PLAY',
        score: { fullTime: { home: 0, away: 0 }, winner: null },
      })
    )

    try {
      const job = await app.container.make(SyncScoresJob)
      const report = await job.run()

      assert.isTrue(report.runs[0].refreshed)
      assert.isFalse(report.runs[0].finalized)
      assert.lengthOf(whatsapp.sentMessages, 0)
    } finally {
      teardownFakes()
    }
  })

  test('match finished mas round ainda open: refresh, sem finalize, sem mensagem', async ({
    assert,
  }) => {
    const season = await SeasonFactory.merge({ isActive: true }).create()
    const round = await RoundFactory.merge({
      seasonId: season.id,
      status: 'open',
    }).create()
    await MatchFactory.merge({
      roundId: round.id,
      externalId: 1005,
      status: 'live',
    }).create()

    const { football, whatsapp } = setupFakes()
    football.matchById.set(
      1005,
      fakeMatch(1005, 1, 2, 7, {
        status: 'FINISHED',
        score: { fullTime: { home: 1, away: 0 }, winner: 'HOME_TEAM' },
      })
    )

    try {
      const job = await app.container.make(SyncScoresJob)
      const report = await job.run()

      assert.isFalse(report.runs[0].finalized)
      assert.lengthOf(whatsapp.sentMessages, 0)

      const freshRound = await round.refresh()
      assert.equal(freshRound.status, 'open')
    } finally {
      teardownFakes()
    }
  })

  test('ignora matches de season inativa', async ({ assert }) => {
    const season = await SeasonFactory.merge({ isActive: false }).create()
    const round = await RoundFactory.merge({ seasonId: season.id }).create()
    await MatchFactory.merge({ roundId: round.id, status: 'scheduled' }).create()

    setupFakes()
    try {
      const job = await app.container.make(SyncScoresJob)
      const report = await job.run()
      assert.lengthOf(report.runs, 0)
    } finally {
      teardownFakes()
    }
  })

  test('inclui disclaimer de rodada dobrada na mensagem final quando match.pointsMultiplier=2', async ({
    assert,
  }) => {
    const season = await SeasonFactory.merge({ isActive: true }).create()
    const round = await RoundFactory.merge({
      seasonId: season.id,
      number: 9,
      status: 'closed',
    }).create()
    const match = await MatchFactory.merge({
      roundId: round.id,
      externalId: 3001,
      homeTeam: 'Palmeiras',
      awayTeam: 'Flamengo',
      status: 'live',
      homeScore: null,
      awayScore: null,
      pointsMultiplier: 2,
    }).create()
    const user = await UserFactory.merge({ name: 'Helvécio', emoji: '⚽' }).create()
    await Guess.create({
      matchId: match.id,
      userId: user.id,
      homeScore: 2,
      awayScore: 1,
    })

    const { football, whatsapp } = setupFakes()
    football.matchById.set(
      3001,
      fakeMatch(3001, 1, 2, 9, {
        status: 'FINISHED',
        score: { fullTime: { home: 2, away: 1 }, winner: 'HOME_TEAM' },
      })
    )

    try {
      const job = await app.container.make(SyncScoresJob)
      await job.run()

      assert.lengthOf(whatsapp.sentMessages, 1)
      assert.match(
        whatsapp.sentMessages[0],
        /ℹ️ Foi rodada dobrada — pontuação multiplicada por 2\./
      )
      assert.match(whatsapp.sentMessages[0], /Helvécio ⚽ — 6 pts/)
    } finally {
      teardownFakes()
    }
  })
})
