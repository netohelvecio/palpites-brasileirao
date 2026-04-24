import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import SyncScoresJob from '#jobs/sync_scores_job'

export default class RunSyncScores extends BaseCommand {
  static commandName = 'jobs:run-sync-scores'
  static description = 'Dispara o SyncScoresJob manualmente (útil em dev)'

  static options: CommandOptions = {
    startApp: true,
  }

  async run() {
    const job = await this.app.container.make(SyncScoresJob)
    const report = await job.run()
    this.logger.info(JSON.stringify(report, null, 2))
  }
}
