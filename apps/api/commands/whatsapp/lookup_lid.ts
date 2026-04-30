import { args, BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import env from '#start/env'
import WhatsAppClient from '#integrations/whatsapp/whatsapp_client'
import { withWhatsAppConnection } from '#integrations/whatsapp/with_command_connection'

export default class WhatsAppLookupLid extends BaseCommand {
  static commandName = 'whatsapp:lookup-lid'
  static description =
    'Resolve o lid de um número via socket.onWhatsApp — útil pra preencher users.whatsapp_number com o lid.'

  static options: CommandOptions = {
    startApp: true,
  }

  @args.string({ description: 'telefone E.164 sem + (ex: 5511987654321)' })
  declare phone: string

  async run() {
    const mode = env.get('WHATSAPP_MODE')
    if (mode !== 'real') {
      this.logger.warning(`comando só funciona com WHATSAPP_MODE=real (atual: ${mode})`)
      return
    }

    const client = await this.app.container.make(WhatsAppClient)

    try {
      await withWhatsAppConnection(client, async () => {
        const lookup = (
          client as unknown as {
            lookupNumber?: (
              phone: string
            ) => Promise<{ jid: string; lid: string | null; exists: boolean }[]>
          }
        ).lookupNumber

        if (!lookup) {
          this.logger.error('client atual não suporta lookup')
          this.exitCode = 1
          return
        }

        const results = await lookup.call(client, this.phone)
        if (results.length === 0) {
          this.logger.info('nenhum resultado — número pode não ter WhatsApp ou não foi reconhecido')
          return
        }

        for (const r of results) {
          console.log(`jid: ${r.jid}\tlid: ${r.lid ?? '(sem lid)'}\texists: ${r.exists}`)
        }
      })
    } catch (err) {
      this.logger.error(err instanceof Error ? err.message : String(err))
      this.exitCode = 1
    }
  }
}
