import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const DEFAULT_NAME = 'ARLOTT';
const DEFAULT_PASSWORD = 'arlottokace';

async function main() {
  const name = process.env.SEED_ADMIN_NAME ?? DEFAULT_NAME;
  const password = process.env.SEED_ADMIN_PASSWORD ?? DEFAULT_PASSWORD;
  const hash = await bcrypt.hash(password, 10);

  const existing = await prisma.agent.findFirst({ where: { role: 'admin' } });
  if (existing) {
    await prisma.agent.update({
      where: { id: existing.id },
      data: { name, passwordHash: hash },
    });
    console.log('Seeded: updated existing admin password.');
    return;
  }

  await prisma.agent.create({
    data: {
      name,
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
