import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoService } from '../crypto/crypto.service';
import { AuthService } from '../auth/auth.service';
import { RealtimeService } from '../realtime/realtime.service';

@Injectable()
export class ConversationService {
  constructor(
    private prisma: PrismaService,
    private crypto: CryptoService,
    private auth: AuthService,
    private realtime: RealtimeService,
  ) {}

  async getOne(conversationId: string, agentId: string, isAdmin: boolean) {
    const thread = await this.prisma.inboxThread.findUnique({
      where: { conversationId },
      include: {
        conversation: { include: { contact: true, oaAccount: { select: { id: true, name: true } } } },
        assignedAgent: { select: { id: true, name: true } },
      },
    });
    if (!thread) throw new NotFoundException('Conversation not found');
    if (!isAdmin && thread.assignedAgentId !== agentId) throw new ForbiddenException();
    const messages = await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { sentAt: 'asc' },
    });
    return { thread, messages };
  }

  async reply(conversationId: string, agentId: string, isAdmin: boolean, text: string) {
    const thread = await this.prisma.inboxThread.findUnique({
      where: { conversationId },
      include: { conversation: true },
    });
    if (!thread) throw new NotFoundException('Conversation not found');
    if (!isAdmin && thread.assignedAgentId !== agentId) throw new ForbiddenException();
    const oa = await this.prisma.oaAccount.findUnique({
      where: { id: thread.oaId },
    });
    if (!oa?.isActive) throw new NotFoundException('OA not found');
    const token = this.crypto.decrypt(oa.channelAccessTokenEncrypted);
    const contactIdentity = await this.prisma.contactIdentity.findFirst({
      where: { contactId: thread.conversation.contactId, oaId: thread.oaId },
    });
    if (!contactIdentity) throw new NotFoundException('Contact identity not found');
    const userId = contactIdentity.providerUserId;
    const res = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        to: userId,
        messages: [{ type: 'text', text }],
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`LINE API error: ${res.status} ${err}`);
    }
    const data = await res.json();
    const sentAt = new Date();
    const messageId = data.sentMessages?.[0]?.id ?? `local-${Date.now()}`;
    await this.prisma.message.create({
      data: {
        oaId: thread.oaId,
        conversationId,
        direction: 'outbound',
        providerMessageId: messageId,
        messageType: 'text',
        text,
        rawJson: data,
        sentAt,
      },
    });
    await this.prisma.inboxThread.update({
      where: { conversationId },
      data: {
        lastMessageAt: sentAt,
        lastMessagePreview: text.slice(0, 200),
        lastMessageDirection: 'outbound',
      },
    });
    this.realtime.broadcastNewMessage(conversationId, thread.assignedAgentId, {
      conversationId,
      direction: 'outbound',
      text,
      sentAt: sentAt.toISOString(),
    });
    return { ok: true };
  }

  async assign(conversationId: string, assignedAgentId: string, assignedByAgentId: string) {
    const conv = await this.prisma.conversation.findUnique({ where: { id: conversationId } });
    if (!conv) throw new NotFoundException('Conversation not found');
    await this.prisma.$transaction([
      this.prisma.conversationAssignment.updateMany({
        where: { conversationId, unassignedAt: null },
        data: { unassignedAt: new Date() },
      }),
      this.prisma.conversationAssignment.create({
        data: {
          conversationId,
          assignedAgentId,
          assignedByAgentId,
        },
      }),
      this.prisma.inboxThread.update({
        where: { conversationId },
        data: { assignedAgentId },
      }),
    ]);
    return { ok: true };
  }

  async close(conversationId: string, agentId: string, isAdmin: boolean) {
    const thread = await this.prisma.inboxThread.findUnique({ where: { conversationId } });
    if (!thread) throw new NotFoundException('Conversation not found');
    if (!isAdmin && thread.assignedAgentId !== agentId) throw new ForbiddenException();
    await this.prisma.$transaction([
      this.prisma.conversation.update({
        where: { id: conversationId },
        data: { status: 'closed' },
      }),
      this.prisma.inboxThread.update({
        where: { conversationId },
        data: { status: 'closed' },
      }),
    ]);
    return { ok: true };
  }
}
