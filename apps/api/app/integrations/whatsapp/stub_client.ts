import logger from '@adonisjs/core/services/logger'
import WhatsAppClient, {
  type WhatsAppMode,
  type IncomingMessageHandler,
} from './whatsapp_client.js'

export default class StubClient extends WhatsAppClient {
  readonly mode: WhatsAppMode = 'stub'
  private connected = true

  async connect() {
    this.connected = true
    logger.info('WhatsApp stub: connected (no-op)')
  }

  async disconnect() {
    this.connected = false
    logger.info('WhatsApp stub: disconnected (no-op)')
  }

  isConnected(): boolean {
    return this.connected
  }

  async sendToGroup(text: string): Promise<void> {
    logger.info({ text }, 'WhatsApp stub: send to group')
  }

  async sendToUser(phoneNumber: string, text: string): Promise<void> {
    logger.info({ phoneNumber, text }, 'WhatsApp stub: send to user')
  }

  onMessage(_handler: IncomingMessageHandler): void {
    // stub: handler armazenado mas nunca chamado (sem fonte de mensagens)
  }
}
