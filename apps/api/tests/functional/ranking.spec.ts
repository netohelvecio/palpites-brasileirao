import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import { SeasonFactory } from '#factories/season_factory'
import { UserFactory } from '#factories/user_factory'
import { ScoreFactory } from '#factories/score_factory'
import { RoundFactory } from '#factories/round_factory'
import { MatchFactory } from '#factories/match_factory'
import { GuessFactory } from '#factories/guess_factory'

const HEADERS = { authorization: 'Bearer test-admin-token' }

test.group('Ranking', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  test('GET /seasons/:id/ranking ordena por pts desc e desempata por exactScoresCount', async ({
    client,
    assert,
  }) => {
    const season = await SeasonFactory.create()
    const u1 = await UserFactory.merge({ name: 'A', emoji: '⚽' }).create()
    const u2 = await UserFactory.merge({ name: 'B', emoji: '🐍' }).create()
    const u3 = await UserFactory.merge({ name: 'C', emoji: '🐯' }).create()

    await ScoreFactory.merge({
      userId: u1.id,
      seasonId: season.id,
      totalPoints: 10,
      exactScoresCount: 1,
    }).create()
    await ScoreFactory.merge({
      userId: u2.id,
      seasonId: season.id,
      totalPoints: 10,
      exactScoresCount: 3,
    }).create()
    await ScoreFactory.merge({
      userId: u3.id,
      seasonId: season.id,
      totalPoints: 20,
      exactScoresCount: 0,
    }).create()

    const res = await client.get(`/api/v1/seasons/${season.id}/ranking`).headers(HEADERS)
    res.assertStatus(200)
    assert.deepEqual(
      res.body().map((e: any) => e.name),
      ['C', 'B', 'A']
    )
  })

  test('GET /rounds/:id/ranking retorna pontos da rodada ordenados', async ({ client, assert }) => {
    const round = await RoundFactory.with('season').merge({ status: 'finished' }).create()
    const match = await MatchFactory.merge({
      roundId: round.id,
      homeScore: 2,
      awayScore: 1,
      status: 'finished',
    }).create()

    const u1 = await UserFactory.merge({ name: 'Alice', emoji: '⚽' }).create()
    const u2 = await UserFactory.merge({ name: 'Bob', emoji: '🐍' }).create()

    await GuessFactory.merge({
      userId: u1.id,
      matchId: match.id,
      homeScore: 2,
      awayScore: 1,
      points: 3,
    }).create()
    await GuessFactory.merge({
      userId: u2.id,
      matchId: match.id,
      homeScore: 1,
      awayScore: 0,
      points: 1,
    }).create()

    const res = await client.get(`/api/v1/rounds/${round.id}/ranking`).headers(HEADERS)
    res.assertStatus(200)
    assert.equal(res.body()[0].points, 3)
    assert.equal(res.body()[0].name, 'Alice')
    assert.equal(res.body()[1].points, 1)
  })

  test('GET /rounds/:id/ranking retorna array vazio sem jogo', async ({ client, assert }) => {
    const round = await RoundFactory.with('season').create()
    const res = await client.get(`/api/v1/rounds/${round.id}/ranking`).headers(HEADERS)
    res.assertStatus(200)
    assert.lengthOf(res.body(), 0)
  })
})
