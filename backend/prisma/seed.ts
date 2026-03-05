import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.agent.findFirst({ where: { role: 'admin' } });
  if (existing) return;
  const hash = await bcrypt.hash(process.env.SEED_ADMIN_PASSWORD ?? 'admin123', 10);
  await prisma.agent.create({
    data: {
      name: process.env.SEED_ADMIN_NAME ?? 'ARLOTT',
      role: 'admin',
      passwordHash: hash,
    },
  });
  console.log('Seeded default admin agent.');
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
