import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import CloseRoundJob from '#jobs/close_round_job'
import { SeasonFactory } from '#factories/season_factory'
import { RoundFactory } from '#factories/round_factory'
import { MatchFactory } from '#factories/match_factory'

test.group('CloseRoundJob', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  test('flipa round open → closed quando kickoff passou', async ({ assert }) => {
    const season = await SeasonFactory.create()
    const round = await RoundFactory.merge({
      seasonId: season.id,
      status: 'open',
    }).create()
    await MatchFactory.merge({
      roundId: round.id,
      kickoffAt: DateTime.now().minus({ minutes: 10 }),
    }).create()

    const job = await app.container.make(CloseRoundJob)
    const report = await job.run()

    assert.equal(report.closedCount, 1)
    const fresh = await round.refresh()
    assert.equal(fresh.status, 'closed')
  })

  test('ignora round open com kickoff futuro', async ({ assert }) => {
    const season = await SeasonFactory.create()
    const round = await RoundFactory.merge({
      seasonId: season.id,
      status: 'open',
    }).create()
    await MatchFactory.merge({
      roundId: round.id,
      kickoffAt: DateTime.now().plus({ hours: 3 }),
    }).create()

    const job = await app.container.make(CloseRoundJob)
    const report = await job.run()

    assert.equal(report.closedCount, 0)
    const fresh = await round.refresh()
    assert.equal(fresh.status, 'open')
  })

  test('ignora rounds pending / closed / finished mesmo com kickoff passado', async ({
    assert,
  }) => {
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

    const job = await app.container.make(CloseRoundJob)
    const report = await job.run()

    assert.equal(report.closedCount, 0)
    for (const [i, r] of rounds.entries()) {
      const fresh = await r.refresh()
      assert.equal(fresh.status, statuses[i])
    }
  })
})
