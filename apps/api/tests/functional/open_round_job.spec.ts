import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import FootballDataClient from '#integrations/football_data/client'
import OpenRoundJob from '#jobs/open_round_job'
import { SeasonFactory } from '#factories/season_factory'
import { RoundFactory } from '#factories/round_factory'
import { MatchFactory } from '#factories/match_factory'
import { FakeFootballDataClient, fakeStandings, fakeMatch } from '#tests/helpers/football_data_mock'

test.group('OpenRoundJob', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  test('abre round pendente após criar match via sync', async ({ assert }) => {
    const season = await SeasonFactory.merge({
      isActive: true,
      year: 2026,
      externalCompetitionCode: 'BSA',
    }).create()

    const fake = new FakeFootballDataClient()
    fake.standings = fakeStandings(12, 2026, { 1: 30, 2: 25 })
    fake.matchesByMatchday.set('2026:12', [fakeMatch(1001, 1, 2, 12)])

    app.container.swap(FootballDataClient, () => fake as any)
    try {
      const job = await app.container.make(OpenRoundJob)
      const report = await job.run()

      assert.lengthOf(report.runs, 1)
      const run = report.runs[0]
      assert.equal(run.seasonId, season.id)
      assert.isNotNull(run.syncReport)
      assert.equal(run.syncReport!.currentMatchday, 12)
      assert.equal(run.roundOpened, true)
    } finally {
      app.container.restore(FootballDataClient)
    }
  })

  test('é idempotente: segunda execução não reabre', async ({ assert }) => {
    await SeasonFactory.merge({
      isActive: true,
      year: 2026,
      externalCompetitionCode: 'BSA',
    }).create()

    const fake = new FakeFootballDataClient()
    fake.standings = fakeStandings(12, 2026, { 1: 30, 2: 25 })
    fake.matchesByMatchday.set('2026:12', [fakeMatch(1001, 1, 2, 12)])

    app.container.swap(FootballDataClient, () => fake as any)
    try {
      const job = await app.container.make(OpenRoundJob)
      await job.run()
      const second = await job.run()

      assert.equal(second.runs[0].roundOpened, false)
    } finally {
      app.container.restore(FootballDataClient)
    }
  })

  test('ignora season inativa', async ({ assert }) => {
    await SeasonFactory.merge({ isActive: false }).create()

    const fake = new FakeFootballDataClient()
    app.container.swap(FootballDataClient, () => fake as any)
    try {
      const job = await app.container.make(OpenRoundJob)
      const report = await job.run()
      assert.lengthOf(report.runs, 0)
    } finally {
      app.container.restore(FootballDataClient)
    }
  })

  test('erro em uma season não quebra o job: registra em errors', async ({ assert }) => {
    await SeasonFactory.merge({ isActive: true, externalCompetitionCode: 'BSA' }).create()

    const fake = new FakeFootballDataClient()
    // standings não setado → fetchStandings throws no fake
    app.container.swap(FootballDataClient, () => fake as any)
    try {
      const job = await app.container.make(OpenRoundJob)
      const report = await job.run()

      assert.lengthOf(report.runs, 1)
      assert.isDefined(report.runs[0].error)
    } finally {
      app.container.restore(FootballDataClient)
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

    const fake = new FakeFootballDataClient()
    fake.standings = fakeStandings(12, 2026, { 1: 30, 2: 25 })
    fake.matchesByMatchday.set('2026:12', [fakeMatch(1001, 1, 2, 12)])

    app.container.swap(FootballDataClient, () => fake as any)
    try {
      const job = await app.container.make(OpenRoundJob)
      const report = await job.run()

      assert.equal(report.runs[0].roundOpened, false)
      const fresh = await round.refresh()
      assert.equal(fresh.status, 'open')
    } finally {
      app.container.restore(FootballDataClient)
    }
  })
})
