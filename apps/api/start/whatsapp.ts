import app from '@adonisjs/core/services/app'
import logger from '@adonisjs/core/services/logger'
import env from '#start/env'
import WhatsAppClient from '#integrations/whatsapp/whatsapp_client'
import WhatsAppInboundHandler from '#services/whatsapp_inbound_handler'

/**
 * Boot do WhatsApp client + wire do handler de inbound.
 * Preload com environment=['web'] em adonisrc, pra não conectar em test/console/repl.
 *
 * Em modo `real`, conecta no boot e registra o handler. Em `stub`/`disabled`,
 * é no-op barato (handler registrado mas nunca chamado em stub; disabled é offline).
 */
const mode = env.get('WHATSAPP_MODE')
const client = await app.container.make(WhatsAppClient)
const handler = await app.container.make(WhatsAppInboundHandler)

client.onMessage((msg) => handler.handle(msg))

try {
  await client.connect()
  logger.info({ mode }, 'whatsapp: client connected')
} catch (err) {
  logger.error({ err, mode }, 'whatsapp: connect failed')
}

app.terminating(async () => {
  try {
    await client.disconnect()
  } catch (err) {
    logger.warn({ err }, 'whatsapp: disconnect error during shutdown')
  }
})
