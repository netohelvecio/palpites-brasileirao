import { randomUUID } from 'node:crypto'
import { beforeCreate, beforeFetch, beforeFind, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import type { ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'
import { GuessSchema } from '#database/schema'
import User from './user.js'
import Match from './match.js'

export default class Guess extends GuessSchema {
  public static selfAssignPrimaryKey = true

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  @belongsTo(() => Match)
  declare match: BelongsTo<typeof Match>

  @beforeCreate()
  static assignUuid(guess: Guess) {
    if (!guess.id) guess.id = randomUUID()
  }

  @beforeFind()
  @beforeFetch()
  static softDeleteScope(query: ModelQueryBuilderContract<typeof Guess>) {
    query.where('is_deleted', false)
  }
}
