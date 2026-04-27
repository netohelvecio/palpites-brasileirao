import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import RoundRepository from '#repositories/round_repository'
import { SeasonFactory } from '#factories/season_factory'
import { RoundFactory } from '#factories/round_factory'
import { MatchFactory } from '#factories/match_factory'

test.group('RoundRepository.findOpenInActiveSeason', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  test('retorna round open em season ativa, com match preloaded', async ({ assert }) => {
    const season = await SeasonFactory.merge({ isActive: true }).create()
    const round = await RoundFactory.merge({
      seasonId: season.id,
      number: 7,
      status: 'open',
    }).create()
    await MatchFactory.merge({
      roundId: round.id,
      homeTeam: 'Palmeiras',
      awayTeam: 'Flamengo',
    }).create()

    const repo = await app.container.make(RoundRepository)
    const found = await repo.findOpenInActiveSeason()

    assert.isNotNull(found)
    assert.equal(found!.id, round.id)
    assert.equal(found!.match.homeTeam, 'Palmeiras')
  })

  test('retorna null quando season inativa, mesmo com round open', async ({ assert }) => {
    const season = await SeasonFactory.merge({ isActive: false }).create()
    const round = await RoundFactory.merge({ seasonId: season.id, status: 'open' }).create()
    await MatchFactory.merge({ roundId: round.id }).create()

    const repo = await app.container.make(RoundRepository)
    const found = await repo.findOpenInActiveSeason()

    assert.isNull(found)
  })

  test('retorna null quando round não está open', async ({ assert }) => {
    const season = await SeasonFactory.merge({ isActive: true }).create()
    await RoundFactory.merge({ seasonId: season.id, status: 'pending' }).create()

    const repo = await app.container.make(RoundRepository)
    const found = await repo.findOpenInActiveSeason()

    assert.isNull(found)
  })
})
