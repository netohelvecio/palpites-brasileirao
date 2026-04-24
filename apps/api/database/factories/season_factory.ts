import { DateTime } from 'luxon'
import factory from '@adonisjs/lucid/factories'
import Season from '#models/season'

export const SeasonFactory = factory
  .define(Season, async ({ faker }) => {
    const year = faker.number.int({ min: 2020, max: 2030 })
    return {
      year,
      name: `Brasileirão ${year}`,
      externalCompetitionCode: 'BSA',
      isActive: true,
      startsAt: DateTime.fromObject({ year, month: 4, day: 12 }),
      endsAt: DateTime.fromObject({ year, month: 12, day: 8 }),
    }
  })
  .build()
