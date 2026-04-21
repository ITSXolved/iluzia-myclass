'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import styles from '../auth.module.css';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Step 1: Resolve username → internal email via server (service role bypasses RLS)
      const lookupRes = await fetch('/api/auth/lookup-username', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim() }),
      });

      if (!lookupRes.ok) {
        setError('Invalid username or password');
        setLoading(false);
        return;
      }

      const { email } = await lookupRes.json();

      // Step 2: Sign in with the resolved internal email
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        setError('Invalid username or password');
        setLoading(false);
        return;
      }

      if (data.user) {
        // Use user_metadata role to avoid querying profiles (which has broken RLS)
        const role = data.user.user_metadata?.role ?? 'student';
        router.push(role === 'admin' ? '/admin' : '/student');
        router.refresh();
      }
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles['auth-page']}>
      <div className={styles['auth-container']}>
        <div className={styles['auth-header']}>
          <Link href="/" className={styles['auth-logo']}>
            <div className={styles['auth-logo-icon']}>✦</div>
            Iluzia My Class
          </Link>
          <h1>Welcome Back</h1>
          <p>Sign in to continue your learning journey</p>
        </div>

        <div className={styles['auth-card']}>
          <form className={styles['auth-form']} onSubmit={handleLogin}>
            {error && (
              <div className={styles['auth-error']}>
                ⚠ {error}
              </div>
            )}

            <div className="input-group">
              <label htmlFor="username">Username</label>
              <input
                id="username"
                type="text"
                className="input"
                placeholder="your_username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                required
              />
            </div>

            <div className="input-group">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                className="input"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>

            <button
              type="submit"
              className={`btn btn-primary btn-lg ${styles['auth-submit']}`}
              disabled={loading}
              style={{ width: '100%' }}
            >
              {loading ? (
                <>
                  <span className="spinner" style={{ width: '18px', height: '18px' }} />
                  Signing In...
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>
        </div>

        <div className={styles['auth-footer']}>
          Don&apos;t have an account?{' '}
          <Link href="/signup">Create one</Link>
        </div>
      </div>
    </div>
  );
}
