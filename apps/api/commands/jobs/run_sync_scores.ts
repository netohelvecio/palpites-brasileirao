import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import SyncScoresJob from '#jobs/sync_scores_job'
import WhatsAppClient from '#integrations/whatsapp/whatsapp_client'
import { withWhatsAppConnection } from '#integrations/whatsapp/with_command_connection'

export default class RunSyncScores extends BaseCommand {
  static commandName = 'jobs:run-sync-scores'
  static description = 'Dispara o SyncScoresJob manualmente (útil em dev)'

  static options: CommandOptions = {
    startApp: true,
  }

  async run() {
    const client = await this.app.container.make(WhatsAppClient)

    try {
      await withWhatsAppConnection(client, async () => {
        const job = await this.app.container.make(SyncScoresJob)
        const report = await job.run()
        this.logger.info(JSON.stringify(report, null, 2))
      })
    } catch (err) {
      this.logger.error(err instanceof Error ? err.message : String(err))
      this.exitCode = 1
    }
  }
}
