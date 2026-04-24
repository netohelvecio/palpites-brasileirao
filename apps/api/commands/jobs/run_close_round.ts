import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import CloseRoundJob from '#jobs/close_round_job'

export default class RunCloseRound extends BaseCommand {
  static commandName = 'jobs:run-close-round'
  static description = 'Dispara o CloseRoundJob manualmente (útil em dev)'

  static options: CommandOptions = {
    startApp: true,
  }

  async run() {
    const job = await this.app.container.make(CloseRoundJob)
    const report = await job.run()
    this.logger.info(JSON.stringify(report, null, 2))
  }
}
