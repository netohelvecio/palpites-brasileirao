import WhatsAppClient, {
  type WhatsAppMode,
  type IncomingMessageHandler,
} from './whatsapp_client.js'

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

  async sendToUser(_phoneNumber: string, _text: string): Promise<void> {
    throw new Error('WhatsApp disabled: sendToUser não deveria ser chamado (gate falhou?)')
  }

  onMessage(_handler: IncomingMessageHandler): void {
    // disabled: handler nunca é chamado
  }
}
