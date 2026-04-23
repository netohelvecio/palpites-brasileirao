/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
*/

import router from '@adonisjs/core/services/router'
import { middleware } from './kernel.js'

const UsersController = () => import('#controllers/users_controller')
const SeasonsController = () => import('#controllers/seasons_controller')

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
  })
  .prefix('/api/v1')
  .use(middleware.adminAuth())
