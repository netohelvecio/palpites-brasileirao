export interface FixtureCandidate {
  externalId: number
  homeTeamId: number
  homeTeamName: string
  awayTeamId: number
  awayTeamName: string
  kickoffAt: Date
}

export interface StandingEntry {
  teamId: number
  points: number
}

export type PickResult =
  | { ok: true; match: FixtureCandidate; pointsMultiplier: number }
  | { ok: false; reason: string }

export function pickFeaturedMatch(
  fixtures: FixtureCandidate[],
  standings: StandingEntry[]
): PickResult {
  if (fixtures.length === 0) {
    return { ok: false, reason: 'nenhum jogo disponível para a rodada' }
  }

  const pointsByTeam = new Map(standings.map((s) => [s.teamId, s.points]))
  const pointsOf = (teamId: number) => pointsByTeam.get(teamId) ?? 0

  let best: { match: FixtureCandidate; sum: number } | null = null
  for (const fixture of fixtures) {
    const sum = pointsOf(fixture.homeTeamId) + pointsOf(fixture.awayTeamId)
    if (!best || sum > best.sum) {
      best = { match: fixture, sum }
    }
  }

  const top1 = standings[0]?.teamId
  const top2 = standings[1]?.teamId
  const isOneVsTwo =
    top1 !== undefined &&
    top2 !== undefined &&
    ((best!.match.homeTeamId === top1 && best!.match.awayTeamId === top2) ||
      (best!.match.homeTeamId === top2 && best!.match.awayTeamId === top1))

  return {
    ok: true,
    match: best!.match,
    pointsMultiplier: isOneVsTwo ? 2 : 1,
  }
}
