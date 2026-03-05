import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoService } from '../crypto/crypto.service';
import { QueueService } from '../queue/queue.service';
import { createHmac } from 'crypto';

@Injectable()
export class WebhookService {
  constructor(
    private prisma: PrismaService,
    private crypto: CryptoService,
    private queue: QueueService,
  ) {}

  verifyLineSignature(body: string, signature: string, channelSecret: string): boolean {
    if (!signature?.startsWith('sha256=')) return false;
    const expected = 'sha256=' + createHmac('sha256', channelSecret).update(body).digest('base64');
    return signature === expected;
  }

  async getOaChannelSecret(oaId: string): Promise<string | null> {
    const oa = await this.prisma.oaAccount.findUnique({
      where: { id: oaId, isActive: true },
      select: { channelSecretEncrypted: true },
    });
    if (!oa) return null;
    return this.crypto.decrypt(oa.channelSecretEncrypted);
  }

  async storeAndEnqueue(oaId: string, body: unknown): Promise<void> {
    const raw = body as { events?: unknown[] };
    const events = Array.isArray(raw?.events) ? raw.events : [];
    const { createHash } = await import('crypto');
    for (const ev of events) {
      const providerEventId = createHash('sha256').update(JSON.stringify(ev)).digest('hex');
      await this.prisma.providerEvent.upsert({
        where: {
          oaId_providerEventId: { oaId, providerEventId: String(providerEventId) },
        },
        create: {
          oaId,
          provider: 'line',
          providerEventId: String(providerEventId),
          rawJson: ev as object,
          status: 'pending',
        },
        update: {},
      });
      await this.queue.addLineWebhookJob({ oaId, providerEventId: String(providerEventId) });
    }
  }
}
