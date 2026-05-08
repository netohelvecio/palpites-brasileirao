import WhatsAppClient, {
  type WhatsAppMode,
  type IncomingMessage,
  type IncomingMessageHandler,
} from '#integrations/whatsapp/whatsapp_client'

export class FakeWhatsAppClient extends WhatsAppClient {
  mode: WhatsAppMode = 'stub'
  private connected = true
  public sentMessages: string[] = []
  public sentDms: { number: string; text: string }[] = []
  public sentPolls: { question: string; options: string[] }[] = []
  public throwOnSend: Error | null = null
  public throwOnSendToUser: Error | null = null
  public throwOnSendPoll: Error | null = null
  public pollMessageId = 'poll-msg-1'
  private messageHandler: IncomingMessageHandler | null = null

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

  async sendToUser(phoneNumber: string, text: string): Promise<void> {
    if (this.throwOnSendToUser) throw this.throwOnSendToUser
    this.sentDms.push({ number: phoneNumber, text })
  }

  async sendPollToGroup(question: string, options: string[]): Promise<{ messageId: string }> {
    if (this.throwOnSendPoll) throw this.throwOnSendPoll
    this.sentPolls.push({ question, options })
    return { messageId: this.pollMessageId }
  }

  onMessage(handler: IncomingMessageHandler): void {
    this.messageHandler = handler
  }

  /** Helper de teste — aciona o handler registrado como se viesse do Baileys. */
  async simulateIncoming(msg: IncomingMessage): Promise<void> {
    if (!this.messageHandler) {
      throw new Error('FakeWhatsAppClient: nenhum handler registrado via onMessage')
    }
    await this.messageHandler(msg)
  }
}
