import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import FootballDataClient from '#integrations/football_data/client'
import WhatsAppClient from '#integrations/whatsapp/whatsapp_client'
import OpenRoundJob from '#jobs/open_round_job'
import { SeasonFactory } from '#factories/season_factory'
import { RoundFactory } from '#factories/round_factory'
import { MatchFactory } from '#factories/match_factory'
import { UserFactory } from '#factories/user_factory'
import { FakeFootballDataClient, fakeStandings, fakeMatch } from '#tests/helpers/football_data_mock'
import { FakeWhatsAppClient } from '#tests/helpers/whatsapp_mock'

test.group('OpenRoundJob', (group) => {
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

  test('abre round pendente após criar match via sync e envia mensagem', async ({ assert }) => {
    const season = await SeasonFactory.merge({
      isActive: true,
      year: 2026,
      externalCompetitionCode: 'BSA',
    }).create()

    const { football, whatsapp } = setupFakes()
    football.standings = fakeStandings(12, 2026, { 1: 30, 2: 25 })
    football.matchesByMatchday.set('2026:12', [fakeMatch(1001, 1, 2, 12)])

    try {
      const job = await app.container.make(OpenRoundJob)
      const report = await job.run()

      const run = report.runs[0]
      assert.equal(run.seasonId, season.id)
      assert.equal(run.roundOpened, true)
      assert.lengthOf(whatsapp.sentMessages, 1)
      assert.match(whatsapp.sentMessages[0], /📢 Rodada 12 aberta!/)
    } finally {
      teardownFakes()
    }
  })

  test('é idempotente: segunda execução não reabre nem envia mensagem', async ({ assert }) => {
    await SeasonFactory.merge({
      isActive: true,
      year: 2026,
      externalCompetitionCode: 'BSA',
    }).create()

    const { football, whatsapp } = setupFakes()
    football.standings = fakeStandings(12, 2026, { 1: 30, 2: 25 })
    football.matchesByMatchday.set('2026:12', [fakeMatch(1001, 1, 2, 12)])

    try {
      const job = await app.container.make(OpenRoundJob)
      await job.run()
      const second = await job.run()

      assert.equal(second.runs[0].roundOpened, false)
      assert.lengthOf(whatsapp.sentMessages, 1)
    } finally {
      teardownFakes()
    }
  })

  test('WhatsApp offline: não flipa status nem envia mensagem', async ({ assert }) => {
    const season = await SeasonFactory.merge({
      isActive: true,
      year: 2026,
      externalCompetitionCode: 'BSA',
    }).create()

    const { football, whatsapp } = setupFakes()
    whatsapp.setConnected(false)
    football.standings = fakeStandings(12, 2026, { 1: 30, 2: 25 })
    football.matchesByMatchday.set('2026:12', [fakeMatch(1001, 1, 2, 12)])

    try {
      const job = await app.container.make(OpenRoundJob)
      const report = await job.run()

      assert.equal(report.runs[0].roundOpened, false)
      assert.lengthOf(whatsapp.sentMessages, 0)

      const { default: RoundModel } = await import('#models/round')
      const round = await RoundModel.query()
        .where('season_id', season.id)
        .where('number', 12)
        .firstOrFail()
      assert.equal(round.status, 'pending')
    } finally {
      teardownFakes()
    }
  })

  test('send falha: não flipa status', async ({ assert }) => {
    const season = await SeasonFactory.merge({
      isActive: true,
      year: 2026,
      externalCompetitionCode: 'BSA',
    }).create()

    const { football, whatsapp } = setupFakes()
    whatsapp.throwOnSend = new Error('baileys timeout')
    football.standings = fakeStandings(12, 2026, { 1: 30, 2: 25 })
    football.matchesByMatchday.set('2026:12', [fakeMatch(1001, 1, 2, 12)])

    try {
      const job = await app.container.make(OpenRoundJob)
      const report = await job.run()

      assert.equal(report.runs[0].roundOpened, false)
      assert.isDefined(report.runs[0].error)

      const { default: RoundModel } = await import('#models/round')
      const round = await RoundModel.query()
        .where('season_id', season.id)
        .where('number', 12)
        .firstOrFail()
      assert.equal(round.status, 'pending')
    } finally {
      teardownFakes()
    }
  })

  test('ignora season inativa', async ({ assert }) => {
    await SeasonFactory.merge({ isActive: false }).create()
    setupFakes()
    try {
      const job = await app.container.make(OpenRoundJob)
      const report = await job.run()
      assert.lengthOf(report.runs, 0)
    } finally {
      teardownFakes()
    }
  })

  test('erro do football-data não quebra: registra em errors', async ({ assert }) => {
    await SeasonFactory.merge({ isActive: true, externalCompetitionCode: 'BSA' }).create()
    const { whatsapp } = setupFakes()
    try {
      const job = await app.container.make(OpenRoundJob)
      const report = await job.run()

      assert.lengthOf(report.runs, 1)
      assert.isDefined(report.runs[0].error)
      assert.lengthOf(whatsapp.sentMessages, 0)
    } finally {
      teardownFakes()
    }
  })

  test('não sobrescreve round que já está open', async ({ assert }) => {
    const season = await SeasonFactory.merge({
      isActive: true,
      year: 2026,
      externalCompetitionCode: 'BSA',
    }).create()
    const round = await RoundFactory.merge({
      seasonId: season.id,
      number: 12,
      status: 'open',
    }).create()
    await MatchFactory.merge({ roundId: round.id }).create()

    const { football, whatsapp } = setupFakes()
    football.standings = fakeStandings(12, 2026, { 1: 30, 2: 25 })
    football.matchesByMatchday.set('2026:12', [fakeMatch(1001, 1, 2, 12)])

    try {
      const job = await app.container.make(OpenRoundJob)
      const report = await job.run()

      assert.equal(report.runs[0].roundOpened, false)
      assert.lengthOf(whatsapp.sentMessages, 0)
      const fresh = await round.refresh()
      assert.equal(fresh.status, 'open')
    } finally {
      teardownFakes()
    }
  })

  test('DM personalizada pra cada user após flip pra open', async ({ assert }) => {
    await SeasonFactory.merge({
      isActive: true,
      year: 2026,
      externalCompetitionCode: 'BSA',
    }).create()
    await UserFactory.merge({
      whatsappNumber: '5511999990001',
      name: 'Helvécio',
      emoji: '⚽',
    }).create()
    await UserFactory.merge({
      whatsappNumber: '5511999990002',
      name: 'Ana',
      emoji: '🦊',
    }).create()

    const { football, whatsapp } = setupFakes()
    football.standings = fakeStandings(12, 2026, { 1: 30, 2: 25 })
    football.matchesByMatchday.set('2026:12', [fakeMatch(1001, 1, 2, 12)])

    try {
      const job = await app.container.make(OpenRoundJob)
      const report = await job.run()

      assert.equal(report.runs[0].roundOpened, true)
      assert.lengthOf(whatsapp.sentMessages, 1)

      assert.lengthOf(whatsapp.sentDms, 2)
      const numbers = whatsapp.sentDms.map((d) => d.number).sort()
      assert.deepEqual(numbers, ['5511999990001', '5511999990002'])

      const helvecioDm = whatsapp.sentDms.find((d) => d.number === '5511999990001')
      assert.match(helvecioDm!.text, /Oi Helvécio ⚽!/)
      assert.match(helvecioDm!.text, /Rodada 12 aberta/)

      const anaDm = whatsapp.sentDms.find((d) => d.number === '5511999990002')
      assert.match(anaDm!.text, /Oi Ana 🦊!/)
    } finally {
      teardownFakes()
    }
  }).timeout(15000)

  test('falha de DM individual não trava outros users nem desfaz flip', async ({ assert }) => {
    const season = await SeasonFactory.merge({
      isActive: true,
      year: 2026,
      externalCompetitionCode: 'BSA',
    }).create()
    await UserFactory.merge({ whatsappNumber: '5511999990003' }).create()
    await UserFactory.merge({ whatsappNumber: '5511999990004' }).create()

    const { football, whatsapp } = setupFakes()
    whatsapp.throwOnSendToUser = new Error('baileys: number blocked')
    football.standings = fakeStandings(12, 2026, { 1: 30, 2: 25 })
    football.matchesByMatchday.set('2026:12', [fakeMatch(1001, 1, 2, 12)])

    try {
      const job = await app.container.make(OpenRoundJob)
      const report = await job.run()

      assert.equal(report.runs[0].roundOpened, true)
      assert.lengthOf(whatsapp.sentMessages, 1)
      assert.lengthOf(whatsapp.sentDms, 0)

      const { default: RoundModel } = await import('#models/round')
      const round = await RoundModel.query()
        .where('season_id', season.id)
        .where('number', 12)
        .firstOrFail()
      assert.equal(round.status, 'open')
    } finally {
      teardownFakes()
    }
  }).timeout(15000)
})
