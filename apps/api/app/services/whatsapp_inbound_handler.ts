import { inject } from '@adonisjs/core'
import logger from '@adonisjs/core/services/logger'
import UserRepository from '#repositories/user_repository'
import WhatsAppClient, { type IncomingMessage } from '#integrations/whatsapp/whatsapp_client'

const REGISTER_HELP =
  'Pra te cadastrar, manda: /cadastro <seu nome> <emoji>. Ex: /cadastro Helvécio ⚽'
const NAME_TOO_LONG = 'Nome muito longo (máximo 80 caracteres).'
const NOT_REGISTERED =
  'Você não está cadastrado. Manda /cadastro <seu nome> <emoji>. Ex: /cadastro Helvécio ⚽'

@inject()
export default class WhatsAppInboundHandler {
  constructor(
    private userRepository: UserRepository,
    private client: WhatsAppClient
  ) {}

  async handle(msg: IncomingMessage): Promise<void> {
    if (/^\/cadastro\b/i.test(msg.text)) {
      return this.handleRegister(msg)
    }
    return this.handleGuess(msg)
  }

  private async handleRegister(msg: IncomingMessage): Promise<void> {
    const args = msg.text.replace(/^\/cadastro\b\s*/i, '').trim()
    if (!args) {
      await this.client.sendToUser(msg.fromNumber, REGISTER_HELP)
      return
    }

    const tokens = args.split(/\s+/).filter((t) => t.length > 0)
    if (tokens.length < 2) {
      await this.client.sendToUser(msg.fromNumber, REGISTER_HELP)
      return
    }

    const emoji = tokens[tokens.length - 1]
    const name = tokens.slice(0, -1).join(' ')

    if (name.length > 80) {
      await this.client.sendToUser(msg.fromNumber, NAME_TOO_LONG)
      return
    }

    const existing = await this.userRepository.findByWhatsappNumber(msg.fromNumber)
    if (existing) {
      await this.client.sendToUser(
        msg.fromNumber,
        `Você já está cadastrado como ${existing.name} ${existing.emoji}.`
      )
      return
    }

    await this.userRepository.create({
      name,
      emoji,
      whatsappNumber: msg.fromNumber,
      isAdmin: false,
    })

    await this.client.sendToUser(
      msg.fromNumber,
      `✅ Cadastrado, ${name} ${emoji}! A partir de agora você pode mandar palpites.`
    )
  }

  /** Stub — implementação completa no Plano 5.4. */
  private async handleGuess(msg: IncomingMessage): Promise<void> {
    const user = await this.userRepository.findByWhatsappNumber(msg.fromNumber)
    if (!user) {
      await this.client.sendToUser(msg.fromNumber, NOT_REGISTERED)
      return
    }

    logger.info(
      { fromNumber: msg.fromNumber, text: msg.text },
      'WhatsAppInboundHandler.handleGuess: stub (5.4)'
    )
    await this.client.sendToUser(msg.fromNumber, 'Palpites ainda não estão habilitados. Em breve!')
  }
}
