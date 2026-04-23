import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'scores'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
      table.uuid('season_id').notNullable().references('id').inTable('seasons').onDelete('CASCADE')
      table.integer('total_points').notNullable().defaultTo(0)
      table.integer('exact_scores_count').notNullable().defaultTo(0)
      table.boolean('is_deleted').notNullable().defaultTo(false)
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.unique(['user_id', 'season_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
