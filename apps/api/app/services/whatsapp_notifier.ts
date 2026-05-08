import { inject } from '@adonisjs/core'
import logger from '@adonisjs/core/services/logger'
import { TiePollMode } from '@palpites/shared'
import WhatsAppClient from '#integrations/whatsapp/whatsapp_client'
import {
  roundOpenedMessage,
  type RoundOpenedInput,
} from '#integrations/whatsapp/templates/round_opened'
import {
  roundClosedMessage,
  type RoundClosedInput,
} from '#integrations/whatsapp/templates/round_closed'
import {
  matchFinishedMessage,
  type MatchFinishedInput,
} from '#integrations/whatsapp/templates/match_finished'
import {
  roundOpenedDmMessage,
  type RoundOpenedDmInput,
} from '#integrations/whatsapp/templates/round_opened_dm'
import {
  guessRegisteredGroupMessage,
  type GuessRegisteredGroupInput,
} from '#integrations/whatsapp/templates/guess_registered_group'
import {
  matchReminderMessage,
  type MatchReminderInput,
} from '#integrations/whatsapp/templates/match_reminder'
import { tiePollMessage, type TiePollCandidate } from '#integrations/whatsapp/templates/tie_poll'
import { tieEmojiFallbackMessage } from '#integrations/whatsapp/templates/tie_emoji_fallback'

@inject()
export default class WhatsAppNotifier {
  constructor(private client: WhatsAppClient) {}

  isReady(): boolean {
    return this.client.isConnected()
  }

  async notifyRoundOpened(input: RoundOpenedInput): Promise<void> {
    await this.client.sendToGroup(roundOpenedMessage(input))
  }

  async notifyRoundClosed(input: RoundClosedInput): Promise<void> {
    await this.client.sendToGroup(roundClosedMessage(input))
  }

  async notifyMatchFinished(input: MatchFinishedInput): Promise<void> {
    await this.client.sendToGroup(matchFinishedMessage(input))
  }

  async notifyRoundOpenedToUser(args: {
    user: { whatsappNumber: string; name: string; emoji: string }
    roundNumber: number
    homeTeam: string
    awayTeam: string
    kickoffAt: RoundOpenedDmInput['kickoffAt']
    pointsMultiplier?: number
  }): Promise<void> {
    const text = roundOpenedDmMessage({
      userName: args.user.name,
      userEmoji: args.user.emoji,
      roundNumber: args.roundNumber,
      homeTeam: args.homeTeam,
      awayTeam: args.awayTeam,
      kickoffAt: args.kickoffAt,
      pointsMultiplier: args.pointsMultiplier,
    })
    await this.client.sendToUser(args.user.whatsappNumber, text)
  }

  async notifyGuessRegistered(input: GuessRegisteredGroupInput): Promise<void> {
    await this.client.sendToGroup(guessRegisteredGroupMessage(input))
  }

  async notifyMatchReminder(input: MatchReminderInput): Promise<void> {
    await this.client.sendToGroup(matchReminderMessage(input))
  }

  async notifyTieCandidatesPoll(payload: {
    roundNumber: number
    candidates: TiePollCandidate[]
  }): Promise<{ mode: TiePollMode; messageId: string | null }> {
    const { question, options } = tiePollMessage(payload)
    try {
      const r = await this.client.sendPollToGroup(question, options)
      return { mode: TiePollMode.POLL, messageId: r.messageId }
    } catch (err) {
      logger.warn({ err }, 'WhatsAppNotifier: poll falhou, fallback emoji')
      const fallback = tieEmojiFallbackMessage(payload)
      await this.client.sendToGroup(fallback)
      return { mode: TiePollMode.EMOJI, messageId: null }
    }
  }
}
