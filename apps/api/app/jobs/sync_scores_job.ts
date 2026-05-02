import { inject } from '@adonisjs/core'
import logger from '@adonisjs/core/services/logger'
import { MatchStatus, RoundStatus } from '@palpites/shared'
import MatchRepository from '#repositories/match_repository'
import RefreshMatchService from '#services/refresh_match_service'
import RoundFinalizerService from '#services/round_finalizer_service'
import WhatsAppNotifier from '#services/whatsapp_notifier'

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
    private roundFinalizerService: RoundFinalizerService,
    private notifier: WhatsAppNotifier
  ) {}

  async run(): Promise<SyncScoresReport> {
    const matches = await this.matchRepository.listActiveNonFinished()
    const runs: SyncScoresRun[] = []

    for (const match of matches) {
      let refreshed = false
      let finalized = false
      let error: string | undefined

      try {
        const report = await this.refreshMatchService.refresh(match.id)
        refreshed = report.updated
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        logger.error({ matchId: match.id, err: msg }, 'SyncScoresJob: falha em refresh')
        runs.push({
          matchId: match.id,
          roundId: match.roundId,
          refreshed: false,
          finalized: false,
          error: msg,
        })
        continue
      }

      try {
        const fresh = await this.matchRepository.findByIdOrFail(match.id)
        if (fresh.status === MatchStatus.FINISHED && match.round.status === RoundStatus.CLOSED) {
          if (!this.notifier.isReady()) {
            logger.warn(
              { matchId: match.id, roundId: match.roundId },
              'SyncScoresJob: WhatsApp offline — skipping finalize'
            )
          } else {
            const preview = await this.roundFinalizerService.previewFinalize(match.roundId)
            await this.notifier.notifyMatchFinished({
              roundNumber: match.round.number,
              homeTeam: fresh.homeTeam,
              awayTeam: fresh.awayTeam,
              finalHome: fresh.homeScore!,
              finalAway: fresh.awayScore!,
              roundScores: preview.roundScores,
              seasonRanking: preview.seasonRanking,
              pointsMultiplier: preview.pointsMultiplier,
            })
            await this.roundFinalizerService.finalize(match.roundId)
            finalized = true
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        logger.error({ matchId: match.id, err: msg }, 'SyncScoresJob: falha em finalize')
        error = msg
      }

      runs.push({ matchId: match.id, roundId: match.roundId, refreshed, finalized, error })
    }

    logger.info({ runs }, 'SyncScoresJob: finished')
    return { runs }
  }
}
