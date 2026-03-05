import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import IORedis from 'ioredis';
import { RealtimeService } from './realtime.service';

const CHANNEL = 'realtime:message';

@Injectable()
export class RealtimeSubscriber implements OnModuleInit, OnModuleDestroy {
  private sub: IORedis | null = null;

  constructor(private realtime: RealtimeService) {}

  async onModuleInit() {
    this.sub = new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379', { maxRetriesPerRequest: null });
    this.sub.subscribe(CHANNEL);
    this.sub.on('message', (ch, message) => {
      if (ch !== CHANNEL) return;
      try {
        const { conversationId, assignedAgentId, payload } = JSON.parse(message);
        this.realtime.broadcastNewMessage(conversationId, assignedAgentId ?? null, payload);
      } catch {
        // ignore
      }
    });
  }

  async onModuleDestroy() {
    if (this.sub) {
      this.sub.disconnect();
      this.sub = null;
    }
  }
}
