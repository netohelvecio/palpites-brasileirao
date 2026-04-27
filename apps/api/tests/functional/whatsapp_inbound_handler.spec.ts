import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import WhatsAppClient from '#integrations/whatsapp/whatsapp_client'
import WhatsAppInboundHandler from '#services/whatsapp_inbound_handler'
import User from '#models/user'
import Guess from '#models/guess'
import { UserFactory } from '#factories/user_factory'
import { SeasonFactory } from '#factories/season_factory'
import { RoundFactory } from '#factories/round_factory'
import { MatchFactory } from '#factories/match_factory'
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
    // sem season ativa → handleGuess responde "sem rodada"
    const fake = new FakeWhatsAppClient()
    app.container.swap(WhatsAppClient, () => fake)
    try {
      const handler = await app.container.make(WhatsAppInboundHandler)
      await handler.handle({
        fromNumber: '5511999990010',
        text: '2x1 Palmeiras',
        messageId: 'msg-r1',
      })

      assert.match(fake.sentDms[0].text, /Sem rodada aberta no momento/)
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

test.group('WhatsAppInboundHandler — palpite', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  function setupFake() {
    const fake = new FakeWhatsAppClient()
    app.container.swap(WhatsAppClient, () => fake)
    return fake
  }

  function teardownFake() {
    app.container.restore(WhatsAppClient)
  }

  async function setupActiveOpenRound(opts?: {
    homeTeam?: string
    awayTeam?: string
    kickoffPast?: boolean
  }) {
    const season = await SeasonFactory.merge({ isActive: true }).create()
    const round = await RoundFactory.merge({
      seasonId: season.id,
      number: 12,
      status: 'open',
    }).create()
    const match = await MatchFactory.merge({
      roundId: round.id,
      homeTeam: opts?.homeTeam ?? 'Palmeiras',
      awayTeam: opts?.awayTeam ?? 'Flamengo',
      kickoffAt: opts?.kickoffPast
        ? DateTime.now().minus({ minutes: 10 })
        : DateTime.now().plus({ hours: 2 }),
    }).create()
    return { season, round, match }
  }

  test('happy path: cadastrado + rodada aberta + 2x1 Palmeiras → upsert + reply + grupo', async ({
    assert,
  }) => {
    const user = await UserFactory.merge({
      whatsappNumber: '5511999990100',
      name: 'Helvécio',
      emoji: '⚽',
    }).create()
    const { match } = await setupActiveOpenRound()
    const fake = setupFake()
    try {
      const handler = await app.container.make(WhatsAppInboundHandler)
      await handler.handle({
        fromNumber: '5511999990100',
        text: '2x1 Palmeiras',
        messageId: 'g-1',
      })

      const guess = await Guess.query()
        .where('user_id', user.id)
        .where('match_id', match.id)
        .first()
      assert.isNotNull(guess)
      assert.equal(guess!.homeScore, 2)
      assert.equal(guess!.awayScore, 1)
      assert.isNull(guess!.points)

      assert.lengthOf(fake.sentDms, 1)
      assert.equal(fake.sentDms[0].number, '5511999990100')
      assert.match(fake.sentDms[0].text, /✅ Palpite registrado: Palmeiras 2 x 1 Flamengo/)

      assert.lengthOf(fake.sentMessages, 1)
      assert.equal(fake.sentMessages[0], 'Helvécio ⚽ palpitou: Palmeiras 2 x 1 Flamengo')
    } finally {
      teardownFake()
    }
  })

  test('edição: segundo palpite sobrescreve, novo reply e novo post no grupo', async ({
    assert,
  }) => {
    const user = await UserFactory.merge({
      whatsappNumber: '5511999990101',
      name: 'Helvécio',
      emoji: '⚽',
    }).create()
    const { match } = await setupActiveOpenRound()
    const fake = setupFake()
    try {
      const handler = await app.container.make(WhatsAppInboundHandler)

      await handler.handle({
        fromNumber: '5511999990101',
        text: '2x1 Palmeiras',
        messageId: 'e-1',
      })
      await handler.handle({
        fromNumber: '5511999990101',
        text: '1x1',
        messageId: 'e-2',
      })

      const guesses = await Guess.query().where('user_id', user.id).where('match_id', match.id)
      assert.lengthOf(guesses, 1)
      assert.equal(guesses[0].homeScore, 1)
      assert.equal(guesses[0].awayScore, 1)

      assert.lengthOf(fake.sentDms, 2)
      assert.match(fake.sentDms[1].text, /1 x 1/)

      assert.lengthOf(fake.sentMessages, 2)
      assert.equal(fake.sentMessages[1], 'Helvécio ⚽ palpitou: Palmeiras 1 x 1 Flamengo')
    } finally {
      teardownFake()
    }
  })

  test('número desconhecido (sem /cadastro) → reply NOT_REGISTERED', async ({ assert }) => {
    await setupActiveOpenRound()
    const fake = setupFake()
    try {
      const handler = await app.container.make(WhatsAppInboundHandler)
      await handler.handle({
        fromNumber: '5511999990102',
        text: '2x1 Palmeiras',
        messageId: 'nr-1',
      })

      assert.match(fake.sentDms[0].text, /Você não está cadastrado/)
      assert.lengthOf(fake.sentMessages, 0)
    } finally {
      teardownFake()
    }
  })

  test('user cadastrado mas sem rodada aberta → reply "sem rodada"', async ({ assert }) => {
    await UserFactory.merge({ whatsappNumber: '5511999990103' }).create()
    const fake = setupFake()
    try {
      const handler = await app.container.make(WhatsAppInboundHandler)
      await handler.handle({
        fromNumber: '5511999990103',
        text: '2x1 Palmeiras',
        messageId: 'nr-2',
      })

      assert.match(fake.sentDms[0].text, /Sem rodada aberta no momento/)
      assert.lengthOf(fake.sentMessages, 0)
    } finally {
      teardownFake()
    }
  })

  test('kickoff já passou → reply "palpites fechados", sem upsert', async ({ assert }) => {
    const user = await UserFactory.merge({ whatsappNumber: '5511999990104' }).create()
    const { match } = await setupActiveOpenRound({ kickoffPast: true })
    const fake = setupFake()
    try {
      const handler = await app.container.make(WhatsAppInboundHandler)
      await handler.handle({
        fromNumber: '5511999990104',
        text: '2x1 Palmeiras',
        messageId: 'kp-1',
      })

      const guess = await Guess.query()
        .where('user_id', user.id)
        .where('match_id', match.id)
        .first()
      assert.isNull(guess)

      assert.match(fake.sentDms[0].text, /Palpites fechados/)
      assert.lengthOf(fake.sentMessages, 0)
    } finally {
      teardownFake()
    }
  })

  test('texto sem placar → reply de erro de parser', async ({ assert }) => {
    await UserFactory.merge({ whatsappNumber: '5511999990105' }).create()
    await setupActiveOpenRound()
    const fake = setupFake()
    try {
      const handler = await app.container.make(WhatsAppInboundHandler)
      await handler.handle({
        fromNumber: '5511999990105',
        text: 'oi tudo bem',
        messageId: 'p-1',
      })

      assert.match(fake.sentDms[0].text, /Não entendi o placar/)
      assert.lengthOf(fake.sentMessages, 0)
    } finally {
      teardownFake()
    }
  })

  test('texto com placar mas time errado → reply de erro de parser', async ({ assert }) => {
    await UserFactory.merge({ whatsappNumber: '5511999990106' }).create()
    await setupActiveOpenRound({ homeTeam: 'Palmeiras', awayTeam: 'Flamengo' })
    const fake = setupFake()
    try {
      const handler = await app.container.make(WhatsAppInboundHandler)
      await handler.handle({
        fromNumber: '5511999990106',
        text: '2x1 Santos',
        messageId: 'p-2',
      })

      assert.match(fake.sentDms[0].text, /Não entendi o placar/)
      assert.lengthOf(fake.sentMessages, 0)
    } finally {
      teardownFake()
    }
  })

  test('empate "1x1" sem time funciona', async ({ assert }) => {
    const user = await UserFactory.merge({
      whatsappNumber: '5511999990107',
      name: 'Ana',
      emoji: '🦊',
    }).create()
    const { match } = await setupActiveOpenRound()
    setupFake()
    try {
      const handler = await app.container.make(WhatsAppInboundHandler)
      await handler.handle({
        fromNumber: '5511999990107',
        text: '1x1',
        messageId: 'e-3',
      })

      const guess = await Guess.query()
        .where('user_id', user.id)
        .where('match_id', match.id)
        .first()
      assert.isNotNull(guess)
      assert.equal(guess!.homeScore, 1)
      assert.equal(guess!.awayScore, 1)
    } finally {
      teardownFake()
    }
  })
})
