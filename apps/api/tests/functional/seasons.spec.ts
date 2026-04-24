import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import FootballDataClient from '#integrations/football_data/client'
import { SeasonFactory } from '#factories/season_factory'
import { FakeFootballDataClient, fakeStandings, fakeMatch } from '#tests/helpers/football_data_mock'

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

  test('POST /seasons/:id/sync cria round + match da rodada atual', async ({ client, assert }) => {
    const season = await SeasonFactory.merge({
      year: 2026,
      externalCompetitionCode: 'BSA',
    }).create()

    const fake = new FakeFootballDataClient()
    fake.standings = fakeStandings(12, 2026, { 1: 30, 2: 25, 3: 10, 4: 8 })
    fake.matchesByMatchday.set('2026:12', [fakeMatch(1001, 3, 4, 12), fakeMatch(1002, 1, 2, 12)])

    app.container.swap(FootballDataClient, () => fake as any)
    try {
      const res = await client.post(`/api/v1/seasons/${season.id}/sync`).headers(HEADERS)
      res.assertStatus(200)
      assert.equal(res.body().currentMatchday, 12)
      assert.equal(res.body().created, true)
      assert.equal(res.body().skipped, false)
      assert.equal(res.body().match.homeTeam, 'T1')
      assert.equal(res.body().match.awayTeam, 'T2')
      assert.equal(res.body().match.status, 'scheduled')
    } finally {
      app.container.restore(FootballDataClient)
    }
  })

  test('POST /seasons/:id/sync é idempotente', async ({ client, assert }) => {
    const season = await SeasonFactory.merge({
      year: 2026,
      externalCompetitionCode: 'BSA',
    }).create()

    const fake = new FakeFootballDataClient()
    fake.standings = fakeStandings(12, 2026, { 1: 30, 2: 25 })
    fake.matchesByMatchday.set('2026:12', [fakeMatch(1001, 1, 2, 12)])

    app.container.swap(FootballDataClient, () => fake as any)
    try {
      const first = await client.post(`/api/v1/seasons/${season.id}/sync`).headers(HEADERS)
      assert.equal(first.body().created, true)
      assert.isObject(first.body().match)

      const second = await client.post(`/api/v1/seasons/${season.id}/sync`).headers(HEADERS)
      assert.equal(second.body().created, false)
      assert.equal(second.body().skipped, true)
      assert.equal(second.body().match.id, first.body().match.id)
    } finally {
      app.container.restore(FootballDataClient)
    }
  })

  test('POST /seasons/:id/sync sem fixtures retorna reason', async ({ client, assert }) => {
    const season = await SeasonFactory.merge({
      year: 2026,
      externalCompetitionCode: 'BSA',
    }).create()

    const fake = new FakeFootballDataClient()
    fake.standings = fakeStandings(12, 2026, { 1: 30, 2: 25 })

    app.container.swap(FootballDataClient, () => fake as any)
    try {
      const res = await client.post(`/api/v1/seasons/${season.id}/sync`).headers(HEADERS)
      res.assertStatus(200)
      assert.equal(res.body().created, false)
      assert.equal(res.body().skipped, false)
      assert.match(res.body().reason, /nenhum jogo/i)
    } finally {
      app.container.restore(FootballDataClient)
    }
  })

  test('POST /seasons exige bearer token', async ({ client }) => {
    const res = await client.post('/api/v1/seasons').json(BASE_PAYLOAD)
    res.assertStatus(401)
  })
})
