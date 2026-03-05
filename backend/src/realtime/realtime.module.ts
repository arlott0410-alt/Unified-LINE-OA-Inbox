import { Module } from '@nestjs/common';
import { RealtimeGateway } from './realtime.gateway';
import { RealtimeService } from './realtime.service';
import { SocketTokenService } from './socket-token.service';
import { RealtimeSubscriber } from './realtime-subscriber';

@Module({
  providers: [RealtimeGateway, RealtimeService, SocketTokenService, RealtimeSubscriber],
  exports: [RealtimeService, SocketTokenService],
})
export class RealtimeModule {}
