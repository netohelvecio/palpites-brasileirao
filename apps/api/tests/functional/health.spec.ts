import { test } from '@japa/runner'

test.group('Health', () => {
  test('GET /health retorna 200 com db up', async ({ client, assert }) => {
    const res = await client.get('/health')
    res.assertStatus(200)
    assert.equal(res.body().status, 'ok')
    assert.equal(res.body().db, 'up')
  })

  test('GET /health não exige bearer token', async ({ client }) => {
    const res = await client.get('/health')
    res.assertStatus(200)
  })
})
