import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'guesses'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
      table.uuid('match_id').notNullable().references('id').inTable('matches').onDelete('CASCADE')
      table.integer('home_score').notNullable()
      table.integer('away_score').notNullable()
      table.integer('points').nullable()
      table.boolean('is_deleted').notNullable().defaultTo(false)
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.unique(['user_id', 'match_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
