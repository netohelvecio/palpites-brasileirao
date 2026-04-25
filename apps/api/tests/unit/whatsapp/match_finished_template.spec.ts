import { test } from '@japa/runner'
import { matchFinishedMessage } from '#integrations/whatsapp/templates/match_finished'

test.group('templates/match_finished', () => {
  test('formata final + pontuação rodada + ranking temporada', ({ assert }) => {
    const text = matchFinishedMessage({
      roundNumber: 7,
      homeTeam: 'Palmeiras',
      awayTeam: 'Flamengo',
      finalHome: 2,
      finalAway: 1,
      roundScores: [
        { userId: 'u1', name: 'Helvécio', emoji: '⚽', points: 3 },
        { userId: 'u2', name: 'Ana', emoji: '🦊', points: 1 },
        { userId: 'u3', name: 'Bruno', emoji: '🐺', points: 0 },
      ],
      seasonRanking: [
        { userId: 'u1', name: 'Helvécio', emoji: '⚽', totalPoints: 21, exactScoresCount: 4 },
        { userId: 'u2', name: 'Ana', emoji: '🦊', totalPoints: 18, exactScoresCount: 3 },
        { userId: 'u3', name: 'Bruno', emoji: '🐺', totalPoints: 12, exactScoresCount: 1 },
      ],
    })

    assert.equal(
      text,
      '🏁 Final: Palmeiras 2 x 1 Flamengo\n' +
        '\n' +
        'Pontuação da rodada 7:\n' +
        'Helvécio ⚽ — 3 pts\n' +
        'Ana 🦊 — 1 pt\n' +
        'Bruno 🐺 — 0 pts\n' +
        '\n' +
        '🏆 Ranking da temporada:\n' +
        '1. Helvécio ⚽ — 21 pts (4 placares exatos)\n' +
        '2. Ana 🦊 — 18 pts (3 placares exatos)\n' +
        '3. Bruno 🐺 — 12 pts (1 placar exato)'
    )
  })

  test('singular vs plural para pts e placares exatos', ({ assert }) => {
    const text = matchFinishedMessage({
      roundNumber: 1,
      homeTeam: 'A',
      awayTeam: 'B',
      finalHome: 0,
      finalAway: 0,
      roundScores: [{ userId: 'u1', name: 'X', emoji: '🎯', points: 1 }],
      seasonRanking: [
        { userId: 'u1', name: 'X', emoji: '🎯', totalPoints: 1, exactScoresCount: 0 },
      ],
    })

    assert.match(text, /X 🎯 — 1 pt$/m)
    assert.match(text, /1\. X 🎯 — 1 pt \(0 placares exatos\)/)
  })
})
