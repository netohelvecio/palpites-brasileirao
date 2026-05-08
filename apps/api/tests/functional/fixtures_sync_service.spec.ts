import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import app from '@adonisjs/core/services/app'
import { RoundStatus } from '@palpites/shared'
import FootballDataClient from '#integrations/football_data/client'
import FixturesSyncService from '#services/fixtures_sync_service'
import RoundRepository from '#repositories/round_repository'
import RoundCandidateRepository from '#repositories/round_candidate_repository'
import { SeasonFactory } from '#factories/season_factory'
import { FakeFootballDataClient, fakeStandings, fakeMatch } from '#tests/helpers/football_data_mock'

test.group('FixturesSyncService — tie branch', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  test('quando picker retorna tie → cria round AWAITING_PICK + candidatos', async ({ assert }) => {
    const season = await SeasonFactory.merge({
      year: 2026,
      externalCompetitionCode: 'BSA',
      isActive: true,
    }).create()

    const fake = new FakeFootballDataClient()
    // Standings: 10:30, 11:25, 20:20, 21:20 → 1×2 = 10×11
    fake.standings = fakeStandings(7, 2026, { 10: 30, 11: 25, 20: 20, 21: 20 })
    fake.matchesByMatchday.set('2026:7', [
      // 10 vs 20: 30+20 = 50 (max, NÃO é 1×2)
      fakeMatch(100, 10, 20, 7, { utcDate: '2026-05-04T20:00:00Z' }),
      // 10 vs 21: 30+20 = 50 (empata no max)
      fakeMatch(101, 10, 21, 7, { utcDate: '2026-05-05T18:00:00Z' }),
      // 11 vs 21: 25+20 = 45
      fakeMatch(102, 11, 21, 7, { utcDate: '2026-05-04T16:00:00Z' }),
    ])

    app.container.swap(FootballDataClient, () => fake as any)

    try {
      const service = await app.container.make(FixturesSyncService)
      const report = await service.syncCurrentMatchday(season.id)

      assert.equal(report.created, false)
      assert.equal(report.skipped, false)
      assert.equal(report.reason, 'awaiting admin pick')

      const roundRepo = await app.container.make(RoundRepository)
      const round = await roundRepo.findBySeasonAndNumber(season.id, 7)
      assert.exists(round)
      assert.equal(round!.status, 'awaiting_pick')

      const candidateRepo = await app.container.make(RoundCandidateRepository)
      const candidates = await candidateRepo.list(round!.id)
      assert.equal(candidates.length, 2)
      assert.equal(candidates[0].position, 1)
      assert.equal(candidates[1].position, 2)
    } finally {
      app.container.restore(FootballDataClient)
    }
  })

  test('quando round já está awaiting_pick → retorna early skipped sem refetch matches', async ({
    assert,
  }) => {
    const season = await SeasonFactory.merge({
      year: 2026,
      externalCompetitionCode: 'BSA',
      isActive: true,
    }).create()

    const fake = new FakeFootballDataClient()
    fake.standings = fakeStandings(8, 2026, {})
    let matchesCalls = 0
    const wrapped = {
      async fetchStandings() {
        return fake.fetchStandings('BSA')
      },
      async fetchMatchesByMatchday() {
        matchesCalls++
        return []
      },
    }
    app.container.swap(FootballDataClient, () => wrapped as any)

    try {
      const roundRepo = await app.container.make(RoundRepository)
      await roundRepo.create({
        seasonId: season.id,
        number: 8,
        status: RoundStatus.AWAITING_PICK,
      })

      const service = await app.container.make(FixturesSyncService)
      const report = await service.syncCurrentMatchday(season.id)

      assert.equal(report.skipped, true)
      assert.equal(report.reason, 'awaiting admin pick')
      // fetchMatchesByMatchday não é chamado quando já está awaiting_pick
      assert.equal(matchesCalls, 0)
    } finally {
      app.container.restore(FootballDataClient)
    }
  })
})
