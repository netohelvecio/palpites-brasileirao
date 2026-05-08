import { randomUUID } from 'node:crypto'
import { beforeCreate, beforeFetch, beforeFind, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import type { ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'
import { RoundMatchCandidateSchema } from '#database/schema'
import Round from './round.js'

export default class RoundMatchCandidate extends RoundMatchCandidateSchema {
  public static table = 'round_match_candidates'
  public static selfAssignPrimaryKey = true

  @belongsTo(() => Round)
  declare round: BelongsTo<typeof Round>

  @beforeCreate()
  static assignUuid(row: RoundMatchCandidate) {
    if (!row.id) row.id = randomUUID()
  }

  @beforeFind()
  @beforeFetch()
  static softDeleteScope(query: ModelQueryBuilderContract<typeof RoundMatchCandidate>) {
    query.where('is_deleted', false)
  }
}
