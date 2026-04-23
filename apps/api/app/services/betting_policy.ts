import { DateTime } from 'luxon'
import { RoundStatus } from '@palpites/shared'

export type BettingCheck = { allowed: true } | { allowed: false; reason: string }

interface RoundLike {
  status: RoundStatus
}

interface MatchLike {
  kickoffAt: DateTime
}

export function canAcceptGuess(
  round: RoundLike,
  match: MatchLike,
  now: DateTime = DateTime.now()
): BettingCheck {
  if (round.status !== RoundStatus.OPEN) {
    return {
      allowed: false,
      reason: `palpites disponíveis apenas quando a rodada está aberta (atual: ${round.status})`,
    }
  }
  if (match.kickoffAt <= now) {
    return { allowed: false, reason: 'palpites encerrados (o jogo já começou)' }
  }
  return { allowed: true }
}
