import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import { RoundFactory } from '#factories/round_factory'
import { SeasonFactory } from '#factories/season_factory'

const HEADERS = { authorization: 'Bearer test-admin-token' }

test.group('Rounds', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  test('GET /seasons/:seasonId/rounds lista rodadas', async ({ client, assert }) => {
    const season = await SeasonFactory.create()
    await RoundFactory.merge([{ seasonId: season.id, number: 1 }, { seasonId: season.id, number: 2 }]).createMany(2)

    const res = await client.get(`/api/v1/seasons/${season.id}/rounds`).headers(HEADERS)
    res.assertStatus(200)
    assert.lengthOf(res.body(), 2)
  })

  test('GET /rounds/:id retorna detalhe', async ({ client, assert }) => {
    const round = await RoundFactory.with('season').merge({ number: 7 }).create()
    const res = await client.get(`/api/v1/rounds/${round.id}`).headers(HEADERS)
    res.assertStatus(200)
    assert.equal(res.body().number, 7)
  })

  test('PATCH /rounds/:id/status muda status', async ({ client, assert }) => {
    const round = await RoundFactory.with('season').create()
    const res = await client
      .patch(`/api/v1/rounds/${round.id}/status`)
      .headers(HEADERS)
      .json({ status: 'open' })
    res.assertStatus(200)
    assert.equal(res.body().status, 'open')
  })

  test('PATCH /rounds/:id/status rejeita valor inválido', async ({ client }) => {
    const round = await RoundFactory.with('season').create()
    const res = await client
      .patch(`/api/v1/rounds/${round.id}/status`)
      .headers(HEADERS)
      .json({ status: 'banana' })
    res.assertStatus(422)
  })

  test('GET /rounds exige bearer token', async ({ client }) => {
    const round = await RoundFactory.with('season').create()
    const res = await client.get(`/api/v1/rounds/${round.id}`)
    res.assertStatus(401)
  })
})
