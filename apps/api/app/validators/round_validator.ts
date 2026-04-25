import vine from '@vinejs/vine'
import { RoundStatus } from '@palpites/shared'

export const updateRoundStatusValidator = vine.create({
  status: vine.enum(Object.values(RoundStatus)),
})
