import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import OpenRoundJob from '#jobs/open_round_job'

export default class RunOpenRound extends BaseCommand {
  static commandName = 'jobs:run-open-round'
  static description = 'Dispara o OpenRoundJob manualmente (útil em dev)'

  static options: CommandOptions = {
    startApp: true,
  }

  async run() {
    const job = await this.app.container.make(OpenRoundJob)
    const report = await job.run()
    this.logger.info(JSON.stringify(report, null, 2))
  }
}
