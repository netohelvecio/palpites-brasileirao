import { test } from '@japa/runner'
import { tieEmojiFallbackMessage } from '#integrations/whatsapp/templates/tie_emoji_fallback'

test.group('tieEmojiFallbackMessage', () => {
  test('lista candidatos com emojis 1️⃣ 2️⃣ 3️⃣', ({ assert }) => {
    const text = tieEmojiFallbackMessage({
      roundNumber: 7,
      candidates: [
        { homeTeam: 'A', awayTeam: 'B', position: 1 },
        { homeTeam: 'C', awayTeam: 'D', position: 2 },
        { homeTeam: 'E', awayTeam: 'F', position: 3 },
      ],
    })
    assert.match(text, /Rodada 7/)
    assert.match(text, /1️⃣ A x B/)
    assert.match(text, /2️⃣ C x D/)
    assert.match(text, /3️⃣ E x F/)
    assert.match(text, /admin homologa/i)
  })

  test('respeita ordem da position', ({ assert }) => {
    const text = tieEmojiFallbackMessage({
      roundNumber: 1,
      candidates: [
        { homeTeam: 'B', awayTeam: 'B2', position: 2 },
        { homeTeam: 'A', awayTeam: 'A2', position: 1 },
      ],
    })
    const idxA = text.indexOf('1️⃣ A x A2')
    const idxB = text.indexOf('2️⃣ B x B2')
    assert.isTrue(idxA > -1 && idxB > -1 && idxA < idxB)
  })
})
