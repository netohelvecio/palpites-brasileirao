import { test } from '@japa/runner'
import { mapMatchStatus } from '#services/match_status_mapper'

test.group('MatchStatusMapper', () => {
  test('scheduled-ish → scheduled', ({ assert }) => {
    assert.equal(mapMatchStatus('SCHEDULED'), 'scheduled')
    assert.equal(mapMatchStatus('TIMED'), 'scheduled')
    assert.equal(mapMatchStatus('POSTPONED'), 'scheduled')
  })

  test('live-ish → live', ({ assert }) => {
    assert.equal(mapMatchStatus('IN_PLAY'), 'live')
    assert.equal(mapMatchStatus('PAUSED'), 'live')
    assert.equal(mapMatchStatus('SUSPENDED'), 'live')
  })

  test('finished-ish → finished', ({ assert }) => {
    assert.equal(mapMatchStatus('FINISHED'), 'finished')
    assert.equal(mapMatchStatus('AWARDED'), 'finished')
  })

  test('CANCELLED cai em scheduled (tratado em iteração futura)', ({ assert }) => {
    assert.equal(mapMatchStatus('CANCELLED'), 'scheduled')
  })
})
