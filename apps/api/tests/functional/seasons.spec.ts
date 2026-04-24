import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import { SeasonFactory } from '#factories/season_factory'

const HEADERS = { authorization: 'Bearer test-admin-token' }
const BASE_PAYLOAD = {
  year: 2026,
  name: 'Brasileirão 2026',
  externalCompetitionCode: 'BSA',
  isActive: true,
  startsAt: '2026-04-12T00:00:00.000Z',
  endsAt: '2026-12-08T00:00:00.000Z',
}

test.group('Seasons', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  test('POST /seasons cria', async ({ client, assert }) => {
    const res = await client.post('/api/v1/seasons').headers(HEADERS).json(BASE_PAYLOAD)
    res.assertStatus(201)
    assert.equal(res.body().year, 2026)
  })

  test('GET /seasons lista', async ({ client, assert }) => {
    await SeasonFactory.createMany(2)
    const res = await client.get('/api/v1/seasons').headers(HEADERS)
    res.assertStatus(200)
    assert.lengthOf(res.body(), 2)
  })

  test('PATCH /seasons/:id edita', async ({ client, assert }) => {
    const season = await SeasonFactory.merge({ isActive: false }).create()
    const res = await client
      .patch(`/api/v1/seasons/${season.id}`)
      .headers(HEADERS)
      .json({ isActive: true })
    res.assertStatus(200)
    assert.equal(res.body().isActive, true)
  })

  test('POST /seasons/:id/sync retorna 202 (stub)', async ({ client }) => {
    const season = await SeasonFactory.create()
    const res = await client.post(`/api/v1/seasons/${season.id}/sync`).headers(HEADERS)
    res.assertStatus(202)
  })

  test('POST /seasons exige bearer token', async ({ client }) => {
    const res = await client.post('/api/v1/seasons').json(BASE_PAYLOAD)
    res.assertStatus(401)
  })
})
