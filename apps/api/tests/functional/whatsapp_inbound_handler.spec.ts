import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import WhatsAppClient from '#integrations/whatsapp/whatsapp_client'
import WhatsAppInboundHandler from '#services/whatsapp_inbound_handler'
import User from '#models/user'
import { UserFactory } from '#factories/user_factory'
import { FakeWhatsAppClient } from '#tests/helpers/whatsapp_mock'

test.group('WhatsAppInboundHandler — cadastro', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  function setupFake() {
    const fake = new FakeWhatsAppClient()
    app.container.swap(WhatsAppClient, () => fake)
    return fake
  }

  function teardownFake() {
    app.container.restore(WhatsAppClient)
  }

  test('/cadastro <nome> <emoji> de número novo cria user e responde sucesso', async ({
    assert,
  }) => {
    const fake = setupFake()
    try {
      const handler = await app.container.make(WhatsAppInboundHandler)
      await handler.handle({
        fromNumber: '5511999990001',
        text: '/cadastro Helvécio ⚽',
        messageId: 'msg-1',
      })

      const user = await User.query().where('whatsapp_number', '5511999990001').first()
      assert.isNotNull(user)
      assert.equal(user!.name, 'Helvécio')
      assert.equal(user!.emoji, '⚽')
      assert.isFalse(user!.isAdmin)

      assert.lengthOf(fake.sentDms, 1)
      assert.equal(fake.sentDms[0].number, '5511999990001')
      assert.match(fake.sentDms[0].text, /✅ Cadastrado, Helvécio ⚽/)
    } finally {
      teardownFake()
    }
  })

  test('/cadastro com nome multi-word funciona (último token é emoji)', async ({ assert }) => {
    const fake = setupFake()
    try {
      const handler = await app.container.make(WhatsAppInboundHandler)
      await handler.handle({
        fromNumber: '5511999990002',
        text: '/cadastro João Silva 🐯',
        messageId: 'msg-2',
      })

      const user = await User.query().where('whatsapp_number', '5511999990002').first()
      assert.isNotNull(user)
      assert.equal(user!.name, 'João Silva')
      assert.equal(user!.emoji, '🐯')

      assert.match(fake.sentDms[0].text, /João Silva 🐯/)
    } finally {
      teardownFake()
    }
  })

  test('/cadastro sem args responde help, não cria user', async ({ assert }) => {
    const fake = setupFake()
    try {
      const handler = await app.container.make(WhatsAppInboundHandler)
      await handler.handle({
        fromNumber: '5511999990003',
        text: '/cadastro',
        messageId: 'msg-3',
      })

      const user = await User.query().where('whatsapp_number', '5511999990003').first()
      assert.isNull(user)

      assert.lengthOf(fake.sentDms, 1)
      assert.match(fake.sentDms[0].text, /\/cadastro <seu nome> <emoji>/)
    } finally {
      teardownFake()
    }
  })

  test('/cadastro com só um token responde help', async ({ assert }) => {
    const fake = setupFake()
    try {
      const handler = await app.container.make(WhatsAppInboundHandler)
      await handler.handle({
        fromNumber: '5511999990004',
        text: '/cadastro Helvecio',
        messageId: 'msg-4',
      })

      const user = await User.query().where('whatsapp_number', '5511999990004').first()
      assert.isNull(user)

      assert.match(fake.sentDms[0].text, /\/cadastro <seu nome> <emoji>/)
    } finally {
      teardownFake()
    }
  })

  test('/cadastro com nome > 80 chars responde erro', async ({ assert }) => {
    const fake = setupFake()
    try {
      const longName = 'a'.repeat(81)
      const handler = await app.container.make(WhatsAppInboundHandler)
      await handler.handle({
        fromNumber: '5511999990005',
        text: `/cadastro ${longName} ⚽`,
        messageId: 'msg-5',
      })

      const user = await User.query().where('whatsapp_number', '5511999990005').first()
      assert.isNull(user)

      assert.match(fake.sentDms[0].text, /Nome muito longo/)
    } finally {
      teardownFake()
    }
  })

  test('/cadastro de número já cadastrado responde "já cadastrado"', async ({ assert }) => {
    const existing = await UserFactory.merge({
      whatsappNumber: '5511999990006',
      name: 'Ana',
      emoji: '🦊',
    }).create()
    const fake = setupFake()
    try {
      const handler = await app.container.make(WhatsAppInboundHandler)
      await handler.handle({
        fromNumber: '5511999990006',
        text: '/cadastro Outro Nome 🐯',
        messageId: 'msg-6',
      })

      const fresh = await existing.refresh()
      assert.equal(fresh.name, 'Ana')
      assert.equal(fresh.emoji, '🦊')

      assert.match(fake.sentDms[0].text, /Você já está cadastrado como Ana 🦊/)
    } finally {
      teardownFake()
    }
  })

  test('case-insensitive: /CADASTRO Helvécio ⚽ também funciona', async ({ assert }) => {
    setupFake()
    try {
      const handler = await app.container.make(WhatsAppInboundHandler)
      await handler.handle({
        fromNumber: '5511999990007',
        text: '/CADASTRO Helvécio ⚽',
        messageId: 'msg-7',
      })

      const user = await User.query().where('whatsapp_number', '5511999990007').first()
      assert.isNotNull(user)
    } finally {
      teardownFake()
    }
  })
})

test.group('WhatsAppInboundHandler — roteamento', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  test('mensagem que não começa com /cadastro vai pro handleGuess', async ({ assert }) => {
    await UserFactory.merge({ whatsappNumber: '5511999990010' }).create()
    const fake = new FakeWhatsAppClient()
    app.container.swap(WhatsAppClient, () => fake)
    try {
      const handler = await app.container.make(WhatsAppInboundHandler)
      await handler.handle({
        fromNumber: '5511999990010',
        text: '2x1 Palmeiras',
        messageId: 'msg-r1',
      })

      assert.match(fake.sentDms[0].text, /Palpites ainda não estão habilitados/)
    } finally {
      app.container.restore(WhatsAppClient)
    }
  })

  test('número desconhecido sem /cadastro recebe NOT_REGISTERED', async ({ assert }) => {
    const fake = new FakeWhatsAppClient()
    app.container.swap(WhatsAppClient, () => fake)
    try {
      const handler = await app.container.make(WhatsAppInboundHandler)
      await handler.handle({
        fromNumber: '5511999999999',
        text: '2x1 Palmeiras',
        messageId: 'msg-r2',
      })

      assert.match(fake.sentDms[0].text, /Você não está cadastrado/)
    } finally {
      app.container.restore(WhatsAppClient)
    }
  })
})
