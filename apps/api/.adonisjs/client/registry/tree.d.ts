/* eslint-disable prettier/prettier */
import type { routes } from './index.ts'

export interface ApiDefinition {
  health: {
    index: typeof routes['health.index']
    whatsappStatus: typeof routes['health.whatsapp_status']
  }
  users: {
    store: typeof routes['users.store']
    index: typeof routes['users.index']
    update: typeof routes['users.update']
  }
  seasons: {
    store: typeof routes['seasons.store']
    index: typeof routes['seasons.index']
    update: typeof routes['seasons.update']
    sync: typeof routes['seasons.sync']
  }
  rounds: {
    indexBySeason: typeof routes['rounds.index_by_season']
    show: typeof routes['rounds.show']
    updateStatus: typeof routes['rounds.update_status']
  }
  matches: {
    show: typeof routes['matches.show']
    upsert: typeof routes['matches.upsert']
    refreshScore: typeof routes['matches.refresh_score']
  }
  guesses: {
    store: typeof routes['guesses.store']
    update: typeof routes['guesses.update']
    destroy: typeof routes['guesses.destroy']
    indexByRound: typeof routes['guesses.index_by_round']
  }
  ranking: {
    bySeason: typeof routes['ranking.by_season']
    byRound: typeof routes['ranking.by_round']
  }
}
