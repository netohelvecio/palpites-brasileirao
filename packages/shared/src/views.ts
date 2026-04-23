import type { MatchStatus } from './status.js'

export interface UserSummary {
  id: string
  name: string
  emoji: string
}

export interface MatchView {
  id: string
  homeTeam: string
  awayTeam: string
  /** ISO 8601 string */
  kickoffAt: string
  homeScore: number | null
  awayScore: number | null
  status: MatchStatus
}

export interface GuessListItem {
  id: string
  user: UserSummary
  homeScore: number
  awayScore: number
  points: number | null
}

export interface GuessListView {
  match: MatchView | null
  guesses: GuessListItem[]
}
