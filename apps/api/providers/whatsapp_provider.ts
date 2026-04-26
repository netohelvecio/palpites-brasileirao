import type { ApplicationService } from '@adonisjs/core/types'
import env from '#start/env'
import WhatsAppClient from '#integrations/whatsapp/whatsapp_client'

export default class WhatsAppProvider {
  constructor(private app: ApplicationService) {}

  register() {
    this.app.container.singleton(WhatsAppClient, async () => {
      const mode = env.get('WHATSAPP_MODE')

      if (mode === 'stub') {
        const { default: StubClient } = await import('#integrations/whatsapp/stub_client')
        return new StubClient()
      }

      if (mode === 'real') {
        const { default: BaileysClient } = await import('#integrations/whatsapp/baileys_client')
        return new BaileysClient()
      }

      const { default: DisabledClient } = await import('#integrations/whatsapp/disabled_client')
      return new DisabledClient()
    })
  }
}
