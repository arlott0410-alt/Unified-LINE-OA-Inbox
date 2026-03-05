const BUILD_TIME_API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';
let runtimeApiUrl: string | null = null;

async function getApiBaseUrl(): Promise<string> {
  if (BUILD_TIME_API_URL) return BUILD_TIME_API_URL;
  if (runtimeApiUrl !== null) return runtimeApiUrl;
  const res = await fetch('/api/config', { cache: 'no-store' });
  const data = (await res.json()) as { apiUrl?: string };
  runtimeApiUrl = data.apiUrl ?? '';
  return runtimeApiUrl;
}

export async function api<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const base = await getApiBaseUrl();
  const res = await fetch(`${base}${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  if (res.status === 401) throw new Error('Unauthorized');
  if (!res.ok) throw new Error(await res.text().catch(() => res.statusText));
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
