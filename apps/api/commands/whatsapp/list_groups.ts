import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import env from '#start/env'
import WhatsAppClient from '#integrations/whatsapp/whatsapp_client'

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

    // Comandos ace não disparam o preload start/whatsapp.ts (que só roda em environment 'web'),
    // então precisamos conectar manualmente. Auth persistida reusa a sessão sem novo QR.
    this.logger.info('Conectando ao WhatsApp (reusando sessão pareada)…')
    try {
      await client.connect()
    } catch (err) {
      this.logger.error(err instanceof Error ? err.message : String(err))
      this.exitCode = 1
      return
    }

    const start = Date.now()
    while (!client.isConnected()) {
      if (Date.now() - start > 30_000) {
        this.logger.error('timeout esperando conexão Baileys (30s)')
        this.exitCode = 1
        await client.disconnect().catch(() => {})
        return
      }
      await new Promise((r) => setTimeout(r, 500))
    }

    try {
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
    } finally {
      await client.disconnect().catch(() => {})
    }
  }
}
