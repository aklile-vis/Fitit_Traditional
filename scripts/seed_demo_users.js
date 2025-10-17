const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function upsertDemoUser(email, role) {
  const hashed = await bcrypt.hash('password', 12)
  await prisma.user.upsert({
    where: { email },
    update: {
      password: hashed,
      role,
    },
    create: {
      email,
      password: hashed,
      role,
      name: email.split('@')[0],
    },
  })
}

async function main() {
  await upsertDemoUser('agent@example.com', 'AGENT')
  await upsertDemoUser('user@example.com', 'USER')
  console.log('Seeded demo users: agent@example.com / password, user@example.com / password')
}

main()
  .catch((err) => {
    console.error('Failed to seed demo users', err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
