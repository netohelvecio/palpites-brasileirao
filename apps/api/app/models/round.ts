import { randomUUID } from 'node:crypto'
import {
  beforeCreate,
  beforeFetch,
  beforeFind,
  belongsTo,
  column,
  hasOne,
} from '@adonisjs/lucid/orm'
import type { BelongsTo, HasOne } from '@adonisjs/lucid/types/relations'
import type { ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'
import type { RoundStatus } from '@palpites/shared'
import { RoundSchema } from '#database/schema'
import Season from './season.js'
import Match from './match.js'

export default class Round extends RoundSchema {
  public static selfAssignPrimaryKey = true

  @column()
  declare status: RoundStatus

  @belongsTo(() => Season)
  declare season: BelongsTo<typeof Season>

  @hasOne(() => Match)
  declare match: HasOne<typeof Match>

  @beforeCreate()
  static assignUuid(round: Round) {
    if (!round.id) round.id = randomUUID()
  }

  @beforeFind()
  @beforeFetch()
  static softDeleteScope(query: ModelQueryBuilderContract<typeof Round>) {
    query.where('is_deleted', false)
  }
}
