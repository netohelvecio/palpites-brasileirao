import vine from '@vinejs/vine'

export const createUserValidator = vine.create({
  name: vine.string().minLength(1).maxLength(120),
  whatsappNumber: vine.string().regex(/^\d{10,15}$/),
  emoji: vine.string().minLength(1).maxLength(10),
  isAdmin: vine.boolean().optional(),
})

export const updateUserValidator = vine.create({
  name: vine.string().minLength(1).maxLength(120).optional(),
  emoji: vine.string().minLength(1).maxLength(10).optional(),
  isAdmin: vine.boolean().optional(),
})
