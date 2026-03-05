import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server } from 'socket.io';
import { RealtimeService } from './realtime.service';
import { getUserIdFromSocketToken } from './socket-token.service';

@WebSocketGateway({
  cors: { origin: process.env.FRONTEND_URL ?? '*' },
  path: '/socket.io',
})
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection {
  @WebSocketServer()
  server!: Server;

  constructor(private realtime: RealtimeService) {}

  afterInit(server: Server) {
    this.realtime.setServer(server);
  }

  handleConnection(client: import('socket.io').Socket) {
    const token = client.handshake.auth?.token ?? client.handshake.query?.token;
    const userId = typeof token === 'string' ? getUserIdFromSocketToken(token) : null;
    if (!userId) {
      client.disconnect();
      return;
    }
    client.join(`agent:${userId}`);
    client.on('join_conversation', (conversationId: string) => {
      if (conversationId) client.join(`conversation:${conversationId}`);
    });
    client.on('leave_conversation', (conversationId: string) => {
      if (conversationId) client.leave(`conversation:${conversationId}`);
    });
  }
}
