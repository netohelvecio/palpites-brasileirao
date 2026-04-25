export type WhatsAppMode = 'real' | 'stub' | 'disabled'

export default abstract class WhatsAppClient {
  abstract readonly mode: WhatsAppMode
  abstract connect(): Promise<void>
  abstract disconnect(): Promise<void>
  abstract isConnected(): boolean
  abstract sendToGroup(text: string): Promise<void>
}
