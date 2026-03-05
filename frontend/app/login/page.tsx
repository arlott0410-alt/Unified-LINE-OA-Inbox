'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { login } from '@/lib/api';

export default function LoginPage() {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await login(name, password);
      router.push('/inbox');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <form
        onSubmit={handleSubmit}
        style={{
          width: '320px',
          padding: '2rem',
          background: '#18181b',
          borderRadius: '12px',
          border: '1px solid #27272a',
        }}
      >
        <h1 style={{ margin: '0 0 1.5rem', fontSize: '1.25rem' }}>Unified LINE OA Inbox</h1>
        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: '#a1a1aa' }}>
          Name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          autoComplete="username"
          style={{
            width: '100%',
            padding: '0.5rem 0.75rem',
            marginBottom: '1rem',
            background: '#27272a',
            border: '1px solid #3f3f46',
            borderRadius: '6px',
            color: '#fff',
          }}
        />
        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: '#a1a1aa' }}>
          Password
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
          style={{
            width: '100%',
            padding: '0.5rem 0.75rem',
            marginBottom: '1rem',
            background: '#27272a',
            border: '1px solid #3f3f46',
            borderRadius: '6px',
            color: '#fff',
          }}
        />
        {error && (
          <p style={{ color: '#f87171', fontSize: '0.875rem', marginBottom: '1rem' }}>{error}</p>
        )}
        <button
          type="submit"
          style={{
            width: '100%',
            padding: '0.6rem',
            background: '#7c3aed',
            border: 'none',
            borderRadius: '6px',
            color: '#fff',
            fontWeight: 600,
          }}
        >
          Sign in
        </button>
      </form>
    </div>
  );
}
