import { inject } from '@adonisjs/core'
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
  }): Promise<void> {
    const text = roundOpenedDmMessage({
      userName: args.user.name,
      userEmoji: args.user.emoji,
      roundNumber: args.roundNumber,
      homeTeam: args.homeTeam,
      awayTeam: args.awayTeam,
      kickoffAt: args.kickoffAt,
    })
    await this.client.sendToUser(args.user.whatsappNumber, text)
  }

  async notifyGuessRegistered(input: GuessRegisteredGroupInput): Promise<void> {
    await this.client.sendToGroup(guessRegisteredGroupMessage(input))
  }
}
