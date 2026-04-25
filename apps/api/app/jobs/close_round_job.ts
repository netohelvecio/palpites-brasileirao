import { inject } from '@adonisjs/core'
import { DateTime } from 'luxon'
import logger from '@adonisjs/core/services/logger'
import { RoundStatus } from '@palpites/shared'
import RoundRepository from '#repositories/round_repository'
import GuessRepository from '#repositories/guess_repository'
import WhatsAppNotifier from '#services/whatsapp_notifier'

export interface CloseRoundReport {
  closedCount: number
  closedRoundIds: string[]
  errorCount: number
}

@inject()
export default class CloseRoundJob {
  constructor(
    private roundRepository: RoundRepository,
    private guessRepository: GuessRepository,
    private notifier: WhatsAppNotifier
  ) {}

  async run(now: DateTime = DateTime.now()): Promise<CloseRoundReport> {
    const rounds = await this.roundRepository.listOpenPastKickoff(now)
    const closedRoundIds: string[] = []
    let errorCount = 0

    for (const round of rounds) {
      if (!this.notifier.isReady()) {
        logger.warn({ roundId: round.id }, 'CloseRoundJob: WhatsApp offline — skipping')
        continue
      }

      try {
        const guesses = await this.guessRepository.listByRound(round.id)
        await this.notifier.notifyRoundClosed({
          roundNumber: round.number,
          homeTeam: round.match.homeTeam,
          awayTeam: round.match.awayTeam,
          guesses: guesses.map((g) => ({
            userName: g.user.name,
            userEmoji: g.user.emoji,
            homeScore: g.homeScore,
            awayScore: g.awayScore,
          })),
        })
        await this.roundRepository.update(round, { status: RoundStatus.CLOSED })
        closedRoundIds.push(round.id)
      } catch (err) {
        errorCount++
        const msg = err instanceof Error ? err.message : String(err)
        logger.error({ roundId: round.id, err: msg }, 'CloseRoundJob: falha em round')
      }
    }

    const report = { closedCount: closedRoundIds.length, closedRoundIds, errorCount }
    logger.info(report, 'CloseRoundJob: finished')
    return report
  }
}
