import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import GuessRepository from '#repositories/guess_repository'
import Guess from '#models/guess'
import { SeasonFactory } from '#factories/season_factory'
import { RoundFactory } from '#factories/round_factory'
import { MatchFactory } from '#factories/match_factory'
import { UserFactory } from '#factories/user_factory'

test.group('GuessRepository.upsertByUserAndMatch', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  test('cria palpite quando não existe', async ({ assert }) => {
    const season = await SeasonFactory.create()
    const round = await RoundFactory.merge({ seasonId: season.id }).create()
    const match = await MatchFactory.merge({ roundId: round.id }).create()
    const user = await UserFactory.create()

    const repo = await app.container.make(GuessRepository)
    const guess = await repo.upsertByUserAndMatch(user.id, match.id, {
      homeScore: 2,
      awayScore: 1,
    })

    assert.equal(guess.homeScore, 2)
    assert.equal(guess.awayScore, 1)
    assert.isNull(guess.points)

    const all = await Guess.query().where('match_id', match.id)
    assert.lengthOf(all, 1)
  })

  test('atualiza palpite existente e reseta points', async ({ assert }) => {
    const season = await SeasonFactory.create()
    const round = await RoundFactory.merge({ seasonId: season.id }).create()
    const match = await MatchFactory.merge({ roundId: round.id }).create()
    const user = await UserFactory.create()

    const repo = await app.container.make(GuessRepository)
    await repo.upsertByUserAndMatch(user.id, match.id, { homeScore: 2, awayScore: 1 })

    // simula que o finalize já creditou points
    await Guess.query().where('user_id', user.id).update({ points: 3 })

    const updated = await repo.upsertByUserAndMatch(user.id, match.id, {
      homeScore: 1,
      awayScore: 1,
    })

    assert.equal(updated.homeScore, 1)
    assert.equal(updated.awayScore, 1)
    assert.isNull(updated.points)

    const all = await Guess.query().where('match_id', match.id)
    assert.lengthOf(all, 1)
  })
})
