import { inject } from '@adonisjs/core'
import logger from '@adonisjs/core/services/logger'
import FixturesSyncService, { type SyncReport } from '#services/fixtures_sync_service'
import RoundRepository from '#repositories/round_repository'
import SeasonRepository from '#repositories/season_repository'

export interface OpenRoundRun {
  seasonId: string
  syncReport: SyncReport | null
  roundOpened: boolean
  error?: string
}

export interface OpenRoundReport {
  runs: OpenRoundRun[]
}

@inject()
export default class OpenRoundJob {
  constructor(
    private seasonRepository: SeasonRepository,
    private roundRepository: RoundRepository,
    private fixturesSyncService: FixturesSyncService
  ) {}

  async run(): Promise<OpenRoundReport> {
    const seasons = await this.seasonRepository.listActive()
    const runs: OpenRoundRun[] = []

    for (const season of seasons) {
      try {
        const syncReport = await this.fixturesSyncService.syncCurrentMatchday(season.id)
        const round = await this.roundRepository.findBySeasonAndNumber(
          season.id,
          syncReport.currentMatchday
        )

        let roundOpened = false
        if (round && round.status === 'pending' && syncReport.match) {
          await this.roundRepository.update(round, { status: 'open' })
          roundOpened = true
        }

        runs.push({ seasonId: season.id, syncReport, roundOpened })
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        logger.error({ seasonId: season.id, err: msg }, 'OpenRoundJob: falha em season')
        runs.push({
          seasonId: season.id,
          syncReport: null,
          roundOpened: false,
          error: msg,
        })
      }
    }

    logger.info({ runs }, 'OpenRoundJob: finished')
    return { runs }
  }
}
