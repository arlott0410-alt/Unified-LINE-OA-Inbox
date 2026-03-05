import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { PrismaClient } from '@prisma/client';
import { processLineEvent } from './processor';

const QUEUE_NAME = 'line-webhook';
const redisUrl = process.env.REDIS_URL;
const databaseUrl = process.env.DATABASE_URL;
if (!redisUrl) {
  console.error('REDIS_URL is not set. Worker requires Redis.');
  process.exit(1);
}
if (!databaseUrl) {
  console.error('DATABASE_URL is not set. Worker requires PostgreSQL.');
  process.exit(1);
}
console.log('Worker: starting (REDIS_URL and DATABASE_URL are set)');
const connection = new IORedis(redisUrl, {
  maxRetriesPerRequest: null,
  retryStrategy(times) {
    const delay = Math.min(times * 500, 10000);
    console.log(`Worker: Redis reconnecting in ${delay}ms (attempt ${times})`);
    return delay;
  },
  enableReadyCheck: true,
});
connection.on('error', (err) => console.error('Redis connection error:', err.message));
connection.on('connect', () => console.log('Worker: Redis connected'));
connection.on('close', () => console.warn('Worker: Redis connection closed'));
connection.on('reconnecting', () => console.log('Worker: Redis reconnecting...'));

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
    try {
      if (job.name === 'retention') {
        await runRetention();
        return;
      }
      const { oaId, providerEventId } = job.data;
      await processLineEvent(oaId, providerEventId);
    } catch (err) {
      console.error('Job error:', err);
      throw err;
    }
  },
  { connection: connection as any, concurrency: 5 },
);

worker.on('completed', () => {});
worker.on('failed', (_, err) => console.error('Job failed', err));
worker.on('error', (err) => console.error('Worker error:', err));
worker.on('ready', () => console.log('Worker: listening for jobs on queue', QUEUE_NAME));

process.on('unhandledRejection', (reason, p) => {
  console.error('Unhandled Rejection at:', p, 'reason:', reason);
});
// Heartbeat so Logs show the process is still running (and keep handle alive)
const HEARTBEAT_MINUTES = 5;
setInterval(() => {
  console.log(`Worker: heartbeat (every ${HEARTBEAT_MINUTES} min)`);
}, HEARTBEAT_MINUTES * 60 * 1000);

process.on('SIGTERM', async () => {
  await worker.close();
  connection.disconnect();
  process.exit(0);
});
