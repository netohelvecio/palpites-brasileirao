import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import { RoundFactory } from '#factories/round_factory'
import { SeasonFactory } from '#factories/season_factory'
import { RoundMatchCandidateFactory } from '#factories/round_match_candidate_factory'

const HEADERS = { authorization: 'Bearer test-admin-token' }

test.group('GET /rounds/:id/match-candidates', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  test('lista candidatos ordenados por position', async ({ client }) => {
    const season = await SeasonFactory.create()
    const round = await RoundFactory.merge({
      seasonId: season.id,
      status: 'awaiting_pick',
    }).create()
    await RoundMatchCandidateFactory.merge({
      roundId: round.id,
      position: 2,
      homeTeam: 'B',
    }).create()
    await RoundMatchCandidateFactory.merge({
      roundId: round.id,
      position: 1,
      homeTeam: 'A',
    }).create()

    const r = await client.get(`/api/v1/rounds/${round.id}/match-candidates`).headers(HEADERS)

    r.assertStatus(200)
    r.assertBodyContains([
      { position: 1, homeTeam: 'A' },
      { position: 2, homeTeam: 'B' },
    ])
  })

  test('retorna lista vazia quando round não tem candidatos', async ({ client, assert }) => {
    const season = await SeasonFactory.create()
    const round = await RoundFactory.merge({ seasonId: season.id }).create()

    const r = await client.get(`/api/v1/rounds/${round.id}/match-candidates`).headers(HEADERS)

    r.assertStatus(200)
    assert.deepEqual(r.body(), [])
  })
})
