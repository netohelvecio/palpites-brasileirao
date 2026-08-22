import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import UserRepository from '#repositories/user_repository'
import { UserFactory } from '#factories/user_factory'

test.group('UserRepository.findByWhatsappIdentity', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  test('acha pelo telefone', async ({ assert }) => {
    const repo = await app.container.make(UserRepository)
    const user = await UserFactory.merge({
      whatsappNumber: '5511999990001',
      whatsappLid: null,
    }).create()

    const found = await repo.findByWhatsappIdentity('5511999990001', '999@lid')

    assert.equal(found!.id, user.id)
  })

  test('acha pelo lid quando o telefone é nulo', async ({ assert }) => {
    const repo = await app.container.make(UserRepository)
    const user = await UserFactory.merge({
      whatsappNumber: null,
      whatsappLid: '1348703617067@lid',
    }).create()

    const found = await repo.findByWhatsappIdentity(null, '1348703617067@lid')

    assert.equal(found!.id, user.id)
  })

  test('phone nulo não casa linha de número nulo', async ({ assert }) => {
    const repo = await app.container.make(UserRepository)
    await UserFactory.merge({ whatsappNumber: null, whatsappLid: '111@lid' }).create()

    const found = await repo.findByWhatsappIdentity(null, '222@lid')

    assert.isNull(found)
  })

  test('não acha usuário soft-deletado', async ({ assert }) => {
    const repo = await app.container.make(UserRepository)
    const user = await UserFactory.merge({
      whatsappNumber: '5511999990002',
      whatsappLid: '333@lid',
    }).create()
    user.isDeleted = true
    await user.save()

    const found = await repo.findByWhatsappIdentity('5511999990002', '333@lid')

    assert.isNull(found)
  })

  test('com dois users vivos disputando o match, retorna o mais antigo deterministicamente', async ({
    assert,
  }) => {
    const repo = await app.container.make(UserRepository)
    const userB = await UserFactory.merge({
      whatsappNumber: null,
      whatsappLid: '4444444444444@lid',
    }).create()
    const userA = await UserFactory.merge({
      whatsappNumber: '5511999990003',
      whatsappLid: null,
    }).create()
    userA.createdAt = userB.createdAt.minus({ minutes: 5 })
    await userA.save()

    const found = await repo.findByWhatsappIdentity('5511999990003', '4444444444444@lid')

    assert.equal(found!.id, userA.id)
  })
})
