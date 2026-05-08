export interface TiePollCandidate {
  homeTeam: string
  awayTeam: string
  position: number
}

export interface TiePollInput {
  roundNumber: number
  candidates: TiePollCandidate[]
}

export interface TiePollOutput {
  question: string
  options: string[]
}

export function tiePollMessage(input: TiePollInput): TiePollOutput {
  const sorted = [...input.candidates].sort((a, b) => a.position - b.position)
  return {
    question: `🗳️ Empate na escolha do jogo da Rodada ${input.roundNumber} — vote no jogo da rodada!`,
    options: sorted.map((c) => `${c.homeTeam} x ${c.awayTeam}`),
  }
}
