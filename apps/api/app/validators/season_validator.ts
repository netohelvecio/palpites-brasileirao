import vine from '@vinejs/vine'

export const createSeasonValidator = vine.create({
  year: vine.number().min(2000).max(2100),
  name: vine.string().minLength(1).maxLength(120),
  externalCompetitionCode: vine.string().minLength(2).maxLength(10),
  isActive: vine.boolean(),
  startsAt: vine.date({ formats: ['iso8601'] }),
  endsAt: vine.date({ formats: ['iso8601'] }),
})

export const updateSeasonValidator = vine.create({
  name: vine.string().minLength(1).maxLength(120).optional(),
  isActive: vine.boolean().optional(),
  startsAt: vine.date({ formats: ['iso8601'] }).optional(),
  endsAt: vine.date({ formats: ['iso8601'] }).optional(),
})
