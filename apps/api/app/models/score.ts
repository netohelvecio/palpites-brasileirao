import { randomUUID } from 'node:crypto'
import { beforeCreate, beforeFetch, beforeFind, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import type { ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'
import { ScoreSchema } from '#database/schema'
import User from './user.js'
import Season from './season.js'

export default class Score extends ScoreSchema {
  public static selfAssignPrimaryKey = true

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  @belongsTo(() => Season)
  declare season: BelongsTo<typeof Season>

  @beforeCreate()
  static assignUuid(score: Score) {
    if (!score.id) score.id = randomUUID()
  }

  @beforeFind()
  @beforeFetch()
  static softDeleteScope(query: ModelQueryBuilderContract<typeof Score>) {
    query.where('is_deleted', false)
  }
}
