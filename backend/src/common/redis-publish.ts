import IORedis from 'ioredis';

const CHANNEL = 'realtime:message';

export function publishNewMessage(conversationId: string, assignedAgentId: string | null, payload: unknown) {
  const redis = new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379', { maxRetriesPerRequest: null });
  redis.publish(CHANNEL, JSON.stringify({ conversationId, assignedAgentId, payload }));
  redis.quit();
}
