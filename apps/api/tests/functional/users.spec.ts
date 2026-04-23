import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import { UserFactory } from '#factories/user_factory'

const HEADERS = { authorization: 'Bearer test-admin-token' }

test.group('Users', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  test('POST /users cria usuário', async ({ client, assert }) => {
    const res = await client
      .post('/api/v1/users')
      .headers(HEADERS)
      .json({ name: 'João', whatsappNumber: '5511999998888', emoji: '⚽', isAdmin: false })
    res.assertStatus(201)
    assert.exists(res.body().id)
    assert.equal(res.body().name, 'João')
  })

  test('POST /users exige bearer token', async ({ client }) => {
    const res = await client.post('/api/v1/users').json({})
    res.assertStatus(401)
  })

  test('POST /users rejeita token inválido', async ({ client }) => {
    const res = await client
      .post('/api/v1/users')
      .headers({ authorization: 'Bearer errado' })
      .json({ name: 'João', whatsappNumber: '5511999998888', emoji: '⚽' })
    res.assertStatus(401)
  })

  test('POST /users rejeita whatsappNumber duplicado', async ({ client }) => {
    const existing = await UserFactory.create()
    const res = await client
      .post('/api/v1/users')
      .headers(HEADERS)
      .json({ name: 'Outro', whatsappNumber: existing.whatsappNumber, emoji: '⚽' })
    res.assertStatus(422)
  })

  test('GET /users lista', async ({ client, assert }) => {
    await UserFactory.createMany(3)
    const res = await client.get('/api/v1/users').headers(HEADERS)
    res.assertStatus(200)
    assert.lengthOf(res.body(), 3)
  })

  test('PATCH /users/:id edita', async ({ client, assert }) => {
    const user = await UserFactory.create()
    const res = await client
      .patch(`/api/v1/users/${user.id}`)
      .headers(HEADERS)
      .json({ emoji: '🐍' })
    res.assertStatus(200)
    assert.equal(res.body().emoji, '🐍')
  })
})
