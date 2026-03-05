/**
 * API client: all requests go to same-origin /api/* (Next.js proxy to backend).
 * No cross-domain; cookies are first-party. credentials: 'include' sends session cookie.
 */

export async function api<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(init?.headers as Record<string, string>) };
  const res = await fetch(path, {
    ...init,
    credentials: 'include',
    headers,
  });
  if (res.status === 401) throw new Error('Unauthorized');
  if (!res.ok) {
    const body = await res.text().catch(() => res.statusText);
    const isHtml = body.trimStart().startsWith('<');
    throw new Error(isHtml ? `Request failed (${res.status})` : body || `Request failed (${res.status})`);
  }
  if (res.status === 204 || res.headers.get('content-length') === '0')
    return undefined as T;
  return res.json();
}

export type User = { id: string; name: string; role: string };

export async function me(): Promise<User | null> {
  try {
    return await api<User>('/api/auth/me');
  } catch {
    return null;
  }
}

export async function login(name: string, password: string) {
  return api<{ ok: boolean; user: User }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ name, password }),
  });
}

export async function logout() {
  await api('/api/auth/logout', { method: 'POST' });
}

export async function getSocketToken(): Promise<string> {
  const r = await api<{ token: string }>('/api/auth/socket-token');
  return r.token;
}

export async function getInbox() {
  return api<InboxThread[]>('/api/inbox');
}

export async function getConversation(id: string) {
  return api<ConversationDetail>(`/api/conversations/${id}`);
}

export async function replyConversation(id: string, text: string) {
  return api<{ ok: boolean }>(`/api/conversations/${id}/reply`, {
    method: 'POST',
    body: JSON.stringify({ text }),
  });
}

export async function assignConversation(id: string, assignedAgentId: string) {
  return api<{ ok: boolean }>(`/api/conversations/${id}/assign`, {
    method: 'POST',
    body: JSON.stringify({ assignedAgentId }),
  });
}

export async function closeConversation(id: string) {
  return api<{ ok: boolean }>(`/api/conversations/${id}/close`, {
    method: 'POST',
  });
}

export async function getAgents(): Promise<{ id: string; name: string; role: string }[]> {
  return api('/api/agents');
}

export interface InboxThread {
  conversationId: string;
  oaId: string;
  assignedAgentId: string | null;
  status: string;
  lastMessageAt: string;
  lastMessagePreview: string | null;
  lastMessageDirection: string | null;
  conversation: {
    id: string;
    contact: { displayName: string | null; pictureUrl: string | null };
  };
  assignedAgent: { id: string; name: string } | null;
}

export interface ConversationDetail {
  thread: InboxThread;
  messages: {
    id: string;
    direction: string;
    text: string | null;
    sentAt: string;
  }[];
}
