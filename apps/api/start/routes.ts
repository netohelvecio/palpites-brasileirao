/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
*/

import router from '@adonisjs/core/services/router'
import { middleware } from './kernel.js'

const UsersController = () => import('#controllers/users_controller')
const SeasonsController = () => import('#controllers/seasons_controller')
const RoundsController = () => import('#controllers/rounds_controller')
const MatchesController = () => import('#controllers/matches_controller')
const GuessesController = () => import('#controllers/guesses_controller')
const RankingController = () => import('#controllers/ranking_controller')
const HealthController = () => import('#controllers/health_controller')

router.get('/', () => {
  return { hello: 'world' }
})

router.get('/health', [HealthController, 'index'])
router.get('/whatsapp/status', [HealthController, 'whatsappStatus'])

router
  .group(() => {
    router.post('/users', [UsersController, 'store'])
    router.get('/users', [UsersController, 'index'])
    router.patch('/users/:id', [UsersController, 'update'])

    router.post('/seasons', [SeasonsController, 'store'])
    router.get('/seasons', [SeasonsController, 'index'])
    router.patch('/seasons/:id', [SeasonsController, 'update'])
    router.post('/seasons/:id/sync', [SeasonsController, 'sync'])

    router.get('/seasons/:seasonId/rounds', [RoundsController, 'indexBySeason'])
    router.get('/rounds/:id', [RoundsController, 'show'])
    router.patch('/rounds/:id/status', [RoundsController, 'updateStatus'])
    router.get('/rounds/:id/match-candidates', [RoundsController, 'listMatchCandidates'])
    router.post('/rounds/:id/pick-candidate', [RoundsController, 'pickCandidate'])

    router.get('/rounds/:roundId/match', [MatchesController, 'show'])
    router.put('/rounds/:roundId/match', [MatchesController, 'upsert'])
    router.post('/rounds/:roundId/match/refresh-score', [MatchesController, 'refreshScore'])

    router.post('/guesses', [GuessesController, 'store'])
    router.patch('/guesses/:id', [GuessesController, 'update'])
    router.delete('/guesses/:id', [GuessesController, 'destroy'])
    router.get('/rounds/:roundId/guesses', [GuessesController, 'indexByRound'])

    router.get('/seasons/:seasonId/ranking', [RankingController, 'bySeason'])
    router.get('/rounds/:roundId/ranking', [RankingController, 'byRound'])
  })
  .prefix('/api/v1')
  .use(middleware.adminAuth())
