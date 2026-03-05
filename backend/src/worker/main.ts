import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { PrismaClient } from '@prisma/client';
import { processLineEvent } from './processor';

const QUEUE_NAME = 'line-webhook';
const connection = new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379', { maxRetriesPerRequest: null });
const prisma = new PrismaClient();

async function runRetention() {
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - 6);
  const result = await prisma.message.deleteMany({ where: { sentAt: { lt: cutoff } } });
  console.log('Retention: deleted', result.count, 'messages older than 6 months');
}

const worker = new Worker(
  QUEUE_NAME,
  async (job) => {
    if (job.name === 'retention') {
      await runRetention();
      return;
    }
    const { oaId, providerEventId } = job.data;
    await processLineEvent(oaId, providerEventId);
  },
  { connection: connection as any, concurrency: 5 },
);

worker.on('completed', () => {});
worker.on('failed', (_, err) => console.error('Job failed', err));

process.on('SIGTERM', async () => {
  await worker.close();
  connection.disconnect();
  process.exit(0);
});
