import { inject } from '@adonisjs/core'
import logger from '@adonisjs/core/services/logger'
import { RoundStatus } from '@palpites/shared'
import FixturesSyncService, { type SyncReport } from '#services/fixtures_sync_service'
import RoundRepository from '#repositories/round_repository'
import SeasonRepository from '#repositories/season_repository'
import MatchRepository from '#repositories/match_repository'
import UserRepository from '#repositories/user_repository'
import WhatsAppNotifier from '#services/whatsapp_notifier'

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
    private matchRepository: MatchRepository,
    private fixturesSyncService: FixturesSyncService,
    private notifier: WhatsAppNotifier,
    private userRepository: UserRepository
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
        if (round && round.status === RoundStatus.PENDING && syncReport.match) {
          if (!this.notifier.isReady()) {
            logger.warn(
              { seasonId: season.id, roundId: round.id },
              'OpenRoundJob: WhatsApp offline — skipping flip pending→open'
            )
          } else {
            const match = await this.matchRepository.findByRoundId(round.id)
            if (!match) {
              throw new Error('round.match esperado após sync, mas não encontrado')
            }
            await this.notifier.notifyRoundOpened({
              roundNumber: round.number,
              homeTeam: match.homeTeam,
              awayTeam: match.awayTeam,
              kickoffAt: match.kickoffAt,
            })
            await this.roundRepository.update(round, { status: RoundStatus.OPEN })
            roundOpened = true

            const users = await this.userRepository.list()
            for (const user of users) {
              try {
                await this.notifier.notifyRoundOpenedToUser({
                  user: {
                    whatsappNumber: user.whatsappNumber,
                    name: user.name,
                    emoji: user.emoji,
                  },
                  roundNumber: round.number,
                  homeTeam: match.homeTeam,
                  awayTeam: match.awayTeam,
                  kickoffAt: match.kickoffAt,
                })
              } catch (err) {
                logger.warn(
                  {
                    userId: user.id,
                    err: err instanceof Error ? err.message : String(err),
                  },
                  'OpenRoundJob: falha ao mandar DM pra user'
                )
              }
              await new Promise((r) => setTimeout(r, 1000))
            }
          }
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
