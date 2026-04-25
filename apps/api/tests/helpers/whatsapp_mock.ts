import WhatsAppClient, { type WhatsAppMode } from '#integrations/whatsapp/whatsapp_client'

export class FakeWhatsAppClient extends WhatsAppClient {
  mode: WhatsAppMode = 'stub'
  private connected = true
  public sentMessages: string[] = []
  public throwOnSend: Error | null = null

  async connect() {
    this.connected = true
  }

  async disconnect() {
    this.connected = false
  }

  isConnected(): boolean {
    return this.connected
  }

  setConnected(value: boolean) {
    this.connected = value
  }

  async sendToGroup(text: string): Promise<void> {
    if (this.throwOnSend) throw this.throwOnSend
    this.sentMessages.push(text)
  }
}
