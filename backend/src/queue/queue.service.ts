import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';

const QUEUE_NAME = 'line-webhook';
const connection = new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379', { maxRetriesPerRequest: null });

@Injectable()
export class QueueService implements OnModuleDestroy, OnModuleInit {
  private queue: Queue;

  constructor() {
    this.queue = new Queue(QUEUE_NAME, {
      connection,
      defaultJobOptions: { removeOnComplete: 100 },
    });
  }

  async onModuleInit() {
    await this.queue.add('retention', {}, { repeat: { pattern: '0 0 * * *' }, jobId: 'retention-daily' });
  }

  async addLineWebhookJob(payload: { oaId: string; providerEventId: string }) {
    await this.queue.add('process', payload, { jobId: `${payload.oaId}:${payload.providerEventId}` });
  }

  async onModuleDestroy() {
    await this.queue.close();
    connection.disconnect();
  }
}
