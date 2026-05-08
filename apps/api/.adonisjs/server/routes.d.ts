import '@adonisjs/core/types/http'

type ParamValue = string | number | bigint | boolean

export type ScannedRoutes = {
  ALL: {
    'health.index': { paramsTuple?: []; params?: {} }
    'health.whatsapp_status': { paramsTuple?: []; params?: {} }
    'users.store': { paramsTuple?: []; params?: {} }
    'users.index': { paramsTuple?: []; params?: {} }
    'users.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'seasons.store': { paramsTuple?: []; params?: {} }
    'seasons.index': { paramsTuple?: []; params?: {} }
    'seasons.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'seasons.sync': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'rounds.index_by_season': { paramsTuple: [ParamValue]; params: {'seasonId': ParamValue} }
    'rounds.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'rounds.update_status': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'rounds.list_match_candidates': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'rounds.pick_candidate': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'matches.show': { paramsTuple: [ParamValue]; params: {'roundId': ParamValue} }
    'matches.upsert': { paramsTuple: [ParamValue]; params: {'roundId': ParamValue} }
    'matches.refresh_score': { paramsTuple: [ParamValue]; params: {'roundId': ParamValue} }
    'guesses.store': { paramsTuple?: []; params?: {} }
    'guesses.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'guesses.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'guesses.index_by_round': { paramsTuple: [ParamValue]; params: {'roundId': ParamValue} }
    'ranking.by_season': { paramsTuple: [ParamValue]; params: {'seasonId': ParamValue} }
    'ranking.by_round': { paramsTuple: [ParamValue]; params: {'roundId': ParamValue} }
  }
  GET: {
    'health.index': { paramsTuple?: []; params?: {} }
    'health.whatsapp_status': { paramsTuple?: []; params?: {} }
    'users.index': { paramsTuple?: []; params?: {} }
    'seasons.index': { paramsTuple?: []; params?: {} }
    'rounds.index_by_season': { paramsTuple: [ParamValue]; params: {'seasonId': ParamValue} }
    'rounds.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'rounds.list_match_candidates': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'matches.show': { paramsTuple: [ParamValue]; params: {'roundId': ParamValue} }
    'guesses.index_by_round': { paramsTuple: [ParamValue]; params: {'roundId': ParamValue} }
    'ranking.by_season': { paramsTuple: [ParamValue]; params: {'seasonId': ParamValue} }
    'ranking.by_round': { paramsTuple: [ParamValue]; params: {'roundId': ParamValue} }
  }
  HEAD: {
    'health.index': { paramsTuple?: []; params?: {} }
    'health.whatsapp_status': { paramsTuple?: []; params?: {} }
    'users.index': { paramsTuple?: []; params?: {} }
    'seasons.index': { paramsTuple?: []; params?: {} }
    'rounds.index_by_season': { paramsTuple: [ParamValue]; params: {'seasonId': ParamValue} }
    'rounds.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'rounds.list_match_candidates': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'matches.show': { paramsTuple: [ParamValue]; params: {'roundId': ParamValue} }
    'guesses.index_by_round': { paramsTuple: [ParamValue]; params: {'roundId': ParamValue} }
    'ranking.by_season': { paramsTuple: [ParamValue]; params: {'seasonId': ParamValue} }
    'ranking.by_round': { paramsTuple: [ParamValue]; params: {'roundId': ParamValue} }
  }
  POST: {
    'users.store': { paramsTuple?: []; params?: {} }
    'seasons.store': { paramsTuple?: []; params?: {} }
    'seasons.sync': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'rounds.pick_candidate': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'matches.refresh_score': { paramsTuple: [ParamValue]; params: {'roundId': ParamValue} }
    'guesses.store': { paramsTuple?: []; params?: {} }
  }
  PATCH: {
    'users.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'seasons.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'rounds.update_status': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'guesses.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
  }
  PUT: {
    'matches.upsert': { paramsTuple: [ParamValue]; params: {'roundId': ParamValue} }
  }
  DELETE: {
    'guesses.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
  }
}
declare module '@adonisjs/core/types/http' {
  export interface RoutesList extends ScannedRoutes {}
}