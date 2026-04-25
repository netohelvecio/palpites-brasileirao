import { inject } from '@adonisjs/core'
import { DateTime } from 'luxon'
import logger from '@adonisjs/core/services/logger'
import { RoundStatus } from '@palpites/shared'
import RoundRepository from '#repositories/round_repository'

export interface CloseRoundReport {
  closedCount: number
  closedRoundIds: string[]
}

@inject()
export default class CloseRoundJob {
  constructor(private roundRepository: RoundRepository) {}

  async run(now: DateTime = DateTime.now()): Promise<CloseRoundReport> {
    const rounds = await this.roundRepository.listOpenPastKickoff(now)
    const closedRoundIds: string[] = []

    for (const round of rounds) {
      await this.roundRepository.update(round, { status: RoundStatus.CLOSED })
      closedRoundIds.push(round.id)
    }

    const report = { closedCount: closedRoundIds.length, closedRoundIds }
    logger.info(report, 'CloseRoundJob: finished')
    return report
  }
}
