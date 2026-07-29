import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'users'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('whatsapp_lid', 40).nullable()
    })

    this.schema.raw('ALTER TABLE users ALTER COLUMN whatsapp_number DROP NOT NULL')

    this.schema.raw(
      "UPDATE users SET whatsapp_lid = whatsapp_number, whatsapp_number = NULL WHERE whatsapp_number LIKE '%@lid'"
    )

    this.schema.raw('ALTER TABLE users DROP CONSTRAINT users_whatsapp_number_unique')

    this.schema.raw(
      'CREATE UNIQUE INDEX users_whatsapp_number_active_unique ON users (whatsapp_number) WHERE is_deleted = false'
    )

    this.schema.raw(
      'CREATE UNIQUE INDEX users_whatsapp_lid_active_unique ON users (whatsapp_lid) WHERE is_deleted = false'
    )
  }

  async down() {
    this.schema.raw('DROP INDEX IF EXISTS users_whatsapp_lid_active_unique')
    this.schema.raw('DROP INDEX IF EXISTS users_whatsapp_number_active_unique')

    this.schema.raw(
      'UPDATE users SET whatsapp_number = whatsapp_lid WHERE whatsapp_number IS NULL AND whatsapp_lid IS NOT NULL'
    )

    this.schema.raw(
      'ALTER TABLE users ADD CONSTRAINT users_whatsapp_number_unique UNIQUE (whatsapp_number)'
    )
    this.schema.raw('ALTER TABLE users ALTER COLUMN whatsapp_number SET NOT NULL')

    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('whatsapp_lid')
    })
  }
}
