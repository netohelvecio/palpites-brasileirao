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

router.get('/', () => {
  return { hello: 'world' }
})

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

    router.get('/rounds/:roundId/match', [MatchesController, 'show'])
    router.put('/rounds/:roundId/match', [MatchesController, 'upsert'])
    router.post('/rounds/:roundId/match/refresh-score', [MatchesController, 'refreshScore'])
  })
  .prefix('/api/v1')
  .use(middleware.adminAuth())
