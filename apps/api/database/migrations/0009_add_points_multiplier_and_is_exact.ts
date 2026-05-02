import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('matches', (table) => {
      table.smallint('points_multiplier').notNullable().defaultTo(1)
    })
    this.schema.alterTable('guesses', (table) => {
      table.boolean('is_exact').nullable()
    })
    this.defer(async (db) => {
      await db.rawQuery('UPDATE guesses SET is_exact = (points = 3) WHERE points IS NOT NULL')
    })
  }

  async down() {
    this.schema.alterTable('guesses', (table) => {
      table.dropColumn('is_exact')
    })
    this.schema.alterTable('matches', (table) => {
      table.dropColumn('points_multiplier')
    })
  }
}
