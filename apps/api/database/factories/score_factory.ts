import factory from '@adonisjs/lucid/factories'
import Score from '#models/score'
import { UserFactory } from '#factories/user_factory'
import { SeasonFactory } from '#factories/season_factory'

export const ScoreFactory = factory
  .define(Score, async ({ faker }) => {
    return {
      totalPoints: faker.number.int({ min: 0, max: 100 }),
      exactScoresCount: faker.number.int({ min: 0, max: 10 }),
    }
  })
  .relation('user', () => UserFactory)
  .relation('season', () => SeasonFactory)
  .build()
