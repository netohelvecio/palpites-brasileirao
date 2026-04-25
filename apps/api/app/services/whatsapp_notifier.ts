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
}
