import cron from 'node-cron'
import app from '@adonisjs/core/services/app'
import logger from '@adonisjs/core/services/logger'
import OpenRoundJob from '#jobs/open_round_job'
import CloseRoundJob from '#jobs/close_round_job'
import SyncScoresJob from '#jobs/sync_scores_job'
import MatchReminderJob from '#jobs/match_reminder_job'

/**
 * Registra os cron jobs ao subir a aplicação.
 * Importado como preload via adonisrc.ts com environment=['web'],
 * pra não rodar em testes nem no REPL.
 */

const TZ = 'America/Sao_Paulo'

// OpenRoundJob: a cada 30 min
cron.schedule(
  '*/30 * * * *',
  async () => {
    try {
      const job = await app.container.make(OpenRoundJob)
      await job.run()
    } catch (err) {
      logger.error({ err }, 'scheduler: OpenRoundJob crashed')
    }
  },
  { timezone: TZ }
)

// CloseRoundJob: a cada 5 min
cron.schedule(
  '*/5 * * * *',
  async () => {
    try {
      const job = await app.container.make(CloseRoundJob)
      await job.run()
    } catch (err) {
      logger.error({ err }, 'scheduler: CloseRoundJob crashed')
    }
  },
  { timezone: TZ }
)

// SyncScoresJob: a cada 10 min
cron.schedule(
  '*/10 * * * *',
  async () => {
    try {
      const job = await app.container.make(SyncScoresJob)
      await job.run()
    } catch (err) {
      logger.error({ err }, 'scheduler: SyncScoresJob crashed')
    }
  },
  { timezone: TZ }
)

// MatchReminderJob: a cada 5 min
cron.schedule(
  '*/5 * * * *',
  async () => {
    try {
      const job = await app.container.make(MatchReminderJob)
      await job.run()
    } catch (err) {
      logger.error({ err }, 'scheduler: MatchReminderJob crashed')
    }
  },
  { timezone: TZ }
)

logger.info('scheduler: cron jobs registered')
