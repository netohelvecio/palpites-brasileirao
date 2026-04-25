import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import WhatsAppClient from '#integrations/whatsapp/whatsapp_client'

@inject()
export default class HealthController {
  constructor(private whatsappClient: WhatsAppClient) {}

  async index({ response }: HttpContext) {
    try {
      await db.rawQuery('SELECT 1')
      return response.ok({ status: 'ok', db: 'up' })
    } catch {
      return response.serviceUnavailable({ status: 'degraded', db: 'down' })
    }
  }

  async whatsappStatus({ response }: HttpContext) {
    return response.ok({
      mode: this.whatsappClient.mode,
      connected: this.whatsappClient.isConnected(),
    })
  }
}
