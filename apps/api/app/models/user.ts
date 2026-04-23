import { randomUUID } from 'node:crypto'
import { beforeCreate, beforeFetch, beforeFind, hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import type { ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'
import { UserSchema } from '#database/schema'
import Guess from './guess.js'
import Score from './score.js'

export default class User extends UserSchema {
  public static selfAssignPrimaryKey = true

  @hasMany(() => Guess)
  declare guesses: HasMany<typeof Guess>

  @hasMany(() => Score)
  declare scores: HasMany<typeof Score>

  @beforeCreate()
  static assignUuid(user: User) {
    if (!user.id) user.id = randomUUID()
  }

  @beforeFind()
  @beforeFetch()
  static softDeleteScope(query: ModelQueryBuilderContract<typeof User>) {
    query.where('is_deleted', false)
  }
}
