import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'seasons'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropUnique(['year', 'external_league_id'])
      table.dropColumn('external_league_id')
    })
    this.schema.alterTable(this.tableName, (table) => {
      table.text('external_competition_code').notNullable().defaultTo('BSA')
      table.unique(['year', 'external_competition_code'])
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropUnique(['year', 'external_competition_code'])
      table.dropColumn('external_competition_code')
    })
    this.schema.alterTable(this.tableName, (table) => {
      table.integer('external_league_id').notNullable().defaultTo(71)
      table.unique(['year', 'external_league_id'])
    })
  }
}
