import factory from '@adonisjs/lucid/factories'
import { DateTime } from 'luxon'
import RoundMatchCandidate from '#models/round_match_candidate'
import { RoundFactory } from '#factories/round_factory'

export const RoundMatchCandidateFactory = factory
  .define(RoundMatchCandidate, async ({ faker }) => {
    return {
      externalId: faker.number.int({ min: 100000, max: 999999 }),
      homeTeam: faker.company.name(),
      awayTeam: faker.company.name(),
      kickoffAt: DateTime.now().plus({ days: 1 }),
      pointsSum: faker.number.int({ min: 0, max: 80 }),
      position: 1,
      pollMessageId: null,
    }
  })
  .relation('round', () => RoundFactory)
  .build()
