export type ParseResult =
  | { ok: true; homeScore: number; awayScore: number }
  | { ok: false; error: string }

export interface MatchTeams {
  homeTeam: string
  awayTeam: string
}

function normalize(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

export function parseScore(input: string, teams: MatchTeams): ParseResult {
  if (!input || typeof input !== 'string') {
    return { ok: false, error: 'mensagem vazia' }
  }

  const normalized = normalize(input)
  const scoreMatch = normalized.match(/(\d+)\s*x\s*(\d+)/)
  if (!scoreMatch) {
    return { ok: false, error: 'placar não encontrado (use formato "2x1")' }
  }

  const a = Number.parseInt(scoreMatch[1], 10)
  const b = Number.parseInt(scoreMatch[2], 10)

  const withoutScore = normalized.replace(scoreMatch[0], '').trim()
  const home = normalize(teams.homeTeam)
  const away = normalize(teams.awayTeam)

  if (a === b) {
    if (withoutScore === '' || withoutScore === home || withoutScore === away) {
      return { ok: true, homeScore: a, awayScore: b }
    }
    return { ok: false, error: 'time mencionado não corresponde a partida' }
  }

  if (withoutScore === '') {
    return { ok: false, error: 'informe o time vencedor (ex: "2x1 Flamengo")' }
  }

  const mentionsHome = home.length > 0 && withoutScore.includes(home)
  const mentionsAway = away.length > 0 && withoutScore.includes(away)

  if (mentionsHome && !mentionsAway) {
    return { ok: true, homeScore: a, awayScore: b }
  }
  if (mentionsAway && !mentionsHome) {
    return { ok: true, homeScore: b, awayScore: a }
  }

  return { ok: false, error: 'time mencionado não corresponde a partida' }
}
