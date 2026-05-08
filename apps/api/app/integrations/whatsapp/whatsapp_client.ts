export type WhatsAppMode = 'real' | 'stub' | 'disabled'

export interface IncomingMessage {
  fromNumber: string
  text: string
  messageId: string
}

export type IncomingMessageHandler = (msg: IncomingMessage) => Promise<void>

export interface PollSendResult {
  messageId: string
}

export default abstract class WhatsAppClient {
  abstract readonly mode: WhatsAppMode
  abstract connect(): Promise<void>
  abstract disconnect(): Promise<void>
  abstract isConnected(): boolean
  abstract sendToGroup(text: string): Promise<void>
  abstract sendToUser(phoneNumber: string, text: string): Promise<void>
  abstract sendPollToGroup(question: string, options: string[]): Promise<PollSendResult>
  abstract onMessage(handler: IncomingMessageHandler): void
}
