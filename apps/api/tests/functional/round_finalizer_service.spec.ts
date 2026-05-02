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

  test('previewFinalize: retorna roundScores ordenados por pontos desc', async ({ assert }) => {
    const season = await SeasonFactory.create()
    const round = await RoundFactory.merge({
      seasonId: season.id,
      number: 7,
      status: 'closed',
    }).create()
    const match = await MatchFactory.merge({
      roundId: round.id,
      status: 'finished',
      homeScore: 2,
      awayScore: 1,
    }).create()

    const [exactUser, winnerUser, wrongUser] = await UserFactory.createMany(3)
    await Guess.createMany([
      { matchId: match.id, userId: exactUser.id, homeScore: 2, awayScore: 1 },
      { matchId: match.id, userId: winnerUser.id, homeScore: 3, awayScore: 0 },
      { matchId: match.id, userId: wrongUser.id, homeScore: 0, awayScore: 2 },
    ])

    const finalizer = await app.container.make(RoundFinalizerService)
    const preview = await finalizer.previewFinalize(round.id)

    assert.lengthOf(preview.roundScores, 3)
    assert.equal(preview.roundScores[0].points, 3)
    assert.equal(preview.roundScores[0].userId, exactUser.id)
    assert.equal(preview.roundScores[1].points, 1)
    assert.equal(preview.roundScores[2].points, 0)
  })

  test('previewFinalize: seasonRanking inclui delta dessa rodada', async ({ assert }) => {
    const season = await SeasonFactory.create()
    const round = await RoundFactory.merge({
      seasonId: season.id,
      number: 5,
      status: 'closed',
    }).create()
    const match = await MatchFactory.merge({
      roundId: round.id,
      status: 'finished',
      homeScore: 1,
      awayScore: 0,
    }).create()
    const user = await UserFactory.create()
    await Guess.create({
      matchId: match.id,
      userId: user.id,
      homeScore: 1,
      awayScore: 0,
    })

    await Score.create({
      userId: user.id,
      seasonId: season.id,
      totalPoints: 5,
      exactScoresCount: 1,
    } as any)

    const finalizer = await app.container.make(RoundFinalizerService)
    const preview = await finalizer.previewFinalize(round.id)

    assert.lengthOf(preview.seasonRanking, 1)
    assert.equal(preview.seasonRanking[0].totalPoints, 8)
    assert.equal(preview.seasonRanking[0].exactScoresCount, 2)
  })

  test('previewFinalize: NÃO persiste — DB intacto após chamada', async ({ assert }) => {
    const season = await SeasonFactory.create()
    const round = await RoundFactory.merge({
      seasonId: season.id,
      status: 'closed',
    }).create()
    const match = await MatchFactory.merge({
      roundId: round.id,
      status: 'finished',
      homeScore: 1,
      awayScore: 1,
    }).create()
    const user = await UserFactory.create()
    await Guess.create({
      matchId: match.id,
      userId: user.id,
      homeScore: 1,
      awayScore: 1,
    })

    const finalizer = await app.container.make(RoundFinalizerService)
    await finalizer.previewFinalize(round.id)

    const freshRound = await round.refresh()
    assert.equal(freshRound.status, 'closed')

    const guesses = await Guess.query().where('match_id', match.id)
    assert.isNull(guesses[0].points)

    const scoreCount = await Score.query().count('* as total')
    assert.equal(Number(scoreCount[0].$extras.total), 0)
  })

  test('finalize com pointsMultiplier=2: pontos dobrados, isExact correto', async ({ assert }) => {
    const season = await SeasonFactory.create()
    const round = await RoundFactory.merge({ seasonId: season.id, status: 'closed' }).create()
    const match = await MatchFactory.merge({
      roundId: round.id,
      status: 'finished',
      homeScore: 2,
      awayScore: 1,
      pointsMultiplier: 2,
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
    const byUser = Object.fromEntries(guesses.map((g) => [g.userId, g]))
    assert.equal(byUser[userExact.id].points, 6)
    assert.equal(byUser[userExact.id].isExact, true)
    assert.equal(byUser[userWinner.id].points, 2)
    assert.equal(byUser[userWinner.id].isExact, false)
    assert.equal(byUser[userWrong.id].points, 0)
    assert.equal(byUser[userWrong.id].isExact, false)
  })

  test('finalize dobrado: scores agregados refletem soma dobrada e exactScoresCount via is_exact', async ({
    assert,
  }) => {
    const season = await SeasonFactory.create()
    const round = await RoundFactory.merge({ seasonId: season.id, status: 'closed' }).create()
    const match = await MatchFactory.merge({
      roundId: round.id,
      status: 'finished',
      homeScore: 2,
      awayScore: 1,
      pointsMultiplier: 2,
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
    assert.equal(score!.totalPoints, 6)
    assert.equal(score!.exactScoresCount, 1)
  })

  test('previewFinalize com pointsMultiplier=2: roundScores e seasonRanking dobrados', async ({
    assert,
  }) => {
    const season = await SeasonFactory.create()
    const round = await RoundFactory.merge({ seasonId: season.id, status: 'closed' }).create()
    const match = await MatchFactory.merge({
      roundId: round.id,
      status: 'finished',
      homeScore: 1,
      awayScore: 0,
      pointsMultiplier: 2,
    }).create()
    const user = await UserFactory.create()
    await Guess.create({ matchId: match.id, userId: user.id, homeScore: 1, awayScore: 0 })

    const finalizer = await app.container.make(RoundFinalizerService)
    const preview = await finalizer.previewFinalize(round.id)

    assert.equal(preview.pointsMultiplier, 2)
    assert.equal(preview.roundScores[0].points, 6)
    assert.equal(preview.seasonRanking[0].totalPoints, 6)
    assert.equal(preview.seasonRanking[0].exactScoresCount, 1)
  })

  test('previewFinalize === finalize (consistência): preview prediz o que finalize persiste', async ({
    assert,
  }) => {
    const season = await SeasonFactory.create()
    const round = await RoundFactory.merge({
      seasonId: season.id,
      status: 'closed',
    }).create()
    const match = await MatchFactory.merge({
      roundId: round.id,
      status: 'finished',
      homeScore: 2,
      awayScore: 1,
    }).create()
    const [u1, u2] = await UserFactory.createMany(2)
    await Guess.createMany([
      { matchId: match.id, userId: u1.id, homeScore: 2, awayScore: 1 },
      { matchId: match.id, userId: u2.id, homeScore: 1, awayScore: 0 },
    ])

    const finalizer = await app.container.make(RoundFinalizerService)
    const preview = await finalizer.previewFinalize(round.id)
    await finalizer.finalize(round.id)

    const scores = await Score.query().where('season_id', season.id)

    for (const previewEntry of preview.seasonRanking) {
      const persisted = scores.find((s) => s.userId === previewEntry.userId)
      assert.isNotNull(persisted)
      assert.equal(persisted!.totalPoints, previewEntry.totalPoints)
      assert.equal(persisted!.exactScoresCount, previewEntry.exactScoresCount)
    }
  })

  test('finalize preserva baseline manual em scores quando guesses históricos não existem', async ({
    assert,
  }) => {
    const season = await SeasonFactory.create()
    const round = await RoundFactory.merge({ seasonId: season.id, status: 'closed' }).create()
    const match = await MatchFactory.merge({
      roundId: round.id,
      status: 'finished',
      homeScore: 0,
      awayScore: 1,
      pointsMultiplier: 2,
    }).create()
    const user = await UserFactory.create()
    await Guess.create({ matchId: match.id, userId: user.id, homeScore: 0, awayScore: 1 })

    await Score.create({
      userId: user.id,
      seasonId: season.id,
      totalPoints: 6,
      exactScoresCount: 1,
    })

    const finalizer = await app.container.make(RoundFinalizerService)
    await finalizer.finalize(round.id)

    const score = await Score.query()
      .where('user_id', user.id)
      .where('season_id', season.id)
      .first()
    assert.equal(score!.totalPoints, 12)
    assert.equal(score!.exactScoresCount, 2)
  })

  test('previewFinalize === finalize com baseline manual em scores', async ({ assert }) => {
    const season = await SeasonFactory.create()
    const round = await RoundFactory.merge({ seasonId: season.id, status: 'closed' }).create()
    const match = await MatchFactory.merge({
      roundId: round.id,
      status: 'finished',
      homeScore: 0,
      awayScore: 1,
      pointsMultiplier: 2,
    }).create()
    const user = await UserFactory.create()
    await Guess.create({ matchId: match.id, userId: user.id, homeScore: 0, awayScore: 1 })

    await Score.create({
      userId: user.id,
      seasonId: season.id,
      totalPoints: 6,
      exactScoresCount: 1,
    })

    const finalizer = await app.container.make(RoundFinalizerService)
    const preview = await finalizer.previewFinalize(round.id)
    await finalizer.finalize(round.id)

    const persisted = await Score.query()
      .where('user_id', user.id)
      .where('season_id', season.id)
      .first()
    const previewEntry = preview.seasonRanking.find((e) => e.userId === user.id)!
    assert.equal(persisted!.totalPoints, previewEntry.totalPoints)
    assert.equal(persisted!.exactScoresCount, previewEntry.exactScoresCount)
  })

  test('finalize idempotente preservando baseline manual: 2x produz mesmo resultado', async ({
    assert,
  }) => {
    const season = await SeasonFactory.create()
    const round = await RoundFactory.merge({ seasonId: season.id, status: 'closed' }).create()
    const match = await MatchFactory.merge({
      roundId: round.id,
      status: 'finished',
      homeScore: 0,
      awayScore: 1,
      pointsMultiplier: 2,
    }).create()
    const user = await UserFactory.create()
    await Guess.create({ matchId: match.id, userId: user.id, homeScore: 0, awayScore: 1 })

    await Score.create({
      userId: user.id,
      seasonId: season.id,
      totalPoints: 6,
      exactScoresCount: 1,
    })

    const finalizer = await app.container.make(RoundFinalizerService)
    await finalizer.finalize(round.id)
    await finalizer.finalize(round.id)

    const score = await Score.query()
      .where('user_id', user.id)
      .where('season_id', season.id)
      .first()
    assert.equal(score!.totalPoints, 12)
    assert.equal(score!.exactScoresCount, 2)
  })
})
