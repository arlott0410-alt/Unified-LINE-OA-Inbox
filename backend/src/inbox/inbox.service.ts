import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConversationStatus } from '@prisma/client';

@Injectable()
export class InboxService {
  constructor(private prisma: PrismaService) {}

  async getThreadsForAgent(agentId: string, isAdmin: boolean) {
    const order = { lastMessageAt: 'desc' as const };
    if (isAdmin) {
      return this.prisma.inboxThread.findMany({
        orderBy: order,
        include: {
          conversation: { include: { contact: true } },
          assignedAgent: { select: { id: true, name: true } },
        },
      });
    }
    return this.prisma.inboxThread.findMany({
      where: { assignedAgentId: agentId },
      orderBy: order,
      include: {
        conversation: { include: { contact: true } },
        assignedAgent: { select: { id: true, name: true } },
      },
    });
  }
}
