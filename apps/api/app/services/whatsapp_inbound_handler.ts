import { inject } from '@adonisjs/core'
import { DateTime } from 'luxon'
import logger from '@adonisjs/core/services/logger'
import UserRepository from '#repositories/user_repository'
import RoundRepository from '#repositories/round_repository'
import GuessRepository from '#repositories/guess_repository'
import RoundCandidateRepository from '#repositories/round_candidate_repository'
import WhatsAppNotifier from '#services/whatsapp_notifier'
import RoundCandidatePickService from '#services/round_candidate_pick_service'
import { parseScore } from '#services/score_parser'
import WhatsAppClient, { type IncomingMessage } from '#integrations/whatsapp/whatsapp_client'
import { adminPickedMessage } from '#integrations/whatsapp/templates/admin_picked'

const REGISTER_HELP =
  'Pra te cadastrar, manda: /cadastro <seu nome> <emoji>. Ex: /cadastro Helvécio ⚽'
const NAME_TOO_LONG = 'Nome muito longo (máximo 80 caracteres).'
const NOT_REGISTERED =
  'Você não está cadastrado. Manda /cadastro <seu nome> <emoji>. Ex: /cadastro Helvécio ⚽'
const NO_OPEN_ROUND = 'Sem rodada aberta no momento.'
const INTERNAL_ERROR = 'Erro interno, avise o admin.'
const ESCOLHER_HELP = 'Uso: /escolher <número da posição>'
const ESCOLHER_RESTRICTED = '⛔ Comando restrito a administradores.'
const NO_AWAITING_ROUND = 'Nenhuma rodada aguardando escolha.'

@inject()
export default class WhatsAppInboundHandler {
  constructor(
    private userRepository: UserRepository,
    private roundRepository: RoundRepository,
    private guessRepository: GuessRepository,
    private notifier: WhatsAppNotifier,
    private client: WhatsAppClient,
    private roundCandidateRepository: RoundCandidateRepository,
    private roundCandidatePickService: RoundCandidatePickService
  ) {}

  async handle(msg: IncomingMessage): Promise<void> {
    if (/^\/cadastro\b/i.test(msg.text)) {
      return this.handleRegister(msg)
    }
    if (/^\/escolher\b/i.test(msg.text)) {
      return this.handleEscolher(msg)
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

  private async handleEscolher(msg: IncomingMessage): Promise<void> {
    const match = msg.text.match(/^\/escolher\s+(\d+)\s*$/i)
    if (!match) {
      await this.client.sendToUser(msg.fromNumber, ESCOLHER_HELP)
      return
    }

    const user = await this.userRepository.findByWhatsappNumber(msg.fromNumber)
    if (!user) {
      await this.client.sendToUser(msg.fromNumber, NOT_REGISTERED)
      return
    }
    if (!user.isAdmin) {
      await this.client.sendToUser(msg.fromNumber, ESCOLHER_RESTRICTED)
      return
    }

    const round = await this.roundRepository.findCurrentAwaitingPickAcrossSeasons()
    if (!round) {
      await this.client.sendToUser(msg.fromNumber, NO_AWAITING_ROUND)
      return
    }

    const position = Number.parseInt(match[1], 10)
    const candidate = await this.roundCandidateRepository.findByRoundAndPosition(round.id, position)
    if (!candidate) {
      await this.client.sendToUser(
        msg.fromNumber,
        `Posição ${position} é inválida pra rodada atual.`
      )
      return
    }

    const result = await this.roundCandidatePickService.pick(round.id, candidate.id)
    if (!result.ok) {
      logger.error(
        { reason: result.reason, roundId: round.id, candidateId: candidate.id },
        'WhatsAppInboundHandler: pick falhou inesperadamente'
      )
      await this.client.sendToUser(msg.fromNumber, INTERNAL_ERROR)
      return
    }

    try {
      await this.client.sendToUser(
        msg.fromNumber,
        `✅ Jogo da rodada ${round.number} definido: ${candidate.homeTeam} x ${candidate.awayTeam}`
      )
    } catch (err) {
      logger.error({ err }, 'WhatsAppInboundHandler: falha ao mandar reply privado /escolher')
    }

    try {
      await this.client.sendToGroup(
        adminPickedMessage({
          roundNumber: round.number,
          homeTeam: candidate.homeTeam,
          awayTeam: candidate.awayTeam,
        })
      )
    } catch (err) {
      logger.error({ err }, 'WhatsAppInboundHandler: falha ao postar admin pick no grupo')
    }
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
