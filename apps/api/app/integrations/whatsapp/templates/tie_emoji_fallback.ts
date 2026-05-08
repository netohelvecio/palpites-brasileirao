export interface TieEmojiFallbackCandidate {
  homeTeam: string
  awayTeam: string
  position: number
}

export interface TieEmojiFallbackInput {
  roundNumber: number
  candidates: TieEmojiFallbackCandidate[]
}

const NUMBER_EMOJIS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟']

export function tieEmojiFallbackMessage(input: TieEmojiFallbackInput): string {
  const sorted = [...input.candidates].sort((a, b) => a.position - b.position)
  const lines = sorted.map((c, idx) => {
    const emoji = NUMBER_EMOJIS[idx] ?? `${idx + 1}.`
    return `${emoji} ${c.homeTeam} x ${c.awayTeam}`
  })
  return [
    `🗳️ *Empate na escolha do jogo da Rodada ${input.roundNumber}!*`,
    '',
    'Vote reagindo com o número correspondente:',
    '',
    ...lines,
    '',
    '(o admin homologa a escolha mais votada)',
  ].join('\n')
}
