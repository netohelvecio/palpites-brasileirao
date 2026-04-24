import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import RoundFinalizerService from '#services/round_finalizer_service'
import Guess from '#models/guess'
import Score from '#models/score'
import { SeasonFactory } from '#factories/season_factory'
import { RoundFactory } from '#factories/round_factory'
import { MatchFactory } from '#factories/match_factory'
import { UserFactory } from '#factories/user_factory'

test.group('RoundFinalizerService', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  test('calcula pontos por guess (3/1/0) e flipa round → finished', async ({ assert }) => {
    const season = await SeasonFactory.create()
    const round = await RoundFactory.merge({ seasonId: season.id, status: 'closed' }).create()
    const match = await MatchFactory.merge({
      roundId: round.id,
      status: 'finished',
      homeScore: 2,
      awayScore: 1,
      kickoffAt: DateTime.now().minus({ hours: 3 }),
    }).create()

    const [userExact, userWinner, userWrong] = await UserFactory.createMany(3)
    await Guess.createMany([
      { matchId: match.id, userId: userExact.id, homeScore: 2, awayScore: 1 },
      { matchId: match.id, userId: userWinner.id, homeScore: 3, awayScore: 0 },
      { matchId: match.id, userId: userWrong.id, homeScore: 0, awayScore: 2 },
    ])

    const finalizer = await app.container.make(RoundFinalizerService)
    await finalizer.finalize(round.id)

    const guesses = await Guess.query().where('match_id', match.id)
    const byUser = Object.fromEntries(guesses.map((g) => [g.userId, g.points]))
    assert.equal(byUser[userExact.id], 3)
    assert.equal(byUser[userWinner.id], 1)
    assert.equal(byUser[userWrong.id], 0)

    const fresh = await round.refresh()
    assert.equal(fresh.status, 'finished')
  })

  test('upsert em scores: soma total + conta exact scores', async ({ assert }) => {
    const season = await SeasonFactory.create()
    const round = await RoundFactory.merge({ seasonId: season.id, status: 'closed' }).create()
    const match = await MatchFactory.merge({
      roundId: round.id,
      status: 'finished',
      homeScore: 2,
      awayScore: 1,
    }).create()
    const user = await UserFactory.create()
    await Guess.create({ matchId: match.id, userId: user.id, homeScore: 2, awayScore: 1 })

    const finalizer = await app.container.make(RoundFinalizerService)
    await finalizer.finalize(round.id)

    const score = await Score.query()
      .where('user_id', user.id)
      .where('season_id', season.id)
      .first()
    assert.isNotNull(score)
    assert.equal(score!.totalPoints, 3)
    assert.equal(score!.exactScoresCount, 1)
  })

  test('idempotente: finalize 2x produz mesmo resultado', async ({ assert }) => {
    const season = await SeasonFactory.create()
    const round = await RoundFactory.merge({ seasonId: season.id, status: 'closed' }).create()
    const match = await MatchFactory.merge({
      roundId: round.id,
      status: 'finished',
      homeScore: 1,
      awayScore: 1,
    }).create()
    const user = await UserFactory.create()
    await Guess.create({ matchId: match.id, userId: user.id, homeScore: 1, awayScore: 1 })

    const finalizer = await app.container.make(RoundFinalizerService)
    await finalizer.finalize(round.id)
    await finalizer.finalize(round.id)

    const score = await Score.query().where('user_id', user.id).first()
    assert.equal(score!.totalPoints, 3)
    assert.equal(score!.exactScoresCount, 1)
  })

  test('throws se match não está finished', async ({ assert }) => {
    const season = await SeasonFactory.create()
    const round = await RoundFactory.merge({ seasonId: season.id, status: 'closed' }).create()
    await MatchFactory.merge({ roundId: round.id, status: 'live' }).create()

    const finalizer = await app.container.make(RoundFinalizerService)
    await assert.rejects(() => finalizer.finalize(round.id), /match não finalizado/i)
  })
})
