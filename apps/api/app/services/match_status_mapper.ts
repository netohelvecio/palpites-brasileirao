import type { FootballDataMatchStatus } from '#integrations/football_data/types'
import type { MatchStatus } from '@palpites/shared'

export function mapMatchStatus(s: FootballDataMatchStatus): MatchStatus {
  switch (s) {
    case 'IN_PLAY':
    case 'PAUSED':
    case 'SUSPENDED':
      return 'live'
    case 'FINISHED':
    case 'AWARDED':
      return 'finished'
    case 'SCHEDULED':
    case 'TIMED':
    case 'POSTPONED':
    case 'CANCELLED':
    default:
      return 'scheduled'
  }
}
