import { BaseCommand, args } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import RoundFinalizerService from '#services/round_finalizer_service'

export default class RunFinalizeRound extends BaseCommand {
  static commandName = 'jobs:run-finalize-round'
  static description = 'Dispara o RoundFinalizerService manualmente para um roundId (útil em dev)'

  static options: CommandOptions = {
    startApp: true,
  }

  @args.string({ description: 'UUID do round a finalizar' })
  declare roundId: string

  async run() {
    const finalizer = await this.app.container.make(RoundFinalizerService)
    await finalizer.finalize(this.roundId)
    this.logger.info(`finalized round ${this.roundId}`)
  }
}
