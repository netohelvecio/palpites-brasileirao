import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('scores', (table) => {
      table.integer('baseline_points').notNullable().defaultTo(0)
      table.integer('baseline_exact_scores_count').notNullable().defaultTo(0)
    })
    this.defer(async (db) => {
      await db.rawQuery(`
        UPDATE scores SET baseline_points = GREATEST(0, total_points - (
          SELECT COALESCE(SUM(COALESCE(g.points, 0)), 0)
          FROM guesses g
          JOIN matches m ON m.id = g.match_id
          JOIN rounds r ON r.id = m.round_id
          WHERE g.user_id = scores.user_id
            AND r.season_id = scores.season_id
            AND m.status = 'finished'
            AND g.is_deleted = false
            AND m.is_deleted = false
            AND r.is_deleted = false
        ))
      `)
      await db.rawQuery(`
        UPDATE scores SET baseline_exact_scores_count = GREATEST(0, exact_scores_count - (
          SELECT COUNT(*)
          FROM guesses g
          JOIN matches m ON m.id = g.match_id
          JOIN rounds r ON r.id = m.round_id
          WHERE g.user_id = scores.user_id
            AND r.season_id = scores.season_id
            AND m.status = 'finished'
            AND g.is_exact = true
            AND g.is_deleted = false
            AND m.is_deleted = false
            AND r.is_deleted = false
        ))
      `)
    })
  }

  async down() {
    this.schema.alterTable('scores', (table) => {
      table.dropColumn('baseline_exact_scores_count')
      table.dropColumn('baseline_points')
    })
  }
}
