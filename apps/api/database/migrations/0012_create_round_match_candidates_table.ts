import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'round_match_candidates'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.uuid('round_id').notNullable().references('id').inTable('rounds').onDelete('CASCADE')
      table.integer('external_id').notNullable()
      table.text('home_team').notNullable()
      table.text('away_team').notNullable()
      table.timestamp('kickoff_at', { useTz: true }).notNullable()
      table.integer('points_sum').notNullable()
      table.integer('position').notNullable()
      table.text('poll_message_id').nullable()
      table.boolean('is_deleted').notNullable().defaultTo(false)
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.unique(['round_id', 'external_id'])
      table.index(['round_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
