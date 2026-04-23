import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'matches'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table
        .uuid('round_id')
        .notNullable()
        .unique()
        .references('id')
        .inTable('rounds')
        .onDelete('CASCADE')
      table.integer('external_id').notNullable()
      table.string('home_team', 80).notNullable()
      table.string('away_team', 80).notNullable()
      table.timestamp('kickoff_at', { useTz: true }).notNullable()
      table.integer('home_score').nullable()
      table.integer('away_score').nullable()
      table
        .enum('status', ['scheduled', 'live', 'finished'], {
          useNative: true,
          enumName: 'match_status',
          existingType: false,
        })
        .notNullable()
        .defaultTo('scheduled')
      table.boolean('is_deleted').notNullable().defaultTo(false)
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
    this.schema.raw('DROP TYPE IF EXISTS match_status')
  }
}
