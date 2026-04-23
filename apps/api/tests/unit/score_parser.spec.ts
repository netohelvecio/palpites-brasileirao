import { test } from '@japa/runner'
import { parseScore } from '#services/score_parser'

test.group('ScoreParser', () => {
  test('parse empate "1x1" sem nome de time', ({ assert }) => {
    const r = parseScore('1x1', { homeTeam: 'Flamengo', awayTeam: 'Palmeiras' })
    assert.deepEqual(r, { ok: true, homeScore: 1, awayScore: 1 })
  })

  test('parse "2x1 Palmeiras" quando Palmeiras é away', ({ assert }) => {
    const r = parseScore('2x1 Palmeiras', { homeTeam: 'Flamengo', awayTeam: 'Palmeiras' })
    assert.deepEqual(r, { ok: true, homeScore: 1, awayScore: 2 })
  })

  test('parse "2x1 Flamengo" quando Flamengo é home', ({ assert }) => {
    const r = parseScore('2x1 Flamengo', { homeTeam: 'Flamengo', awayTeam: 'Palmeiras' })
    assert.deepEqual(r, { ok: true, homeScore: 2, awayScore: 1 })
  })

  test('parse "Flamengo 2x1" (time antes do placar)', ({ assert }) => {
    const r = parseScore('Flamengo 2x1', { homeTeam: 'Flamengo', awayTeam: 'Palmeiras' })
    assert.deepEqual(r, { ok: true, homeScore: 2, awayScore: 1 })
  })

  test('case insensitive', ({ assert }) => {
    const r = parseScore('2X0 FLAMENGO', { homeTeam: 'Flamengo', awayTeam: 'Palmeiras' })
    assert.deepEqual(r, { ok: true, homeScore: 2, awayScore: 0 })
  })

  test('ignora acentos', ({ assert }) => {
    const r = parseScore('2x1 sao paulo', { homeTeam: 'São Paulo', awayTeam: 'Corinthians' })
    assert.deepEqual(r, { ok: true, homeScore: 2, awayScore: 1 })
  })

  test('rejeita placar sem "x"', ({ assert }) => {
    const r = parseScore('2-1 Palmeiras', { homeTeam: 'Flamengo', awayTeam: 'Palmeiras' })
    assert.equal(r.ok, false)
  })

  test('rejeita time fora do confronto', ({ assert }) => {
    const r = parseScore('2x1 Santos', { homeTeam: 'Flamengo', awayTeam: 'Palmeiras' })
    assert.equal(r.ok, false)
  })

  test('rejeita string vazia', ({ assert }) => {
    const r = parseScore('', { homeTeam: 'Flamengo', awayTeam: 'Palmeiras' })
    assert.equal(r.ok, false)
  })

  test('rejeita não-empate sem nome de time', ({ assert }) => {
    const r = parseScore('2x1', { homeTeam: 'Flamengo', awayTeam: 'Palmeiras' })
    assert.equal(r.ok, false)
  })
})
