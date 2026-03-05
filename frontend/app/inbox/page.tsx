'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { me, getInbox, logout, type InboxThread, type User } from '@/lib/api';

export default function InboxPage() {
  const [user, setUser] = useState<User | null>(null);
  const [threads, setThreads] = useState<InboxThread[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    me().then((u) => {
      if (!u) {
        router.push('/login');
        return;
      }
      setUser(u);
      getInbox().then(setThreads).catch(() => setThreads([])).finally(() => setLoading(false));
    });
  }, [router]);

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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <strong>Inbox</strong>
          <span style={{ fontSize: '0.875rem', color: '#a1a1aa' }}>{user.name} ({user.role})</span>
        </div>
        <button
          type="button"
          onClick={() => logout().then(() => router.push('/login'))}
          style={{ fontSize: '0.875rem', background: 'none', border: 'none', color: '#a78bfa', cursor: 'pointer' }}
        >
          Logout
        </button>
        <ul style={{ listStyle: 'none', padding: 0, margin: '1rem 0 0' }}>
          {loading
            ? <li style={{ padding: '0.5rem', color: '#71717a' }}>Loading…</li>
            : threads.length === 0
              ? <li style={{ padding: '0.5rem', color: '#71717a' }}>No conversations</li>
              : threads.map((t) => (
                  <li key={t.conversationId}>
                    <Link
                      href={`/conversations/${t.conversationId}`}
                      style={{
                        display: 'block',
                        padding: '0.75rem',
                        borderRadius: '8px',
                        marginBottom: '4px',
                        background: 'transparent',
                        color: '#e4e4e7',
                      }}
                    >
                      <div style={{ fontWeight: 500 }}>
                        {t.conversation.contact.displayName || 'Unknown'}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#a1a1aa', marginTop: '2px' }}>
                        {t.lastMessagePreview?.slice(0, 50) ?? '—'}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#71717a', marginTop: '2px' }}>
                        {new Date(t.lastMessageAt).toLocaleString()}
                      </div>
                    </Link>
                  </li>
                ))}
        </ul>
      </aside>
      <main
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          color: '#71717a',
        }}
      >
        Select a conversation
      </main>
    </div>
  );
}
