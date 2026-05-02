import { inject } from '@adonisjs/core'
import { DateTime } from 'luxon'
import logger from '@adonisjs/core/services/logger'
import RoundRepository from '#repositories/round_repository'
import MatchRepository from '#repositories/match_repository'
import WhatsAppNotifier from '#services/whatsapp_notifier'

export interface MatchReminderReport {
  sentCount: number
  sentRoundIds: string[]
  errorCount: number
}

@inject()
export default class MatchReminderJob {
  constructor(
    private roundRepository: RoundRepository,
    private matchRepository: MatchRepository,
    private notifier: WhatsAppNotifier
  ) {}

  async run(now: DateTime = DateTime.now()): Promise<MatchReminderReport> {
    const rounds = await this.roundRepository.listOpenWithKickoffWithin(now, 30)
    const sentRoundIds: string[] = []
    let errorCount = 0

    for (const round of rounds) {
      if (!this.notifier.isReady()) {
        logger.warn({ roundId: round.id }, 'MatchReminderJob: WhatsApp offline — skipping')
        continue
      }

      try {
        await this.notifier.notifyMatchReminder({
          homeTeam: round.match.homeTeam,
          awayTeam: round.match.awayTeam,
          kickoffAt: round.match.kickoffAt,
          pointsMultiplier: round.match.pointsMultiplier,
        })
        await this.matchRepository.update(round.match, {
          reminder30MinSentAt: DateTime.now(),
        })
        sentRoundIds.push(round.id)
      } catch (err) {
        errorCount++
        const msg = err instanceof Error ? err.message : String(err)
        logger.error({ roundId: round.id, err: msg }, 'MatchReminderJob: falha em round')
      }
    }

    const report = { sentCount: sentRoundIds.length, sentRoundIds, errorCount }
    logger.info(report, 'MatchReminderJob: finished')
    return report
  }
}
