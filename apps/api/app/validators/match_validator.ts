import vine from '@vinejs/vine'

export const upsertMatchValidator = vine.create({
  externalId: vine.number(),
  homeTeam: vine.string().minLength(1).maxLength(80),
  awayTeam: vine.string().minLength(1).maxLength(80),
  kickoffAt: vine.date({ formats: ['iso8601'] }),
})
