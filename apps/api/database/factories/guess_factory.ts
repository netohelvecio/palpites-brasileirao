import factory from '@adonisjs/lucid/factories'
import Guess from '#models/guess'
import { UserFactory } from '#factories/user_factory'
import { MatchFactory } from '#factories/match_factory'

export const GuessFactory = factory
  .define(Guess, async ({ faker }) => {
    return {
      homeScore: faker.number.int({ min: 0, max: 5 }),
      awayScore: faker.number.int({ min: 0, max: 5 }),
      points: null,
    }
  })
  .relation('user', () => UserFactory)
  .relation('match', () => MatchFactory)
  .build()
