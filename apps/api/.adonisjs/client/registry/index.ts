/* eslint-disable prettier/prettier */
import type { AdonisEndpoint } from '@tuyau/core/types'
import type { Registry } from './schema.d.ts'
import type { ApiDefinition } from './tree.d.ts'

const placeholder: any = {}

const routes = {
  'health.index': {
    methods: ["GET","HEAD"],
    pattern: '/health',
    tokens: [{"old":"/health","type":0,"val":"health","end":""}],
    types: placeholder as Registry['health.index']['types'],
  },
  'health.whatsapp_status': {
    methods: ["GET","HEAD"],
    pattern: '/whatsapp/status',
    tokens: [{"old":"/whatsapp/status","type":0,"val":"whatsapp","end":""},{"old":"/whatsapp/status","type":0,"val":"status","end":""}],
    types: placeholder as Registry['health.whatsapp_status']['types'],
  },
  'users.store': {
    methods: ["POST"],
    pattern: '/api/v1/users',
    tokens: [{"old":"/api/v1/users","type":0,"val":"api","end":""},{"old":"/api/v1/users","type":0,"val":"v1","end":""},{"old":"/api/v1/users","type":0,"val":"users","end":""}],
    types: placeholder as Registry['users.store']['types'],
  },
  'users.index': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/users',
    tokens: [{"old":"/api/v1/users","type":0,"val":"api","end":""},{"old":"/api/v1/users","type":0,"val":"v1","end":""},{"old":"/api/v1/users","type":0,"val":"users","end":""}],
    types: placeholder as Registry['users.index']['types'],
  },
  'users.update': {
    methods: ["PATCH"],
    pattern: '/api/v1/users/:id',
    tokens: [{"old":"/api/v1/users/:id","type":0,"val":"api","end":""},{"old":"/api/v1/users/:id","type":0,"val":"v1","end":""},{"old":"/api/v1/users/:id","type":0,"val":"users","end":""},{"old":"/api/v1/users/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['users.update']['types'],
  },
  'seasons.store': {
    methods: ["POST"],
    pattern: '/api/v1/seasons',
    tokens: [{"old":"/api/v1/seasons","type":0,"val":"api","end":""},{"old":"/api/v1/seasons","type":0,"val":"v1","end":""},{"old":"/api/v1/seasons","type":0,"val":"seasons","end":""}],
    types: placeholder as Registry['seasons.store']['types'],
  },
  'seasons.index': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/seasons',
    tokens: [{"old":"/api/v1/seasons","type":0,"val":"api","end":""},{"old":"/api/v1/seasons","type":0,"val":"v1","end":""},{"old":"/api/v1/seasons","type":0,"val":"seasons","end":""}],
    types: placeholder as Registry['seasons.index']['types'],
  },
  'seasons.update': {
    methods: ["PATCH"],
    pattern: '/api/v1/seasons/:id',
    tokens: [{"old":"/api/v1/seasons/:id","type":0,"val":"api","end":""},{"old":"/api/v1/seasons/:id","type":0,"val":"v1","end":""},{"old":"/api/v1/seasons/:id","type":0,"val":"seasons","end":""},{"old":"/api/v1/seasons/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['seasons.update']['types'],
  },
  'seasons.sync': {
    methods: ["POST"],
    pattern: '/api/v1/seasons/:id/sync',
    tokens: [{"old":"/api/v1/seasons/:id/sync","type":0,"val":"api","end":""},{"old":"/api/v1/seasons/:id/sync","type":0,"val":"v1","end":""},{"old":"/api/v1/seasons/:id/sync","type":0,"val":"seasons","end":""},{"old":"/api/v1/seasons/:id/sync","type":1,"val":"id","end":""},{"old":"/api/v1/seasons/:id/sync","type":0,"val":"sync","end":""}],
    types: placeholder as Registry['seasons.sync']['types'],
  },
  'rounds.index_by_season': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/seasons/:seasonId/rounds',
    tokens: [{"old":"/api/v1/seasons/:seasonId/rounds","type":0,"val":"api","end":""},{"old":"/api/v1/seasons/:seasonId/rounds","type":0,"val":"v1","end":""},{"old":"/api/v1/seasons/:seasonId/rounds","type":0,"val":"seasons","end":""},{"old":"/api/v1/seasons/:seasonId/rounds","type":1,"val":"seasonId","end":""},{"old":"/api/v1/seasons/:seasonId/rounds","type":0,"val":"rounds","end":""}],
    types: placeholder as Registry['rounds.index_by_season']['types'],
  },
  'rounds.show': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/rounds/:id',
    tokens: [{"old":"/api/v1/rounds/:id","type":0,"val":"api","end":""},{"old":"/api/v1/rounds/:id","type":0,"val":"v1","end":""},{"old":"/api/v1/rounds/:id","type":0,"val":"rounds","end":""},{"old":"/api/v1/rounds/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['rounds.show']['types'],
  },
  'rounds.update_status': {
    methods: ["PATCH"],
    pattern: '/api/v1/rounds/:id/status',
    tokens: [{"old":"/api/v1/rounds/:id/status","type":0,"val":"api","end":""},{"old":"/api/v1/rounds/:id/status","type":0,"val":"v1","end":""},{"old":"/api/v1/rounds/:id/status","type":0,"val":"rounds","end":""},{"old":"/api/v1/rounds/:id/status","type":1,"val":"id","end":""},{"old":"/api/v1/rounds/:id/status","type":0,"val":"status","end":""}],
    types: placeholder as Registry['rounds.update_status']['types'],
  },
  'matches.show': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/rounds/:roundId/match',
    tokens: [{"old":"/api/v1/rounds/:roundId/match","type":0,"val":"api","end":""},{"old":"/api/v1/rounds/:roundId/match","type":0,"val":"v1","end":""},{"old":"/api/v1/rounds/:roundId/match","type":0,"val":"rounds","end":""},{"old":"/api/v1/rounds/:roundId/match","type":1,"val":"roundId","end":""},{"old":"/api/v1/rounds/:roundId/match","type":0,"val":"match","end":""}],
    types: placeholder as Registry['matches.show']['types'],
  },
  'matches.upsert': {
    methods: ["PUT"],
    pattern: '/api/v1/rounds/:roundId/match',
    tokens: [{"old":"/api/v1/rounds/:roundId/match","type":0,"val":"api","end":""},{"old":"/api/v1/rounds/:roundId/match","type":0,"val":"v1","end":""},{"old":"/api/v1/rounds/:roundId/match","type":0,"val":"rounds","end":""},{"old":"/api/v1/rounds/:roundId/match","type":1,"val":"roundId","end":""},{"old":"/api/v1/rounds/:roundId/match","type":0,"val":"match","end":""}],
    types: placeholder as Registry['matches.upsert']['types'],
  },
  'matches.refresh_score': {
    methods: ["POST"],
    pattern: '/api/v1/rounds/:roundId/match/refresh-score',
    tokens: [{"old":"/api/v1/rounds/:roundId/match/refresh-score","type":0,"val":"api","end":""},{"old":"/api/v1/rounds/:roundId/match/refresh-score","type":0,"val":"v1","end":""},{"old":"/api/v1/rounds/:roundId/match/refresh-score","type":0,"val":"rounds","end":""},{"old":"/api/v1/rounds/:roundId/match/refresh-score","type":1,"val":"roundId","end":""},{"old":"/api/v1/rounds/:roundId/match/refresh-score","type":0,"val":"match","end":""},{"old":"/api/v1/rounds/:roundId/match/refresh-score","type":0,"val":"refresh-score","end":""}],
    types: placeholder as Registry['matches.refresh_score']['types'],
  },
  'guesses.store': {
    methods: ["POST"],
    pattern: '/api/v1/guesses',
    tokens: [{"old":"/api/v1/guesses","type":0,"val":"api","end":""},{"old":"/api/v1/guesses","type":0,"val":"v1","end":""},{"old":"/api/v1/guesses","type":0,"val":"guesses","end":""}],
    types: placeholder as Registry['guesses.store']['types'],
  },
  'guesses.update': {
    methods: ["PATCH"],
    pattern: '/api/v1/guesses/:id',
    tokens: [{"old":"/api/v1/guesses/:id","type":0,"val":"api","end":""},{"old":"/api/v1/guesses/:id","type":0,"val":"v1","end":""},{"old":"/api/v1/guesses/:id","type":0,"val":"guesses","end":""},{"old":"/api/v1/guesses/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['guesses.update']['types'],
  },
  'guesses.destroy': {
    methods: ["DELETE"],
    pattern: '/api/v1/guesses/:id',
    tokens: [{"old":"/api/v1/guesses/:id","type":0,"val":"api","end":""},{"old":"/api/v1/guesses/:id","type":0,"val":"v1","end":""},{"old":"/api/v1/guesses/:id","type":0,"val":"guesses","end":""},{"old":"/api/v1/guesses/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['guesses.destroy']['types'],
  },
  'guesses.index_by_round': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/rounds/:roundId/guesses',
    tokens: [{"old":"/api/v1/rounds/:roundId/guesses","type":0,"val":"api","end":""},{"old":"/api/v1/rounds/:roundId/guesses","type":0,"val":"v1","end":""},{"old":"/api/v1/rounds/:roundId/guesses","type":0,"val":"rounds","end":""},{"old":"/api/v1/rounds/:roundId/guesses","type":1,"val":"roundId","end":""},{"old":"/api/v1/rounds/:roundId/guesses","type":0,"val":"guesses","end":""}],
    types: placeholder as Registry['guesses.index_by_round']['types'],
  },
  'ranking.by_season': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/seasons/:seasonId/ranking',
    tokens: [{"old":"/api/v1/seasons/:seasonId/ranking","type":0,"val":"api","end":""},{"old":"/api/v1/seasons/:seasonId/ranking","type":0,"val":"v1","end":""},{"old":"/api/v1/seasons/:seasonId/ranking","type":0,"val":"seasons","end":""},{"old":"/api/v1/seasons/:seasonId/ranking","type":1,"val":"seasonId","end":""},{"old":"/api/v1/seasons/:seasonId/ranking","type":0,"val":"ranking","end":""}],
    types: placeholder as Registry['ranking.by_season']['types'],
  },
  'ranking.by_round': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/rounds/:roundId/ranking',
    tokens: [{"old":"/api/v1/rounds/:roundId/ranking","type":0,"val":"api","end":""},{"old":"/api/v1/rounds/:roundId/ranking","type":0,"val":"v1","end":""},{"old":"/api/v1/rounds/:roundId/ranking","type":0,"val":"rounds","end":""},{"old":"/api/v1/rounds/:roundId/ranking","type":1,"val":"roundId","end":""},{"old":"/api/v1/rounds/:roundId/ranking","type":0,"val":"ranking","end":""}],
    types: placeholder as Registry['ranking.by_round']['types'],
  },
} as const satisfies Record<string, AdonisEndpoint>

export { routes }

export const registry = {
  routes,
  $tree: {} as ApiDefinition,
}

declare module '@tuyau/core/types' {
  export interface UserRegistry {
    routes: typeof routes
    $tree: ApiDefinition
  }
}
