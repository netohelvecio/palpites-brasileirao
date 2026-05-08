import { PickKind } from '@palpites/shared'

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

export interface TieCandidate {
  match: FixtureCandidate
  pointsSum: number
  position: number
}

export type PickResult =
  | { ok: true; kind: typeof PickKind.UNIQUE; match: FixtureCandidate; pointsMultiplier: number }
  | { ok: true; kind: typeof PickKind.TIE; candidates: TieCandidate[] }
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

  const scored = fixtures.map((f) => ({
    match: f,
    pointsSum: pointsOf(f.homeTeamId) + pointsOf(f.awayTeamId),
  }))
  const max = Math.max(...scored.map((s) => s.pointsSum))
  const topGroup = scored.filter((s) => s.pointsSum === max)

  const top1 = standings[0]?.teamId
  const top2 = standings[1]?.teamId
  const isOneVsTwo = (m: FixtureCandidate) =>
    top1 !== undefined &&
    top2 !== undefined &&
    ((m.homeTeamId === top1 && m.awayTeamId === top2) ||
      (m.homeTeamId === top2 && m.awayTeamId === top1))

  // Tie-break 1×2: se algum empatado no top é 1×2, ele vence sem enquete.
  const oneVsTwo = topGroup.find((s) => isOneVsTwo(s.match))
  if (oneVsTwo) {
    return { ok: true, kind: PickKind.UNIQUE, match: oneVsTwo.match, pointsMultiplier: 2 }
  }

  if (topGroup.length === 1) {
    return { ok: true, kind: PickKind.UNIQUE, match: topGroup[0].match, pointsMultiplier: 1 }
  }

  const sorted = [...topGroup].sort(
    (a, b) => a.match.kickoffAt.getTime() - b.match.kickoffAt.getTime()
  )
  return {
    ok: true,
    kind: PickKind.TIE,
    candidates: sorted.map((s, idx) => ({
      match: s.match,
      pointsSum: s.pointsSum,
      position: idx + 1,
    })),
  }
}
