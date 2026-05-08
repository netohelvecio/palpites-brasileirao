import vine from '@vinejs/vine'

export const pickCandidateValidator = vine.create({
  candidateId: vine.string().uuid(),
})
