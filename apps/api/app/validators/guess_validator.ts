import vine from '@vinejs/vine'

export const createGuessValidator = vine.create({
  userId: vine.string().uuid(),
  matchId: vine.string().uuid(),
  homeScore: vine.number().min(0).max(20),
  awayScore: vine.number().min(0).max(20),
})

export const updateGuessValidator = vine.create({
  homeScore: vine.number().min(0).max(20).optional(),
  awayScore: vine.number().min(0).max(20).optional(),
})
