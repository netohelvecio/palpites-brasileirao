import cron from 'node-cron'
import app from '@adonisjs/core/services/app'
import logger from '@adonisjs/core/services/logger'
import OpenRoundJob from '#jobs/open_round_job'

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

logger.info('scheduler: cron jobs registered')
