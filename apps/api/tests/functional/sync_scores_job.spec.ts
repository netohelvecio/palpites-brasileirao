import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import FootballDataClient from '#integrations/football_data/client'
import SyncScoresJob from '#jobs/sync_scores_job'
import Guess from '#models/guess'
import { SeasonFactory } from '#factories/season_factory'
import { RoundFactory } from '#factories/round_factory'
import { MatchFactory } from '#factories/match_factory'
import { UserFactory } from '#factories/user_factory'
import { FakeFootballDataClient, fakeMatch } from '#tests/helpers/football_data_mock'

test.group('SyncScoresJob', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  test('refresh + finaliza round quando match vira FINISHED com round closed', async ({
    assert,
  }) => {
    const season = await SeasonFactory.merge({ isActive: true }).create()
    const round = await RoundFactory.merge({ seasonId: season.id, status: 'closed' }).create()
    const match = await MatchFactory.merge({
      roundId: round.id,
      externalId: 1001,
      status: 'live',
      homeScore: null,
      awayScore: null,
    }).create()
    const user = await UserFactory.create()
    await Guess.create({ matchId: match.id, userId: user.id, homeScore: 2, awayScore: 1 })

    const fake = new FakeFootballDataClient()
    fake.matchById.set(
      1001,
      fakeMatch(1001, 1, 2, 12, {
        status: 'FINISHED',
        score: { fullTime: { home: 2, away: 1 }, winner: 'HOME_TEAM' },
      })
    )

    app.container.swap(FootballDataClient, () => fake as any)
    try {
      const job = await app.container.make(SyncScoresJob)
      const report = await job.run()

      assert.lengthOf(report.runs, 1)
      assert.isTrue(report.runs[0].refreshed)
      assert.isTrue(report.runs[0].finalized)

      const freshRound = await round.refresh()
      assert.equal(freshRound.status, 'finished')
    } finally {
      app.container.restore(FootballDataClient)
    }
  })

  test('só refresh (sem finalize) se match ainda não está finished', async ({ assert }) => {
    const season = await SeasonFactory.merge({ isActive: true }).create()
    const round = await RoundFactory.merge({ seasonId: season.id, status: 'open' }).create()
    await MatchFactory.merge({
      roundId: round.id,
      externalId: 1002,
      status: 'scheduled',
    }).create()

    const fake = new FakeFootballDataClient()
    fake.matchById.set(
      1002,
      fakeMatch(1002, 1, 2, 12, {
        status: 'IN_PLAY',
        score: { fullTime: { home: 0, away: 0 }, winner: null },
      })
    )

    app.container.swap(FootballDataClient, () => fake as any)
    try {
      const job = await app.container.make(SyncScoresJob)
      const report = await job.run()

      assert.isTrue(report.runs[0].refreshed)
      assert.isFalse(report.runs[0].finalized)

      const freshRound = await round.refresh()
      assert.equal(freshRound.status, 'open')
    } finally {
      app.container.restore(FootballDataClient)
    }
  })

  test('match finished mas round ainda open: só refresh, não finaliza', async ({ assert }) => {
    const season = await SeasonFactory.merge({ isActive: true }).create()
    const round = await RoundFactory.merge({ seasonId: season.id, status: 'open' }).create()
    await MatchFactory.merge({
      roundId: round.id,
      externalId: 1003,
      status: 'live',
    }).create()

    const fake = new FakeFootballDataClient()
    fake.matchById.set(
      1003,
      fakeMatch(1003, 1, 2, 12, {
        status: 'FINISHED',
        score: { fullTime: { home: 1, away: 0 }, winner: 'HOME_TEAM' },
      })
    )

    app.container.swap(FootballDataClient, () => fake as any)
    try {
      const job = await app.container.make(SyncScoresJob)
      const report = await job.run()

      assert.isFalse(report.runs[0].finalized)
      const freshRound = await round.refresh()
      assert.equal(freshRound.status, 'open')
    } finally {
      app.container.restore(FootballDataClient)
    }
  })

  test('ignora matches de season inativa', async ({ assert }) => {
    const season = await SeasonFactory.merge({ isActive: false }).create()
    const round = await RoundFactory.merge({ seasonId: season.id }).create()
    await MatchFactory.merge({ roundId: round.id, status: 'scheduled' }).create()

    const fake = new FakeFootballDataClient()
    app.container.swap(FootballDataClient, () => fake as any)
    try {
      const job = await app.container.make(SyncScoresJob)
      const report = await job.run()
      assert.lengthOf(report.runs, 0)
    } finally {
      app.container.restore(FootballDataClient)
    }
  })
})
