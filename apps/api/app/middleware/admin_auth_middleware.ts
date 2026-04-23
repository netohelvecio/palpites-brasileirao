import env from '#start/env'
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

export default class AdminAuthMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    const header = ctx.request.header('authorization')
    if (!header || !header.startsWith('Bearer ')) {
      return ctx.response.unauthorized({ error: 'missing bearer token' })
    }
    const token = header.slice(7).trim()
    if (token !== env.get('ADMIN_API_TOKEN')) {
      return ctx.response.unauthorized({ error: 'invalid token' })
    }
    return next()
  }
}
