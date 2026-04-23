import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'

export default class HealthController {
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
      status: 'not-implemented',
      note: 'será implementado no plano 4',
    })
  }
}
