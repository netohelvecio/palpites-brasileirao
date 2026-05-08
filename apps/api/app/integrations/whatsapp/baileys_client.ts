import { mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import qrcode from 'qrcode-terminal'
import logger from '@adonisjs/core/services/logger'
import baileys, {
  Browsers,
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
  type WASocket,
} from '@whiskeysockets/baileys'

const makeWASocket = (baileys as any).default ?? baileys
import env from '#start/env'
import WhatsAppClient, {
  type WhatsAppMode,
  type IncomingMessageHandler,
} from './whatsapp_client.js'

type ConnState = 'connecting' | 'open' | 'close'

/**
 * Logger pino-compatível silent. Baileys requer um logger com `child()`,
 * `trace/debug/info/warn/error/fatal` — interface mínima do pino. Em vez
 * de adicionar pino como dep direta, devolvemos um no-op recursivo.
 */
function makeSilentBaileysLogger(): any {
  const noop = () => {}
  const silentLogger: any = {
    level: 'silent',
    trace: noop,
    debug: noop,
    info: noop,
    warn: noop,
    error: noop,
    fatal: noop,
  }
  silentLogger.child = () => silentLogger
  return silentLogger
}

export default class BaileysClient extends WhatsAppClient {
  readonly mode: WhatsAppMode = 'real'
  private socket: WASocket | null = null
  private state: ConnState = 'close'
  private reconnectAttempt = 0
  private shuttingDown = false
  private messageHandler: IncomingMessageHandler | null = null

  async connect(): Promise<void> {
    const authPath = env.get('WHATSAPP_AUTH_PATH')
    if (!existsSync(authPath)) {
      await mkdir(authPath, { recursive: true })
    }

    await this.openSocket()
  }

  async disconnect(): Promise<void> {
    this.shuttingDown = true
    if (this.socket) {
      try {
        this.socket.end(undefined)
      } catch (err) {
        logger.warn({ err }, 'BaileysClient: erro ao encerrar socket')
      }
    }
    this.state = 'close'
  }

  isConnected(): boolean {
    return this.state === 'open'
  }

  async sendToGroup(text: string): Promise<void> {
    const jid = env.get('WHATSAPP_GROUP_JID')
    if (!jid) {
      throw new Error(
        'WHATSAPP_GROUP_JID não configurado — rode `node ace whatsapp:list-groups` para descobrir o JID e setar no .env'
      )
    }
    if (!this.socket || this.state !== 'open') {
      throw new Error('BaileysClient: socket não conectado')
    }
    await this.socket.sendMessage(jid, { text })
  }

  async sendToUser(phoneNumberOrJid: string, text: string): Promise<void> {
    if (!this.socket || this.state !== 'open') {
      throw new Error('BaileysClient: socket não conectado')
    }
    const jid = phoneNumberOrJid.includes('@')
      ? phoneNumberOrJid
      : `${phoneNumberOrJid}@s.whatsapp.net`
    await this.socket.sendMessage(jid, { text })
  }

  async sendPollToGroup(question: string, options: string[]): Promise<{ messageId: string }> {
    const jid = env.get('WHATSAPP_GROUP_JID')
    if (!jid) {
      throw new Error('WHATSAPP_GROUP_JID não configurado')
    }
    if (!this.socket || this.state !== 'open') {
      throw new Error('BaileysClient: socket não conectado')
    }
    const result = await this.socket.sendMessage(jid, {
      poll: { name: question, values: options, selectableCount: 1 },
    })
    return { messageId: result?.key?.id ?? '' }
  }

  onMessage(handler: IncomingMessageHandler): void {
    this.messageHandler = handler
  }

  /** Lista os grupos pareados — usado pelo ace command whatsapp:list-groups. */
  async fetchGroups(): Promise<{ jid: string; name: string }[]> {
    if (!this.socket || this.state !== 'open') {
      throw new Error('BaileysClient: socket não conectado')
    }
    const groups = await this.socket.groupFetchAllParticipating()
    return Object.values(groups).map((g) => ({ jid: g.id, name: g.subject ?? '(sem nome)' }))
  }

  /** Resolve o lid de um telefone E.164 — usado pelo ace command whatsapp:lookup-lid. */
  async lookupNumber(
    phone: string
  ): Promise<{ jid: string; lid: string | null; exists: boolean }[]> {
    if (!this.socket || this.state !== 'open') {
      throw new Error('BaileysClient: socket não conectado')
    }
    const result = await this.socket.onWhatsApp(phone)
    if (!result) return []
    return result.map((r: any) => ({
      jid: r.jid,
      lid: typeof r.lid === 'string' ? r.lid : null,
      exists: !!r.exists,
    }))
  }

  private async openSocket(): Promise<void> {
    const authPath = env.get('WHATSAPP_AUTH_PATH')
    const { state, saveCreds } = await useMultiFileAuthState(authPath)
    const { version, isLatest } = await fetchLatestBaileysVersion()
    logger.info({ version, isLatest }, 'BaileysClient: WhatsApp Web version')

    this.state = 'connecting'
    const socket = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false,
      browser: Browsers.macOS('Desktop'),
      logger: makeSilentBaileysLogger(),
    }) as WASocket
    this.socket = socket

    socket.ev.on('creds.update', saveCreds)

    socket.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update

      if (qr) {
        logger.info('BaileysClient: QR pendente — escaneie com o app do WhatsApp')
        qrcode.generate(qr, { small: true })
      }

      if (connection === 'open') {
        this.state = 'open'
        this.reconnectAttempt = 0
        logger.info('BaileysClient: conexão aberta')
      }

      if (connection === 'close') {
        this.state = 'close'
        const code = (lastDisconnect?.error as any)?.output?.statusCode
        const isLoggedOut = code === DisconnectReason.loggedOut

        if (this.shuttingDown) {
          logger.info('BaileysClient: encerrado durante shutdown')
          return
        }

        if (isLoggedOut) {
          logger.error('BaileysClient: sessão deslogada — apague a pasta de auth e pareie de novo')
          return
        }

        const delay = this.computeBackoff()
        logger.warn({ delayMs: delay, code }, 'BaileysClient: conexão caiu, reconectando')
        setTimeout(() => {
          this.openSocket().catch((err) => {
            logger.error({ err }, 'BaileysClient: falha ao reconectar')
          })
        }, delay)
      }
    })

    socket.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return
      if (!this.messageHandler) return
      for (const m of messages) {
        if (m.key.fromMe) continue

        const isPlainDM = m.key.remoteJid?.endsWith('@s.whatsapp.net') ?? false
        const isLidDM = m.key.remoteJid?.endsWith('@lid') ?? false
        if (!isPlainDM && !isLidDM) continue

        const text = m.message?.conversation ?? m.message?.extendedTextMessage?.text ?? ''
        if (!text.trim()) continue

        // @lid: tenta resolver pro telefone real via senderPn (Baileys 6.7+).
        // Se não der, usa o JID @lid completo — sendToUser aceita JID, então a reply ainda chega.
        let fromNumber: string
        if (isPlainDM) {
          fromNumber = m.key.remoteJid!.replace(/@s\.whatsapp\.net$/, '')
        } else {
          const senderPn = (m.key as any).senderPn as string | undefined
          fromNumber =
            senderPn && typeof senderPn === 'string'
              ? senderPn.replace(/@s\.whatsapp\.net$/, '')
              : m.key.remoteJid!
        }

        logger.info(
          {
            remoteJid: m.key.remoteJid,
            pushName: m.pushName ?? null,
            fromNumber,
            textPreview: text.slice(0, 80),
          },
          'BaileysClient: DM inbound'
        )

        await this.messageHandler({
          fromNumber,
          text,
          messageId: m.key.id ?? 'unknown',
        }).catch((err) => {
          logger.error({ err, fromNumber }, 'BaileysClient: inbound handler threw')
        })
      }
    })
  }

  private computeBackoff(): number {
    this.reconnectAttempt++
    const base = [2000, 5000, 10000, 20000, 30000]
    return base[Math.min(this.reconnectAttempt - 1, base.length - 1)]
  }
}
