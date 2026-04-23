import { randomUUID } from 'node:crypto'
import { beforeCreate, beforeFetch, beforeFind, hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import type { ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'
import { SeasonSchema } from '#database/schema'
import Round from './round.js'
import Score from './score.js'

export default class Season extends SeasonSchema {
  public static selfAssignPrimaryKey = true

  @hasMany(() => Round)
  declare rounds: HasMany<typeof Round>

  @hasMany(() => Score)
  declare scores: HasMany<typeof Score>

  @beforeCreate()
  static assignUuid(season: Season) {
    if (!season.id) season.id = randomUUID()
  }

  @beforeFind()
  @beforeFetch()
  static softDeleteScope(query: ModelQueryBuilderContract<typeof Season>) {
    query.where('is_deleted', false)
  }
}
