import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'rounds'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.uuid('season_id').notNullable().references('id').inTable('seasons').onDelete('CASCADE')
      table.integer('number').notNullable()
      table
        .enum('status', ['pending', 'open', 'closed', 'finished'], {
          useNative: true,
          enumName: 'round_status',
          existingType: false,
        })
        .notNullable()
        .defaultTo('pending')
      table.boolean('is_deleted').notNullable().defaultTo(false)
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.unique(['season_id', 'number'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
    this.schema.raw('DROP TYPE IF EXISTS round_status')
  }
}
