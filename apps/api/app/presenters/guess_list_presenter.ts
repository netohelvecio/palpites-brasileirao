import type { GuessListView } from '@palpites/shared'
import type Match from '#models/match'
import type Guess from '#models/guess'
import { presentMatch } from '#presenters/match_presenter'
import { presentUserSummary } from '#presenters/user_presenter'

export function presentGuessList(match: Match | null, guesses: Guess[]): GuessListView {
  if (!match) {
    return { match: null, guesses: [] }
  }

  return {
    match: presentMatch(match),
    guesses: guesses.map((g) => ({
      id: g.id,
      user: presentUserSummary(g.user),
      homeScore: g.homeScore,
      awayScore: g.awayScore,
      points: g.points,
    })),
  }
}
