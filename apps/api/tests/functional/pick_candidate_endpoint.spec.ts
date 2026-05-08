import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import { DateTime } from 'luxon'
import { RoundFactory } from '#factories/round_factory'
import { SeasonFactory } from '#factories/season_factory'
import { RoundMatchCandidateFactory } from '#factories/round_match_candidate_factory'

const HEADERS = { authorization: 'Bearer test-admin-token' }

test.group('POST /rounds/:id/pick-candidate', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  test('happy path: cria match, round → pending, candidatos soft-deleted', async ({
    client,
    assert,
  }) => {
    const season = await SeasonFactory.merge({ isActive: true }).create()
    const round = await RoundFactory.merge({
      seasonId: season.id,
      status: 'awaiting_pick',
    }).create()
    const c1 = await RoundMatchCandidateFactory.merge({
      roundId: round.id,
      position: 1,
      externalId: 1001,
      homeTeam: 'Flamengo',
      awayTeam: 'Palmeiras',
      kickoffAt: DateTime.fromISO('2026-05-04T20:00:00Z'),
    }).create()
    await RoundMatchCandidateFactory.merge({
      roundId: round.id,
      position: 2,
      externalId: 1002,
    }).create()

    const r = await client
      .post(`/api/v1/rounds/${round.id}/pick-candidate`)
      .headers(HEADERS)
      .json({ candidateId: c1.id })

    r.assertStatus(200)
    r.assertBodyContains({ homeTeam: 'Flamengo', awayTeam: 'Palmeiras' })

    await round.refresh()
    assert.equal(round.status, 'pending')
  })

  test('409 quando round não está awaiting_pick', async ({ client }) => {
    const season = await SeasonFactory.merge({ isActive: true }).create()
    const round = await RoundFactory.merge({
      seasonId: season.id,
      status: 'pending',
    }).create()
    const c = await RoundMatchCandidateFactory.merge({ roundId: round.id }).create()

    const r = await client
      .post(`/api/v1/rounds/${round.id}/pick-candidate`)
      .headers(HEADERS)
      .json({ candidateId: c.id })

    r.assertStatus(409)
  })

  test('404 quando candidato é de outra round', async ({ client }) => {
    const season = await SeasonFactory.merge({ isActive: true }).create()
    const round = await RoundFactory.merge({
      seasonId: season.id,
      status: 'awaiting_pick',
    }).create()
    const otherRound = await RoundFactory.merge({
      seasonId: season.id,
      number: round.number + 1,
      status: 'awaiting_pick',
    }).create()
    const c = await RoundMatchCandidateFactory.merge({ roundId: otherRound.id }).create()

    const r = await client
      .post(`/api/v1/rounds/${round.id}/pick-candidate`)
      .headers(HEADERS)
      .json({ candidateId: c.id })

    r.assertStatus(404)
  })

  test('401 sem auth', async ({ client }) => {
    const r = await client.post(
      `/api/v1/rounds/00000000-0000-0000-0000-000000000000/pick-candidate`
    )
    r.assertStatus(401)
  })
})
