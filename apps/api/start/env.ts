/*
|--------------------------------------------------------------------------
| Environment variables service
|--------------------------------------------------------------------------
*/

import { Env } from '@adonisjs/core/env'

export default await Env.create(new URL('../', import.meta.url), {
  // Node
  NODE_ENV: Env.schema.enum(['development', 'production', 'test'] as const),
  PORT: Env.schema.number(),
  HOST: Env.schema.string({ format: 'host' }),
  LOG_LEVEL: Env.schema.string(),

  // App
  APP_KEY: Env.schema.secret(),
  APP_URL: Env.schema.string({ format: 'url', tld: false }),

  // Database
  DB_HOST: Env.schema.string({ format: 'host' }),
  DB_PORT: Env.schema.number(),
  DB_USER: Env.schema.string(),
  DB_PASSWORD: Env.schema.string.optional(),
  DB_DATABASE: Env.schema.string(),

  // Admin auth
  ADMIN_API_TOKEN: Env.schema.string(),

  // Football-Data.org
  FOOTBALL_DATA_BASE_URL: Env.schema.string({ format: 'url', tld: false }),
  FOOTBALL_DATA_TOKEN: Env.schema.string.optional(),

  // WhatsApp (Baileys)
  WHATSAPP_MODE: Env.schema.enum(['real', 'stub', 'disabled'] as const),
  WHATSAPP_GROUP_JID: Env.schema.string.optional(),
  WHATSAPP_AUTH_PATH: Env.schema.string(),
})
