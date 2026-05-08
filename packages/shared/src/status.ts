export const RoundStatus = {
  PENDING: 'pending',
  AWAITING_PICK: 'awaiting_pick',
  OPEN: 'open',
  CLOSED: 'closed',
  FINISHED: 'finished',
} as const

export type RoundStatus = (typeof RoundStatus)[keyof typeof RoundStatus]

export const MatchStatus = {
  SCHEDULED: 'scheduled',
  LIVE: 'live',
  FINISHED: 'finished',
} as const

export type MatchStatus = (typeof MatchStatus)[keyof typeof MatchStatus]
