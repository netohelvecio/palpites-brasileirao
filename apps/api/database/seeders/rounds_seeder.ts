import { DateTime } from 'luxon'
import { BaseSeeder } from '@adonisjs/lucid/seeders'
import Season from '#models/season'
import Round from '#models/round'

export default class RoundsSeeder extends BaseSeeder {
  static environment = ['development', 'testing']

  async run() {
    const year = new Date().getFullYear()

    let season = await Season.query().where('year', year).first()
    if (!season) {
      season = await Season.create({
        year,
        name: `Brasileirão ${year}`,
        externalLeagueId: 71,
        isActive: true,
        startsAt: DateTime.fromObject({ year, month: 4, day: 12 }),
        endsAt: DateTime.fromObject({ year, month: 12, day: 8 }),
      })
      console.log(`Created season ${season.name}`)
    } else {
      console.log(`Season ${season.name} already exists`)
    }

    const existingRounds = await Round.query().where('season_id', season.id)
    const existingNumbers = new Set(existingRounds.map((r) => r.number))

    const toCreate: Array<{ seasonId: string; number: number; status: 'pending' }> = []
    for (let n = 1; n <= 38; n++) {
      if (!existingNumbers.has(n)) {
        toCreate.push({ seasonId: season.id, number: n, status: 'pending' })
      }
    }

    if (toCreate.length === 0) {
      console.log(`All 38 rounds already exist for ${season.name}`)
      return
    }

    await Round.createMany(toCreate)
    console.log(`Seeded ${toCreate.length} new rounds for ${season.name}`)
  }
}
