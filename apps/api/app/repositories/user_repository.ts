import { inject } from '@adonisjs/core'
import User from '#models/user'
import BaseRepository from '#repositories/base_repository'

@inject()
export default class UserRepository extends BaseRepository<typeof User> {
  protected model = User

  list() {
    return User.query().orderBy('created_at', 'asc')
  }

  findByWhatsappNumber(whatsappNumber: string) {
    return User.query().where('whatsapp_number', whatsappNumber).first()
  }

  async existsByWhatsappNumber(whatsappNumber: string): Promise<boolean> {
    const row = await User.query().where('whatsapp_number', whatsappNumber).first()
    return row !== null
  }
}
