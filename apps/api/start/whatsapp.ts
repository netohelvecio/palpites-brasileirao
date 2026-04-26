import app from '@adonisjs/core/services/app'
import logger from '@adonisjs/core/services/logger'
import env from '#start/env'
import WhatsAppClient from '#integrations/whatsapp/whatsapp_client'

/**
 * Boot do WhatsApp client. Preload com environment=['web'] em adonisrc,
 * pra não conectar em test/console/repl.
 *
 * Em modo `real`, conecta no boot. Em `stub`/`disabled`, é no-op barato.
 * Falha de connect não derruba o app — jobs vão respeitar o gate (isConnected=false).
 */
const mode = env.get('WHATSAPP_MODE')
const client = await app.container.make(WhatsAppClient)

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
