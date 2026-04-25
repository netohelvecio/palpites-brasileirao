import WhatsAppClient, { type WhatsAppMode } from './whatsapp_client.js'

export default class DisabledClient extends WhatsAppClient {
  readonly mode: WhatsAppMode = 'disabled'

  async connect() {}
  async disconnect() {}

  isConnected(): boolean {
    return false
  }

  async sendToGroup(_text: string): Promise<void> {
    throw new Error('WhatsApp disabled: sendToGroup não deveria ser chamado (gate falhou?)')
  }
}
