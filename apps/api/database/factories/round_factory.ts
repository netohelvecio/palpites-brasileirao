import factory from '@adonisjs/lucid/factories'
import { RoundStatus } from '@palpites/shared'
import Round from '#models/round'
import { SeasonFactory } from '#factories/season_factory'

export const RoundFactory = factory
  .define(Round, async ({ faker }) => {
    return {
      number: faker.number.int({ min: 1, max: 38 }),
      status: RoundStatus.PENDING,
    }
  })
  .relation('season', () => SeasonFactory)
  .build()
