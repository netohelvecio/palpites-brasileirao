import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import { UserFactory } from '#factories/user_factory'

test.group('users — índices únicos parciais de identidade', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  test('dois usuários vivos não podem compartilhar whatsapp_number', async ({ assert }) => {
    await UserFactory.merge({ whatsappNumber: '5511999990001' }).create()

    await assert.rejects(() => UserFactory.merge({ whatsappNumber: '5511999990001' }).create())
  })

  test('usuário soft-deletado libera o whatsapp_number para um novo', async ({ assert }) => {
    const removed = await UserFactory.merge({ whatsappNumber: '5511999990002' }).create()
    removed.isDeleted = true
    await removed.save()

    const fresh = await UserFactory.merge({ whatsappNumber: '5511999990002' }).create()

    assert.notEqual(fresh.id, removed.id)
  })

  test('dois usuários vivos não podem compartilhar whatsapp_lid', async ({ assert }) => {
    await UserFactory.merge({ whatsappLid: '1111111111111@lid' }).create()

    await assert.rejects(() => UserFactory.merge({ whatsappLid: '1111111111111@lid' }).create())
  })

  test('whatsapp_number aceita NULL em múltiplas linhas', async ({ assert }) => {
    const a = await UserFactory.merge({
      whatsappNumber: null,
      whatsappLid: '2222222222222@lid',
    }).create()
    const b = await UserFactory.merge({
      whatsappNumber: null,
      whatsappLid: '3333333333333@lid',
    }).create()

    assert.notEqual(a.id, b.id)
  })
})
