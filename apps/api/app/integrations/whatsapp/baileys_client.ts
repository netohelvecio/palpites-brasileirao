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
import WhatsAppClient, { type WhatsAppMode } from './whatsapp_client.js'

type ConnState = 'connecting' | 'open' | 'close'

/**
 * Logger pino-compatível silent. Baileys requer um logger com `child()`,
 * `trace/debug/info/warn/error/fatal` — interface mínima do pino. Em vez
 * de adicionar pino como dep direta, devolvemos um no-op recursivo.
 */
function makeSilentBaileysLogger(): any {
  const noop = () => {}
  const logger: any = {
    level: 'silent',
    trace: noop,
    debug: noop,
    info: noop,
    warn: noop,
    error: noop,
    fatal: noop,
  }
  logger.child = () => logger
  return logger
}

export default class BaileysClient extends WhatsAppClient {
  readonly mode: WhatsAppMode = 'real'
  private socket: WASocket | null = null
  private state: ConnState = 'close'
  private reconnectAttempt = 0
  private shuttingDown = false

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

  /** Lista os grupos pareados — usado pelo ace command whatsapp:list-groups. */
  async fetchGroups(): Promise<{ jid: string; name: string }[]> {
    if (!this.socket || this.state !== 'open') {
      throw new Error('BaileysClient: socket não conectado')
    }
    const groups = await this.socket.groupFetchAllParticipating()
    return Object.values(groups).map((g) => ({ jid: g.id, name: g.subject ?? '(sem nome)' }))
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
    } as any) as WASocket
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
  }

  private computeBackoff(): number {
    this.reconnectAttempt++
    const base = [2000, 5000, 10000, 20000, 30000]
    return base[Math.min(this.reconnectAttempt - 1, base.length - 1)]
  }
}
