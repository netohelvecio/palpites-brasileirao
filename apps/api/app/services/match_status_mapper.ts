import type { FootballDataMatchStatus } from '#integrations/football_data/types'
import { MatchStatus } from '@palpites/shared'

export function mapMatchStatus(s: FootballDataMatchStatus): MatchStatus {
  switch (s) {
    case 'IN_PLAY':
    case 'PAUSED':
    case 'SUSPENDED':
      return MatchStatus.LIVE
    case 'FINISHED':
    case 'AWARDED':
      return MatchStatus.FINISHED
    case 'SCHEDULED':
    case 'TIMED':
    case 'POSTPONED':
    case 'CANCELLED':
    default:
      return MatchStatus.SCHEDULED
  }
}
