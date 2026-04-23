import factory from '@adonisjs/lucid/factories'
import User from '#models/user'

export const UserFactory = factory
  .define(User, async ({ faker }) => {
    return {
      name: faker.person.fullName(),
      whatsappNumber: `55${faker.string.numeric({ length: 9 })}`,
      emoji: faker.helpers.arrayElement(['⚽', '🐍', '🐯', '🦁', '🐢', '🦅']),
      isAdmin: false,
    }
  })
  .build()
