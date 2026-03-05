'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import {
  me,
  getConversation,
  replyConversation,
  assignConversation,
  closeConversation,
  getAgents,
  getSocketToken,
  type User,
  type ConversationDetail,
} from '@/lib/api';
import { io, Socket } from 'socket.io-client';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

export default function ConversationPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [data, setData] = useState<ConversationDetail | null>(null);
  const [replyText, setReplyText] = useState('');
  const [agents, setAgents] = useState<{ id: string; name: string; role: string }[]>([]);
  const [assignAgentId, setAssignAgentId] = useState('');
  const [sending, setSending] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    me().then((u) => {
      if (!u) {
        router.push('/login');
        return;
      }
      setUser(u);
      getAgents().then(setAgents);
    });
  }, [router]);

  useEffect(() => {
    if (!user || !id) return;
    getConversation(id).then(setData).catch(() => setData(null));
  }, [user, id]);

  useEffect(() => {
    if (!user || !id) return;
    let mounted = true;
    getSocketToken().then((token) => {
      if (!mounted) return;
      const socket = io(API_URL || window.location.origin, {
        path: '/socket.io',
        auth: { token },
      });
      socketRef.current = socket;
      socket.emit('join_conversation', id);
      socket.on('message', () => {
        if (mounted) getConversation(id).then(setData);
      });
      return () => {
        socket.emit('leave_conversation', id);
        socket.close();
        socketRef.current = null;
      };
    });
    return () => {
      mounted = false;
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
    };
  }, [user, id]);

  async function handleReply(e: React.FormEvent) {
    e.preventDefault();
    if (!replyText.trim() || sending) return;
    setSending(true);
    try {
      await replyConversation(id, replyText.trim());
      setReplyText('');
      getConversation(id).then(setData);
    } finally {
      setSending(false);
    }
  }

  async function handleAssign() {
    if (!assignAgentId) return;
    try {
      await assignConversation(id, assignAgentId);
      getConversation(id).then(setData);
      setAssignAgentId('');
    } catch (err) {
      console.error(err);
    }
  }

  async function handleClose() {
    try {
      await closeConversation(id);
      router.push('/inbox');
    } catch (err) {
      console.error(err);
    }
  }

  if (!user) return null;

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <aside
        style={{
          width: '320px',
          borderRight: '1px solid #27272a',
          padding: '1rem',
          background: '#18181b',
        }}
      >
        <Link href="/inbox" style={{ display: 'inline-block', marginBottom: '1rem' }}>← Inbox</Link>
      </aside>
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {data && (
          <>
            <header
              style={{
                padding: '1rem 1.5rem',
                borderBottom: '1px solid #27272a',
                background: '#18181b',
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                flexWrap: 'wrap',
              }}
            >
              <div>
                <strong>{data.thread.conversation.contact.displayName || 'Unknown'}</strong>
                <div style={{ fontSize: '0.875rem', color: '#a1a1aa' }}>
                  {data.thread.assignedAgent?.name ?? 'Unassigned'}
                </div>
              </div>
              {user.role === 'admin' && (
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <select
                    value={assignAgentId}
                    onChange={(e) => setAssignAgentId(e.target.value)}
                    style={{
                      padding: '0.4rem 0.6rem',
                      background: '#27272a',
                      border: '1px solid #3f3f46',
                      borderRadius: '6px',
                      color: '#fff',
                    }}
                  >
                    <option value="">Assign to…</option>
                    {agents.map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleAssign}
                    disabled={!assignAgentId}
                    style={{
                      padding: '0.4rem 0.75rem',
                      background: '#7c3aed',
                      border: 'none',
                      borderRadius: '6px',
                      color: '#fff',
                    }}
                  >
                    Assign
                  </button>
                </div>
              )}
              {data.thread.status === 'open' && (
                <button
                  type="button"
                  onClick={handleClose}
                  style={{
                    padding: '0.4rem 0.75rem',
                    background: 'transparent',
                    border: '1px solid #3f3f46',
                    borderRadius: '6px',
                    color: '#a1a1aa',
                  }}
                >
                  Close
                </button>
              )}
            </header>
            <div
              style={{
                flex: 1,
                overflow: 'auto',
                padding: '1.5rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
              }}
            >
              {data.messages.map((m) => (
                <div
                  key={m.id}
                  style={{
                    alignSelf: m.direction === 'outbound' ? 'flex-end' : 'flex-start',
                    maxWidth: '80%',
                    padding: '0.6rem 0.9rem',
                    borderRadius: '12px',
                    background: m.direction === 'outbound' ? '#7c3aed' : '#27272a',
                  }}
                >
                  <div>{m.text ?? ''}</div>
                  <div style={{ fontSize: '0.75rem', opacity: 0.8, marginTop: '4px' }}>
                    {new Date(m.sentAt).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
            {data.thread.status === 'open' && (
              <form
                onSubmit={handleReply}
                style={{
                  padding: '1rem 1.5rem',
                  borderTop: '1px solid #27272a',
                  background: '#18181b',
                }}
              >
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Reply…"
                    rows={2}
                    style={{
                      flex: 1,
                      padding: '0.6rem 0.75rem',
                      background: '#27272a',
                      border: '1px solid #3f3f46',
                      borderRadius: '8px',
                      color: '#fff',
                      resize: 'none',
                    }}
                  />
                  <button
                    type="submit"
                    disabled={sending || !replyText.trim()}
                    style={{
                      padding: '0.6rem 1rem',
                      background: '#7c3aed',
                      border: 'none',
                      borderRadius: '8px',
                      color: '#fff',
                      alignSelf: 'flex-end',
                    }}
                  >
                    Send
                  </button>
                </div>
              </form>
            )}
          </>
        )}
        {!data && user && (
          <div style={{ padding: '2rem', color: '#71717a' }}>Loading or not found…</div>
        )}
      </main>
    </div>
  );
}
