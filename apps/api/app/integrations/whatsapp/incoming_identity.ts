export interface RawMessageKey {
  remoteJid: string
  senderPn?: string | null
}

export interface ResolvedIdentity {
  fromNumber: string | null
  fromJid: string
}

export function resolveIncomingIdentity(key: RawMessageKey): ResolvedIdentity {
  const fromJid = key.remoteJid

  if (fromJid.endsWith('@s.whatsapp.net')) {
    return { fromNumber: fromJid.replace(/@s\.whatsapp\.net$/, ''), fromJid }
  }

  const senderPn = typeof key.senderPn === 'string' ? key.senderPn : null

  return {
    fromNumber: senderPn ? senderPn.replace(/@s\.whatsapp\.net$/, '') : null,
    fromJid,
  }
}
