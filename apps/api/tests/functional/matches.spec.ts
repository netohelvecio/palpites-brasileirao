import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import FootballDataClient from '#integrations/football_data/client'
import Match from '#models/match'
import { RoundFactory } from '#factories/round_factory'
import { MatchFactory } from '#factories/match_factory'
import { RoundMatchCandidateFactory } from '#factories/round_match_candidate_factory'
import { SeasonFactory } from '#factories/season_factory'
import RoundCandidateRepository from '#repositories/round_candidate_repository'
import { FakeFootballDataClient, fakeMatch } from '#tests/helpers/football_data_mock'

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

  test('PUT /rounds/:roundId/match aceita pointsMultiplier no payload', async ({
    client,
    assert,
  }) => {
    const round = await RoundFactory.with('season').create()
    const res = await client.put(`/api/v1/rounds/${round.id}/match`).headers(HEADERS).json({
      externalId: 9999,
      homeTeam: 'A',
      awayTeam: 'B',
      kickoffAt: '2026-04-20T20:00:00.000Z',
      pointsMultiplier: 2,
    })
    res.assertStatus(200)

    const match = await Match.query().where('external_id', 9999).firstOrFail()
    assert.equal(match.pointsMultiplier, 2)
  })

  test('PUT /rounds/:roundId/match sem pointsMultiplier → default 1', async ({
    client,
    assert,
  }) => {
    const round = await RoundFactory.with('season').create()
    const res = await client.put(`/api/v1/rounds/${round.id}/match`).headers(HEADERS).json({
      externalId: 8888,
      homeTeam: 'X',
      awayTeam: 'Y',
      kickoffAt: '2026-04-20T20:00:00.000Z',
    })
    res.assertStatus(200)

    const match = await Match.query().where('external_id', 8888).firstOrFail()
    assert.equal(match.pointsMultiplier, 1)
  })

  test('PUT /rounds/:roundId/match com pointsMultiplier inválido (>10) → 422', async ({
    client,
  }) => {
    const round = await RoundFactory.with('season').create()
    const res = await client.put(`/api/v1/rounds/${round.id}/match`).headers(HEADERS).json({
      externalId: 7777,
      homeTeam: 'X',
      awayTeam: 'Y',
      kickoffAt: '2026-04-20T20:00:00.000Z',
      pointsMultiplier: 99,
    })
    res.assertStatus(422)
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

  test('GET /rounds/:roundId/match expõe pointsMultiplier', async ({ client, assert }) => {
    const round = await RoundFactory.with('season').create()
    await MatchFactory.merge({
      roundId: round.id,
      pointsMultiplier: 2,
    }).create()

    const res = await client.get(`/api/v1/rounds/${round.id}/match`).headers(HEADERS)
    res.assertStatus(200)
    assert.equal(res.body().pointsMultiplier, 2)
  })

  test('POST /rounds/:roundId/match/refresh-score atualiza placar e status', async ({
    client,
    assert,
  }) => {
    const round = await RoundFactory.with('season').create()
    const match = await MatchFactory.merge({
      roundId: round.id,
      externalId: 1001,
      status: 'scheduled',
      homeScore: null,
      awayScore: null,
    }).create()

    const fake = new FakeFootballDataClient()
    fake.matchById.set(
      1001,
      fakeMatch(1001, 1, 2, 12, {
        status: 'FINISHED',
        score: { fullTime: { home: 2, away: 1 }, winner: 'HOME_TEAM' },
      })
    )

    app.container.swap(FootballDataClient, () => fake as any)
    try {
      const res = await client
        .post(`/api/v1/rounds/${round.id}/match/refresh-score`)
        .headers(HEADERS)
      res.assertStatus(200)
      assert.equal(res.body().updated, true)

      await match.refresh()
      assert.equal(match.homeScore, 2)
      assert.equal(match.awayScore, 1)
      assert.equal(match.status, 'finished')
    } finally {
      app.container.restore(FootballDataClient)
    }
  })

  test('POST /rounds/:roundId/match/refresh-score retorna reason quando provider não acha', async ({
    client,
    assert,
  }) => {
    const round = await RoundFactory.with('season').create()
    await MatchFactory.merge({ roundId: round.id, externalId: 9999 }).create()

    const fake = new FakeFootballDataClient()

    app.container.swap(FootballDataClient, () => fake as any)
    try {
      const res = await client
        .post(`/api/v1/rounds/${round.id}/match/refresh-score`)
        .headers(HEADERS)
      res.assertStatus(200)
      assert.equal(res.body().updated, false)
      assert.match(res.body().reason, /não encontrado/i)
    } finally {
      app.container.restore(FootballDataClient)
    }
  })

  test('POST /rounds/:roundId/match/refresh-score 404 quando round não tem match', async ({
    client,
  }) => {
    const round = await RoundFactory.with('season').create()
    const res = await client.post(`/api/v1/rounds/${round.id}/match/refresh-score`).headers(HEADERS)
    res.assertStatus(404)
  })

  test('PUT /rounds/:roundId/match exige bearer token', async ({ client }) => {
    const round = await RoundFactory.with('season').create()
    const res = await client.put(`/api/v1/rounds/${round.id}/match`).json({})
    res.assertStatus(401)
  })

  test('PUT /rounds/:roundId/match em round awaiting_pick → cria match, flipa pra pending, soft-deleta candidatos', async ({
    client,
    assert,
  }) => {
    const season = await SeasonFactory.merge({ isActive: true }).create()
    const round = await RoundFactory.merge({
      seasonId: season.id,
      status: 'awaiting_pick',
    }).create()
    await RoundMatchCandidateFactory.merge({ roundId: round.id, position: 1 }).create()
    await RoundMatchCandidateFactory.merge({ roundId: round.id, position: 2 }).create()

    const res = await client.put(`/api/v1/rounds/${round.id}/match`).headers(HEADERS).json({
      externalId: 999,
      homeTeam: 'Override Home',
      awayTeam: 'Override Away',
      kickoffAt: '2026-05-04T20:00:00.000Z',
    })

    res.assertStatus(200)
    await round.refresh()
    assert.equal(round.status, 'pending')

    const candidateRepo = await app.container.make(RoundCandidateRepository)
    const remaining = await candidateRepo.list(round.id)
    assert.lengthOf(remaining, 0)
  })
})
