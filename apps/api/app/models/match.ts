import { randomUUID } from 'node:crypto'
import {
  beforeCreate,
  beforeFetch,
  beforeFind,
  belongsTo,
  column,
  hasMany,
} from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import type { ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'
import type { MatchStatus } from '@palpites/shared'
import { MatchSchema } from '#database/schema'
import Round from './round.js'
import Guess from './guess.js'

export default class Match extends MatchSchema {
  public static table = 'matches'
  public static selfAssignPrimaryKey = true

  @column()
  declare status: MatchStatus

  @belongsTo(() => Round)
  declare round: BelongsTo<typeof Round>

  @hasMany(() => Guess)
  declare guesses: HasMany<typeof Guess>

  @beforeCreate()
  static assignUuid(match: Match) {
    if (!match.id) match.id = randomUUID()
  }

  @beforeFind()
  @beforeFetch()
  static softDeleteScope(query: ModelQueryBuilderContract<typeof Match>) {
    query.where('is_deleted', false)
  }
}
