import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { CryptoModule } from './crypto/crypto.module';
import { AuthModule } from './auth/auth.module';
import { WebhookModule } from './webhook/webhook.module';
import { InboxModule } from './inbox/inbox.module';
import { ConversationModule } from './conversation/conversation.module';
import { RealtimeModule } from './realtime/realtime.module';
import { QueueModule } from './queue/queue.module';
import { AgentsModule } from './agents/agents.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    CryptoModule,
    AuthModule,
    QueueModule,
    WebhookModule,
    InboxModule,
    ConversationModule,
    RealtimeModule,
    AgentsModule,
  ],
})
export class AppModule {}
