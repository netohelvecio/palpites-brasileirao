import { inject } from '@adonisjs/core'
import logger from '@adonisjs/core/services/logger'
import MatchRepository from '#repositories/match_repository'
import RefreshMatchService from '#services/refresh_match_service'
import RoundFinalizerService from '#services/round_finalizer_service'

export interface SyncScoresRun {
  matchId: string
  roundId: string
  refreshed: boolean
  finalized: boolean
  error?: string
}

export interface SyncScoresReport {
  runs: SyncScoresRun[]
}

@inject()
export default class SyncScoresJob {
  constructor(
    private matchRepository: MatchRepository,
    private refreshMatchService: RefreshMatchService,
    private roundFinalizerService: RoundFinalizerService
  ) {}

  async run(): Promise<SyncScoresReport> {
    const matches = await this.matchRepository.listActiveNonFinished()
    const runs: SyncScoresRun[] = []

    for (const match of matches) {
      try {
        const report = await this.refreshMatchService.refresh(match.id)
        let finalized = false

        const fresh = await this.matchRepository.findByIdOrFail(match.id)
        if (fresh.status === 'finished' && match.round.status === 'closed') {
          await this.roundFinalizerService.finalize(match.roundId)
          finalized = true
        }

        runs.push({
          matchId: match.id,
          roundId: match.roundId,
          refreshed: report.updated,
          finalized,
        })
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        logger.error({ matchId: match.id, err: msg }, 'SyncScoresJob: falha em match')
        runs.push({
          matchId: match.id,
          roundId: match.roundId,
          refreshed: false,
          finalized: false,
          error: msg,
        })
      }
    }

    logger.info({ runs }, 'SyncScoresJob: finished')
    return { runs }
  }
}
