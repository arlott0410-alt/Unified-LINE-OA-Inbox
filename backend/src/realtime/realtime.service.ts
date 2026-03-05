import { Injectable } from '@nestjs/common';

@Injectable()
export class RealtimeService {
  private server: import('socket.io').Server | null = null;

  setServer(server: import('socket.io').Server) {
    this.server = server;
  }

  broadcastNewMessage(conversationId: string, assignedAgentId: string | null, payload: unknown) {
    if (!this.server) return;
    this.server.to(`conversation:${conversationId}`).emit('message', payload);
    if (assignedAgentId) {
      this.server.to(`agent:${assignedAgentId}`).emit('message', payload);
    }
  }

  broadcastThreadUpdate(conversationId: string, assignedAgentId: string | null, payload: unknown) {
    if (!this.server) return;
    this.server.to(`conversation:${conversationId}`).emit('thread', payload);
    if (assignedAgentId) {
      this.server.to(`agent:${assignedAgentId}`).emit('thread', payload);
    }
  }
}
