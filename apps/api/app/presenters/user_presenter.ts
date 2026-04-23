import type { UserSummary } from '@palpites/shared'
import type User from '#models/user'

export function presentUserSummary(user: User): UserSummary {
  return { id: user.id, name: user.name, emoji: user.emoji }
}
