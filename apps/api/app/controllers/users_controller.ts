import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import UserRepository from '#repositories/user_repository'
import { createUserValidator, updateUserValidator } from '#validators/user_validator'

@inject()
export default class UsersController {
  constructor(private userRepository: UserRepository) {}

  async store({ request, response }: HttpContext) {
    const payload = await request.validateUsing(createUserValidator)

    if (await this.userRepository.existsByWhatsappNumber(payload.whatsappNumber)) {
      return response.unprocessableEntity({
        error: 'whatsappNumber already exists',
        field: 'whatsappNumber',
      })
    }

    const user = await this.userRepository.create(payload)
    return response.created(user)
  }

  async index({ response }: HttpContext) {
    const users = await this.userRepository.list()
    return response.ok(users)
  }

  async update({ params, request, response }: HttpContext) {
    const user = await this.userRepository.findByIdOrFail(params.id)
    const payload = await request.validateUsing(updateUserValidator)
    await this.userRepository.update(user, payload)
    return response.ok(user)
  }
}
