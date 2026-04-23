import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import { UserFactory } from '#factories/user_factory'
import { RoundFactory } from '#factories/round_factory'
import { MatchFactory } from '#factories/match_factory'
import { GuessFactory } from '#factories/guess_factory'

const HEADERS = { authorization: 'Bearer test-admin-token' }

async function seedRoundMatchUser() {
  const round = await RoundFactory.with('season').merge({ status: 'open' }).create()
  const match = await MatchFactory.merge({ roundId: round.id }).create()
  const user = await UserFactory.create()
  return { round, match, user }
}

test.group('Guesses', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  test('POST /guesses cria palpite', async ({ client, assert }) => {
    const { match, user } = await seedRoundMatchUser()
    const res = await client
      .post('/api/v1/guesses')
      .headers(HEADERS)
      .json({ userId: user.id, matchId: match.id, homeScore: 2, awayScore: 1 })
    res.assertStatus(201)
    assert.equal(res.body().homeScore, 2)
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

  test('PATCH /guesses/:id edita', async ({ client, assert }) => {
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

  test('DELETE /guesses/:id faz soft delete', async ({ client }) => {
    const { match, user } = await seedRoundMatchUser()
    const guess = await GuessFactory.merge({ userId: user.id, matchId: match.id }).create()

    const res = await client.delete(`/api/v1/guesses/${guess.id}`).headers(HEADERS)
    res.assertStatus(204)
  })

  test('GET /rounds/:roundId/guesses lista palpites', async ({ client, assert }) => {
    const { round, match, user } = await seedRoundMatchUser()
    await GuessFactory.merge({ userId: user.id, matchId: match.id }).create()

    const res = await client.get(`/api/v1/rounds/${round.id}/guesses`).headers(HEADERS)
    res.assertStatus(200)
    assert.lengthOf(res.body(), 1)
  })

  test('POST /guesses exige bearer token', async ({ client }) => {
    const res = await client.post('/api/v1/guesses').json({})
    res.assertStatus(401)
  })
})
