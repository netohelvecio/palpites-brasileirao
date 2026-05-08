import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  // ALTER TYPE ... ADD VALUE precisa rodar fora de transaction no Postgres.
  static disableTransactions = true

  async up() {
    this.schema.raw(`ALTER TYPE round_status ADD VALUE IF NOT EXISTS 'awaiting_pick'`)
  }

  async down() {
    // Postgres não suporta DROP VALUE em enum sem recriar o tipo.
    // Down é no-op intencional. Para reverter de verdade, criar migration nova
    // que recria o tipo; nesse projeto não há histórico que justifique.
  }
}
