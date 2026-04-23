import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import { RoundFactory } from '#factories/round_factory'
import { MatchFactory } from '#factories/match_factory'

const HEADERS = { authorization: 'Bearer test-admin-token' }

test.group('Matches', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  test('PUT /rounds/:roundId/match cria jogo', async ({ client, assert }) => {
    const round = await RoundFactory.with('season').create()
    const res = await client.put(`/api/v1/rounds/${round.id}/match`).headers(HEADERS).json({
      externalId: 12345,
      homeTeam: 'Flamengo',
      awayTeam: 'Palmeiras',
      kickoffAt: '2026-04-20T20:00:00.000Z',
    })
    res.assertStatus(200)
    assert.equal(res.body().homeTeam, 'Flamengo')
  })

  test('PUT /rounds/:roundId/match sobrescreve existente', async ({ client, assert }) => {
    const round = await RoundFactory.with('season').create()
    await MatchFactory.merge({ roundId: round.id, homeTeam: 'A', awayTeam: 'B' }).create()

    const res = await client.put(`/api/v1/rounds/${round.id}/match`).headers(HEADERS).json({
      externalId: 2,
      homeTeam: 'C',
      awayTeam: 'D',
      kickoffAt: '2026-04-20T20:00:00.000Z',
    })
    res.assertStatus(200)
    assert.equal(res.body().homeTeam, 'C')
  })

  test('GET /rounds/:roundId/match retorna jogo', async ({ client, assert }) => {
    const round = await RoundFactory.with('season').create()
    await MatchFactory.merge({ roundId: round.id, awayTeam: 'Palmeiras' }).create()

    const res = await client.get(`/api/v1/rounds/${round.id}/match`).headers(HEADERS)
    res.assertStatus(200)
    assert.equal(res.body().awayTeam, 'Palmeiras')
  })

  test('GET /rounds/:roundId/match retorna 404 sem jogo', async ({ client }) => {
    const round = await RoundFactory.with('season').create()
    const res = await client.get(`/api/v1/rounds/${round.id}/match`).headers(HEADERS)
    res.assertStatus(404)
  })

  test('POST /rounds/:roundId/match/refresh-score retorna 202 (stub)', async ({ client }) => {
    const round = await RoundFactory.with('season').create()
    const res = await client.post(`/api/v1/rounds/${round.id}/match/refresh-score`).headers(HEADERS)
    res.assertStatus(202)
  })

  test('PUT /rounds/:roundId/match exige bearer token', async ({ client }) => {
    const round = await RoundFactory.with('season').create()
    const res = await client.put(`/api/v1/rounds/${round.id}/match`).json({})
    res.assertStatus(401)
  })
})
