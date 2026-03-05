import { PrismaClient } from '@prisma/client';
import { publishNewMessage } from '../common/redis-publish';

const prisma = new PrismaClient();

interface LineWebhookEvent {
  type: string;
  timestamp?: number;
  source?: { type?: string; userId?: string };
  message?: { type?: string; id?: string; text?: string };
}

export async function processLineEvent(oaId: string, providerEventId: string) {
  const ev = await prisma.providerEvent.findUnique({
    where: { oaId_providerEventId: { oaId, providerEventId } },
  });
  if (!ev || ev.status === 'processed') return;
  const raw = ev.rawJson as unknown as LineWebhookEvent;
  if (raw.type !== 'message' || raw.message?.type !== 'text') {
    await prisma.providerEvent.update({
      where: { id: ev.id },
      data: { status: 'processed', processedAt: new Date() },
    });
    return;
  }
  const userId = raw.source?.userId;
  if (!userId) return;
  const providerChatId = userId;
  const text = raw.message?.text ?? '';
  const messageId = raw.message?.id;
  const sentAt = raw.timestamp ? new Date(raw.timestamp) : new Date();

  let contactIdentity = await prisma.contactIdentity.findUnique({
    where: { oaId_providerUserId: { oaId, providerUserId: userId } },
    include: { contact: true },
  });
  if (!contactIdentity) {
    const contact = await prisma.contact.create({
      data: { displayName: null, pictureUrl: null },
    });
    contactIdentity = await prisma.contactIdentity.create({
      data: {
        contactId: contact.id,
        provider: 'line',
        providerUserId: userId,
        oaId,
        lastSeenAt: sentAt,
      },
      include: { contact: true },
    });
  } else {
    await prisma.contactIdentity.update({
      where: { id: contactIdentity.id },
      data: { lastSeenAt: sentAt },
    });
  }

  const contactId = contactIdentity.contactId;
  let conversation = await prisma.conversation.findFirst({
    where: { oaId, contactId, providerChatId },
  });
  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: {
        oaId,
        contactId,
        provider: 'line',
        providerChatId,
        status: 'open',
      },
    });
    await prisma.inboxThread.create({
      data: {
        conversationId: conversation.id,
        oaId,
        status: 'open',
        lastMessageAt: sentAt,
        lastMessagePreview: text.slice(0, 200),
        lastMessageDirection: 'inbound',
      },
    });
  }

  await prisma.message.create({
    data: {
      oaId,
      conversationId: conversation.id,
      direction: 'inbound',
      providerEventId,
      providerMessageId: messageId ?? null,
      messageType: 'text',
      text,
      rawJson: raw as unknown as object,
      sentAt,
    },
  });

  const thread = await prisma.inboxThread.upsert({
    where: { conversationId: conversation.id },
    create: {
      conversationId: conversation.id,
      oaId,
      status: 'open',
      lastMessageAt: sentAt,
      lastMessagePreview: text.slice(0, 200),
      lastMessageDirection: 'inbound',
    },
    update: {
      lastMessageAt: sentAt,
      lastMessagePreview: text.slice(0, 200),
      lastMessageDirection: 'inbound',
    },
  });

  await prisma.providerEvent.update({
    where: { id: ev.id },
    data: { status: 'processed', processedAt: new Date() },
  });

  publishNewMessage(conversation.id, thread.assignedAgentId, {
    conversationId: conversation.id,
    direction: 'inbound',
    text,
    sentAt: sentAt.toISOString(),
  });
}
