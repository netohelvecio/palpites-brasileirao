import { test } from '@japa/runner'
import { resolveIncomingIdentity } from '#integrations/whatsapp/incoming_identity'

test.group('resolveIncomingIdentity', () => {
  test('DM comum devolve telefone e jid', ({ assert }) => {
    const result = resolveIncomingIdentity({ remoteJid: '5511999990001@s.whatsapp.net' })

    assert.deepEqual(result, {
      fromNumber: '5511999990001',
      fromJid: '5511999990001@s.whatsapp.net',
    })
  })

  test('DM @lid com senderPn resolve o telefone', ({ assert }) => {
    const result = resolveIncomingIdentity({
      remoteJid: '1348703617067@lid',
      senderPn: '557196916296@s.whatsapp.net',
    })

    assert.deepEqual(result, {
      fromNumber: '557196916296',
      fromJid: '1348703617067@lid',
    })
  })

  test('DM @lid sem senderPn devolve fromNumber nulo', ({ assert }) => {
    const result = resolveIncomingIdentity({ remoteJid: '1348703617067@lid' })

    assert.deepEqual(result, {
      fromNumber: null,
      fromJid: '1348703617067@lid',
    })
  })

  test('senderPn não-string é tratado como ausente', ({ assert }) => {
    const result = resolveIncomingIdentity({
      remoteJid: '1348703617067@lid',
      senderPn: null,
    })

    assert.isNull(result.fromNumber)
  })
})
