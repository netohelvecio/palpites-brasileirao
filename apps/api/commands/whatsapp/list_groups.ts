import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import env from '#start/env'
import WhatsAppClient from '#integrations/whatsapp/whatsapp_client'
import { withWhatsAppConnection } from '#integrations/whatsapp/with_command_connection'

export default class WhatsAppListGroups extends BaseCommand {
  static commandName = 'whatsapp:list-groups'
  static description =
    'Lista os grupos do WhatsApp pareados (JID + nome) — usado pra preencher WHATSAPP_GROUP_JID.'

  static options: CommandOptions = {
    startApp: true,
  }

  async run() {
    const mode = env.get('WHATSAPP_MODE')
    if (mode !== 'real') {
      this.logger.warning(`comando só funciona com WHATSAPP_MODE=real (atual: ${mode})`)
      return
    }

    const client = await this.app.container.make(WhatsAppClient)

    try {
      await withWhatsAppConnection(client, async () => {
        const fetchGroups = (
          client as unknown as { fetchGroups?: () => Promise<{ jid: string; name: string }[]> }
        ).fetchGroups
        if (!fetchGroups) {
          this.logger.error('client atual não suporta listagem de grupos')
          this.exitCode = 1
          return
        }

        const groups = await fetchGroups.call(client)
        if (groups.length === 0) {
          this.logger.info('nenhum grupo encontrado — confirme o pareamento')
          return
        }

        this.logger.info(`${groups.length} grupos:`)
        for (const g of groups) {
          console.log(`${g.jid}\t${g.name}`)
        }
      })
    } catch (err) {
      this.logger.error(err instanceof Error ? err.message : String(err))
      this.exitCode = 1
    }
  }
}
