import vine from '@vinejs/vine'

export const updateRoundStatusValidator = vine.create({
  status: vine.enum(['pending', 'open', 'closed', 'finished'] as const),
})
