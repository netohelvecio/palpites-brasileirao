import { DateTime } from 'luxon'
import { test } from '@japa/runner'
import { canAcceptGuess } from '#services/betting_policy'

const BASE = DateTime.fromISO('2026-05-01T12:00:00Z')

test.group('BettingPolicy.canAcceptGuess', () => {
  test('permite quando rodada open e kickoff no futuro', ({ assert }) => {
    const r = canAcceptGuess({ status: 'open' }, { kickoffAt: BASE.plus({ hours: 1 }) }, BASE)
    assert.deepEqual(r, { allowed: true })
  })

  test('nega quando rodada pending', ({ assert }) => {
    const r = canAcceptGuess({ status: 'pending' }, { kickoffAt: BASE.plus({ hours: 1 }) }, BASE)
    assert.equal(r.allowed, false)
    if (!r.allowed) assert.match(r.reason, /rodada está aberta/)
  })

  test('nega quando rodada closed', ({ assert }) => {
    const r = canAcceptGuess({ status: 'closed' }, { kickoffAt: BASE.plus({ hours: 1 }) }, BASE)
    assert.equal(r.allowed, false)
  })

  test('nega quando rodada finished', ({ assert }) => {
    const r = canAcceptGuess({ status: 'finished' }, { kickoffAt: BASE.plus({ hours: 1 }) }, BASE)
    assert.equal(r.allowed, false)
  })

  test('nega quando kickoff é exatamente agora (<=)', ({ assert }) => {
    const r = canAcceptGuess({ status: 'open' }, { kickoffAt: BASE }, BASE)
    assert.equal(r.allowed, false)
    if (!r.allowed) assert.match(r.reason, /jogo já começou/)
  })

  test('nega quando kickoff no passado', ({ assert }) => {
    const r = canAcceptGuess({ status: 'open' }, { kickoffAt: BASE.minus({ minutes: 1 }) }, BASE)
    assert.equal(r.allowed, false)
  })

  test('permite com 1 segundo de margem antes do kickoff', ({ assert }) => {
    const r = canAcceptGuess({ status: 'open' }, { kickoffAt: BASE.plus({ seconds: 1 }) }, BASE)
    assert.deepEqual(r, { allowed: true })
  })

  test('usa DateTime.now() por default quando now omitido', ({ assert }) => {
    const r = canAcceptGuess(
      { status: 'open' },
      { kickoffAt: DateTime.now().plus({ minutes: 10 }) }
    )
    assert.deepEqual(r, { allowed: true })
  })
})
