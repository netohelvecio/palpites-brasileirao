import { DateTime } from 'luxon'
import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import type { RoundStatus } from '@palpites/shared'
import { UserFactory } from '#factories/user_factory'
import { RoundFactory } from '#factories/round_factory'
import { MatchFactory } from '#factories/match_factory'
import { GuessFactory } from '#factories/guess_factory'

const HEADERS = { authorization: 'Bearer test-admin-token' }

async function seedRoundMatchUser(opts: { roundStatus?: RoundStatus; kickoffAt?: DateTime } = {}) {
  const round = await RoundFactory.with('season')
    .merge({ status: opts.roundStatus ?? 'open' })
    .create()
  const match = await MatchFactory.merge({
    roundId: round.id,
    kickoffAt: opts.kickoffAt ?? DateTime.now().plus({ days: 3 }),
  }).create()
  const user = await UserFactory.create()
  return { round, match, user }
}

test.group('Guesses', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  test('POST /guesses cria palpite quando rodada está open', async ({ client, assert }) => {
    const { match, user } = await seedRoundMatchUser()
    const res = await client
      .post('/api/v1/guesses')
      .headers(HEADERS)
      .json({ userId: user.id, matchId: match.id, homeScore: 2, awayScore: 1 })
    res.assertStatus(201)
    assert.equal(res.body().homeScore, 2)
  })

  test('POST /guesses rejeita quando rodada está pending', async ({ client }) => {
    const { match, user } = await seedRoundMatchUser({ roundStatus: 'pending' })
    const res = await client
      .post('/api/v1/guesses')
      .headers(HEADERS)
      .json({ userId: user.id, matchId: match.id, homeScore: 2, awayScore: 1 })
    res.assertStatus(422)
  })

  test('POST /guesses rejeita quando rodada está closed', async ({ client }) => {
    const { match, user } = await seedRoundMatchUser({ roundStatus: 'closed' })
    const res = await client
      .post('/api/v1/guesses')
      .headers(HEADERS)
      .json({ userId: user.id, matchId: match.id, homeScore: 2, awayScore: 1 })
    res.assertStatus(422)
  })

  test('POST /guesses rejeita quando kickoff já passou', async ({ client }) => {
    const { match, user } = await seedRoundMatchUser({
      kickoffAt: DateTime.now().minus({ hours: 1 }),
    })
    const res = await client
      .post('/api/v1/guesses')
      .headers(HEADERS)
      .json({ userId: user.id, matchId: match.id, homeScore: 2, awayScore: 1 })
    res.assertStatus(422)
  })

  test('POST /guesses rejeita duplicado (user+match)', async ({ client }) => {
    const { match, user } = await seedRoundMatchUser()
    await GuessFactory.merge({ userId: user.id, matchId: match.id }).create()

    const res = await client
      .post('/api/v1/guesses')
      .headers(HEADERS)
      .json({ userId: user.id, matchId: match.id, homeScore: 0, awayScore: 0 })
    res.assertStatus(422)
  })

  test('PATCH /guesses/:id edita quando rodada está open', async ({ client, assert }) => {
    const { match, user } = await seedRoundMatchUser()
    const guess = await GuessFactory.merge({
      userId: user.id,
      matchId: match.id,
      homeScore: 1,
      awayScore: 1,
    }).create()

    const res = await client
      .patch(`/api/v1/guesses/${guess.id}`)
      .headers(HEADERS)
      .json({ homeScore: 3, awayScore: 0 })
    res.assertStatus(200)
    assert.equal(res.body().homeScore, 3)
  })

  test('PATCH /guesses/:id rejeita quando rodada não está open', async ({ client }) => {
    const { match, user } = await seedRoundMatchUser({ roundStatus: 'closed' })
    const guess = await GuessFactory.merge({
      userId: user.id,
      matchId: match.id,
    }).create()

    const res = await client
      .patch(`/api/v1/guesses/${guess.id}`)
      .headers(HEADERS)
      .json({ homeScore: 3, awayScore: 0 })
    res.assertStatus(422)
  })

  test('DELETE /guesses/:id faz soft delete independente do status', async ({ client }) => {
    const { match, user } = await seedRoundMatchUser({ roundStatus: 'closed' })
    const guess = await GuessFactory.merge({ userId: user.id, matchId: match.id }).create()

    const res = await client.delete(`/api/v1/guesses/${guess.id}`).headers(HEADERS)
    res.assertStatus(204)
  })

  test('GET /rounds/:roundId/guesses retorna match + guesses formatados', async ({
    client,
    assert,
  }) => {
    const { round, match, user } = await seedRoundMatchUser()
    await GuessFactory.merge({
      userId: user.id,
      matchId: match.id,
      homeScore: 2,
      awayScore: 1,
    }).create()

    const res = await client.get(`/api/v1/rounds/${round.id}/guesses`).headers(HEADERS)
    res.assertStatus(200)

    const body = res.body()
    assert.equal(body.match.id, match.id)
    assert.equal(body.match.homeTeam, match.homeTeam)
    assert.equal(body.match.awayTeam, match.awayTeam)
    assert.lengthOf(body.guesses, 1)
    assert.equal(body.guesses[0].homeScore, 2)
    assert.equal(body.guesses[0].awayScore, 1)
    assert.equal(body.guesses[0].user.id, user.id)
    assert.equal(body.guesses[0].user.name, user.name)
    assert.notExists(body.guesses[0].user.whatsappNumber)
    assert.notExists(body.guesses[0].isDeleted)
    assert.notExists(body.guesses[0].createdAt)
  })

  test('GET /rounds/:roundId/guesses retorna match:null + guesses:[] quando rodada não tem jogo', async ({
    client,
    assert,
  }) => {
    const round = await RoundFactory.with('season').create()
    const res = await client.get(`/api/v1/rounds/${round.id}/guesses`).headers(HEADERS)
    res.assertStatus(200)
    assert.isNull(res.body().match)
    assert.lengthOf(res.body().guesses, 0)
  })

  test('POST /guesses exige bearer token', async ({ client }) => {
    const res = await client.post('/api/v1/guesses').json({})
    res.assertStatus(401)
  })
})
