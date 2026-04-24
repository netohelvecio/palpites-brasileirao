import { test } from '@japa/runner'
import {
  toFixtureCandidate,
  flattenStandings,
  extractCurrentMatchday,
  extractSeasonYear,
} from '#integrations/football_data/mappers'

test.group('FootballDataMappers', () => {
  test('toFixtureCandidate mapeia payload pro picker', ({ assert }) => {
    const c = toFixtureCandidate({
      id: 554854,
      utcDate: '2026-05-04T20:00:00Z',
      status: 'SCHEDULED',
      matchday: 12,
      homeTeam: { id: 1765, name: 'Sociedade Esportiva Palmeiras', shortName: 'Palmeiras' },
      awayTeam: { id: 1783, name: 'Clube de Regatas do Flamengo', shortName: 'Flamengo' },
      score: { fullTime: { home: null, away: null }, winner: null },
    } as any)

    assert.equal(c.externalId, 554854)
    assert.equal(c.homeTeamId, 1765)
    assert.equal(c.awayTeamId, 1783)
    assert.equal(c.homeTeamName, 'Palmeiras')
    assert.equal(c.kickoffAt.toISOString(), '2026-05-04T20:00:00.000Z')
  })

  test('flattenStandings usa apenas a tabela TOTAL', ({ assert }) => {
    const flat = flattenStandings({
      competition: { id: 2013, name: 'Brasileirão', code: 'BSA' },
      season: {
        id: 1,
        startDate: '2026-04-12',
        endDate: '2026-12-08',
        currentMatchday: 12,
        winner: null,
      },
      standings: [
        {
          stage: 'REGULAR_SEASON',
          type: 'TOTAL',
          group: null,
          table: [
            { position: 1, team: { id: 1, name: 'A' }, points: 30, playedGames: 11 },
            { position: 2, team: { id: 2, name: 'B' }, points: 25, playedGames: 11 },
          ],
        },
        {
          stage: 'REGULAR_SEASON',
          type: 'HOME',
          group: null,
          table: [],
        },
      ],
    } as any)

    assert.deepEqual(flat, [
      { teamId: 1, points: 30 },
      { teamId: 2, points: 25 },
    ])
  })

  test('extractCurrentMatchday lê do season', ({ assert }) => {
    assert.equal(extractCurrentMatchday({ season: { currentMatchday: 12 } } as any), 12)
  })

  test('extractSeasonYear deriva do startDate', ({ assert }) => {
    assert.equal(extractSeasonYear({ season: { startDate: '2026-04-12' } } as any), 2026)
  })
})
