import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import WhatsAppClient from '#integrations/whatsapp/whatsapp_client'
import { FakeWhatsAppClient } from '#tests/helpers/whatsapp_mock'

test.group('GET /whatsapp/status', () => {
  test('retorna mode e connected do client', async ({ client, assert }) => {
    const fake = new FakeWhatsAppClient()
    fake.mode = 'stub'
    fake.setConnected(true)

    app.container.swap(WhatsAppClient, () => fake)
    try {
      const res = await client.get('/whatsapp/status')
      res.assertStatus(200)
      assert.deepEqual(res.body(), { mode: 'stub', connected: true })
    } finally {
      app.container.restore(WhatsAppClient)
    }
  })

  test('reflete connected=false quando offline', async ({ client, assert }) => {
    const fake = new FakeWhatsAppClient()
    fake.mode = 'real'
    fake.setConnected(false)

    app.container.swap(WhatsAppClient, () => fake)
    try {
      const res = await client.get('/whatsapp/status')
      res.assertStatus(200)
      assert.deepEqual(res.body(), { mode: 'real', connected: false })
    } finally {
      app.container.restore(WhatsAppClient)
    }
  })

  test('endpoint é público (sem Authorization)', async ({ client }) => {
    const res = await client.get('/whatsapp/status')
    res.assertStatus(200)
  })
})
