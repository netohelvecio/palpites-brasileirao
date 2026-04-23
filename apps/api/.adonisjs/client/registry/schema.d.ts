/* eslint-disable prettier/prettier */
/// <reference path="../manifest.d.ts" />

import type { ExtractBody, ExtractErrorResponse, ExtractQuery, ExtractQueryForGet, ExtractResponse } from '@tuyau/core/types'
import type { InferInput, SimpleError } from '@vinejs/vine/types'

export type ParamValue = string | number | bigint | boolean

export interface Registry {
  'health.index': {
    methods: ["GET","HEAD"]
    pattern: '/health'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/health_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/health_controller').default['index']>>>
    }
  }
  'health.whatsapp_status': {
    methods: ["GET","HEAD"]
    pattern: '/whatsapp/status'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/health_controller').default['whatsappStatus']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/health_controller').default['whatsappStatus']>>>
    }
  }
  'users.store': {
    methods: ["POST"]
    pattern: '/api/v1/users'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/user_validator').createUserValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/user_validator').createUserValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/users_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/users_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'users.index': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/users'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/users_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/users_controller').default['index']>>>
    }
  }
  'users.update': {
    methods: ["PATCH"]
    pattern: '/api/v1/users/:id'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/user_validator').updateUserValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/user_validator').updateUserValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/users_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/users_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'seasons.store': {
    methods: ["POST"]
    pattern: '/api/v1/seasons'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/season_validator').createSeasonValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/season_validator').createSeasonValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/seasons_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/seasons_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'seasons.index': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/seasons'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/seasons_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/seasons_controller').default['index']>>>
    }
  }
  'seasons.update': {
    methods: ["PATCH"]
    pattern: '/api/v1/seasons/:id'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/season_validator').updateSeasonValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/season_validator').updateSeasonValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/seasons_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/seasons_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'seasons.sync': {
    methods: ["POST"]
    pattern: '/api/v1/seasons/:id/sync'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/seasons_controller').default['sync']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/seasons_controller').default['sync']>>>
    }
  }
  'rounds.index_by_season': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/seasons/:seasonId/rounds'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { seasonId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/rounds_controller').default['indexBySeason']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/rounds_controller').default['indexBySeason']>>>
    }
  }
  'rounds.show': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/rounds/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/rounds_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/rounds_controller').default['show']>>>
    }
  }
  'rounds.update_status': {
    methods: ["PATCH"]
    pattern: '/api/v1/rounds/:id/status'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/round_validator').updateRoundStatusValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/round_validator').updateRoundStatusValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/rounds_controller').default['updateStatus']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/rounds_controller').default['updateStatus']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'matches.show': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/rounds/:roundId/match'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { roundId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/matches_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/matches_controller').default['show']>>>
    }
  }
  'matches.upsert': {
    methods: ["PUT"]
    pattern: '/api/v1/rounds/:roundId/match'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/match_validator').upsertMatchValidator)>>
      paramsTuple: [ParamValue]
      params: { roundId: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/match_validator').upsertMatchValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/matches_controller').default['upsert']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/matches_controller').default['upsert']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'matches.refresh_score': {
    methods: ["POST"]
    pattern: '/api/v1/rounds/:roundId/match/refresh-score'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { roundId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/matches_controller').default['refreshScore']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/matches_controller').default['refreshScore']>>>
    }
  }
  'guesses.store': {
    methods: ["POST"]
    pattern: '/api/v1/guesses'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/guess_validator').createGuessValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/guess_validator').createGuessValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/guesses_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/guesses_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'guesses.update': {
    methods: ["PATCH"]
    pattern: '/api/v1/guesses/:id'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/guess_validator').updateGuessValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/guess_validator').updateGuessValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/guesses_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/guesses_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'guesses.destroy': {
    methods: ["DELETE"]
    pattern: '/api/v1/guesses/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/guesses_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/guesses_controller').default['destroy']>>>
    }
  }
  'guesses.index_by_round': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/rounds/:roundId/guesses'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { roundId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/guesses_controller').default['indexByRound']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/guesses_controller').default['indexByRound']>>>
    }
  }
  'ranking.by_season': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/seasons/:seasonId/ranking'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { seasonId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/ranking_controller').default['bySeason']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/ranking_controller').default['bySeason']>>>
    }
  }
  'ranking.by_round': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/rounds/:roundId/ranking'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { roundId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/ranking_controller').default['byRound']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/ranking_controller').default['byRound']>>>
    }
  }
}
