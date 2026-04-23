import { DateTime } from 'luxon'
import factory from '@adonisjs/lucid/factories'
import Match from '#models/match'
import { RoundFactory } from '#factories/round_factory'

export const MatchFactory = factory
  .define(Match, async ({ faker }) => {
    return {
      externalId: faker.number.int({ min: 1, max: 999999 }),
      homeTeam: faker.helpers.arrayElement(['Flamengo', 'Palmeiras', 'Corinthians', 'São Paulo']),
      awayTeam: faker.helpers.arrayElement(['Santos', 'Fluminense', 'Grêmio', 'Internacional']),
      kickoffAt: DateTime.now().plus({ days: 3 }),
      status: 'scheduled' as const,
    }
  })
  .relation('round', () => RoundFactory)
  .build()
