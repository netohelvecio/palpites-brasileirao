import { inject } from '@adonisjs/core'
import { DateTime } from 'luxon'
import logger from '@adonisjs/core/services/logger'
import UserRepository from '#repositories/user_repository'
import RoundRepository from '#repositories/round_repository'
import GuessRepository from '#repositories/guess_repository'
import WhatsAppNotifier from '#services/whatsapp_notifier'
import { parseScore } from '#services/score_parser'
import WhatsAppClient, { type IncomingMessage } from '#integrations/whatsapp/whatsapp_client'

const REGISTER_HELP =
  'Pra te cadastrar, manda: /cadastro <seu nome> <emoji>. Ex: /cadastro Helvécio ⚽'
const NAME_TOO_LONG = 'Nome muito longo (máximo 80 caracteres).'
const NOT_REGISTERED =
  'Você não está cadastrado. Manda /cadastro <seu nome> <emoji>. Ex: /cadastro Helvécio ⚽'
const NO_OPEN_ROUND = 'Sem rodada aberta no momento.'
const INTERNAL_ERROR = 'Erro interno, avise o admin.'

@inject()
export default class WhatsAppInboundHandler {
  constructor(
    private userRepository: UserRepository,
    private roundRepository: RoundRepository,
    private guessRepository: GuessRepository,
    private notifier: WhatsAppNotifier,
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

  private async handleGuess(msg: IncomingMessage): Promise<void> {
    const user = await this.userRepository.findByWhatsappNumber(msg.fromNumber)
    if (!user) {
      await this.client.sendToUser(msg.fromNumber, NOT_REGISTERED)
      return
    }

    const round = await this.roundRepository.findOpenInActiveSeason()
    if (!round) {
      await this.client.sendToUser(msg.fromNumber, NO_OPEN_ROUND)
      return
    }

    const match = round.match
    if (!match) {
      logger.error(
        { roundId: round.id, fromNumber: msg.fromNumber },
        'WhatsAppInboundHandler: round open sem match associado'
      )
      await this.client.sendToUser(msg.fromNumber, INTERNAL_ERROR)
      return
    }

    if (match.kickoffAt < DateTime.now()) {
      await this.client.sendToUser(
        msg.fromNumber,
        `⏱️ Palpites fechados pra rodada ${round.number}.`
      )
      return
    }

    const parsed = parseScore(msg.text, {
      homeTeam: match.homeTeam,
      awayTeam: match.awayTeam,
    })
    if (!parsed.ok) {
      await this.client.sendToUser(
        msg.fromNumber,
        `❌ Não entendi o placar. Exemplo: 2x1 ${match.homeTeam}, ou 1x1 (empate).`
      )
      return
    }

    await this.guessRepository.upsertByUserAndMatch(user.id, match.id, {
      homeScore: parsed.homeScore,
      awayScore: parsed.awayScore,
    })

    try {
      await this.client.sendToUser(
        msg.fromNumber,
        `✅ Palpite registrado: ${match.homeTeam} ${parsed.homeScore} x ${parsed.awayScore} ${match.awayTeam}.`
      )
    } catch (err) {
      logger.error(
        { err, fromNumber: msg.fromNumber },
        'WhatsAppInboundHandler: falha ao mandar reply privado'
      )
    }

    try {
      await this.notifier.notifyGuessRegistered({
        userName: user.name,
        userEmoji: user.emoji,
        homeTeam: match.homeTeam,
        awayTeam: match.awayTeam,
        homeScore: parsed.homeScore,
        awayScore: parsed.awayScore,
      })
    } catch (err) {
      logger.error(
        { err, fromNumber: msg.fromNumber },
        'WhatsAppInboundHandler: falha ao postar no grupo'
      )
    }
  }
}
