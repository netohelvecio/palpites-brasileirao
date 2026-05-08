import { test } from '@japa/runner'
import { TiePollMode } from '@palpites/shared'
import WhatsAppNotifier from '#services/whatsapp_notifier'
import { FakeWhatsAppClient } from '#tests/helpers/whatsapp_mock'

const PAYLOAD = {
  roundNumber: 12,
  candidates: [
    { homeTeam: 'A', awayTeam: 'B', position: 1 },
    { homeTeam: 'C', awayTeam: 'D', position: 2 },
  ],
}

test.group('WhatsAppNotifier.notifyTieCandidatesPoll', () => {
  test('poll OK → mode=poll, messageId retornado', async ({ assert }) => {
    const fake = new FakeWhatsAppClient()
    fake.pollMessageId = 'msg-1'
    const notifier = new WhatsAppNotifier(fake)

    const r = await notifier.notifyTieCandidatesPoll(PAYLOAD)

    assert.equal(r.mode, TiePollMode.POLL)
    assert.equal(r.messageId, 'msg-1')
    assert.lengthOf(fake.sentPolls, 1)
    assert.lengthOf(fake.sentMessages, 0)
  })

  test('poll throws → fallback emoji, mode=emoji, messageId=null', async ({ assert }) => {
    const fake = new FakeWhatsAppClient()
    fake.throwOnSendPoll = new Error('poll not supported')
    const notifier = new WhatsAppNotifier(fake)

    const r = await notifier.notifyTieCandidatesPoll(PAYLOAD)

    assert.equal(r.mode, TiePollMode.EMOJI)
    assert.isNull(r.messageId)
    assert.lengthOf(fake.sentMessages, 1)
    assert.match(fake.sentMessages[0], /1️⃣ A x B/)
    assert.match(fake.sentMessages[0], /2️⃣ C x D/)
  })
})
