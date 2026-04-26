import env from '#start/env'
import type WhatsAppClient from './whatsapp_client.js'

/**
 * Helper para ace commands que precisam do WhatsApp conectado.
 *
 * O preload `start/whatsapp.ts` só dispara em `environment: ['web']`, então
 * em ace commands (environment `console`) o BaileysClient é registrado mas
 * nunca conecta. Esse helper faz connect → run fn → disconnect quando
 * WHATSAPP_MODE=real; nos demais modos é transparente (apenas executa fn).
 *
 * **Importante**: não rode comandos que usam esse helper enquanto o
 * `pnpm dev` estiver de pé. O Baileys multi-file auth state não suporta
 * duas conexões simultâneas para a mesma sessão pareada.
 */
export async function withWhatsAppConnection<T>(
  client: WhatsAppClient,
  fn: () => Promise<T>
): Promise<T> {
  const isReal = env.get('WHATSAPP_MODE') === 'real'

  if (!isReal) {
    return fn()
  }

  await client.connect()

  const start = Date.now()
  while (!client.isConnected()) {
    if (Date.now() - start > 30_000) {
      await client.disconnect().catch(() => {})
      throw new Error('timeout esperando conexão Baileys (30s)')
    }
    await new Promise((r) => setTimeout(r, 500))
  }

  try {
    return await fn()
  } finally {
    await client.disconnect().catch(() => {})
  }
}
