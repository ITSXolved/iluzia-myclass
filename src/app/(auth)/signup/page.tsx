'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import styles from '../auth.module.css';

/** Generates the hidden internal email from a username */
function internalEmail(username: string) {
  return `${username.toLowerCase().trim()}@iluzia.myclass`;
}

export default function SignupPage() {
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    const cleanUsername = username.toLowerCase().trim();

    // Basic username validation
    if (!/^[a-z0-9_]{3,30}$/.test(cleanUsername)) {
      setError('Username must be 3–30 characters: letters, numbers, underscores only');
      setLoading(false);
      return;
    }

    try {
      // Sign up using internal email derived from username.
      // The on_auth_user_created trigger (SECURITY DEFINER) will create the profile.
      const { data, error: authError } = await supabase.auth.signUp({
        email: internalEmail(cleanUsername),
        password,
        options: {
          data: {
            username: cleanUsername,
            full_name: fullName,
            phone: phone,
            role: 'student',
          },
        },
      });

      if (authError) {
        // Email already in use means username is taken
        if (authError.message.includes('already registered')) {
          setError('Username is already taken. Please choose another.');
        } else {
          setError(authError.message);
        }
        setLoading(false);
        return;
      }

      if (data.user) {
        // Profile is auto-created by the on_auth_user_created trigger (SECURITY DEFINER).
        // No client-side upsert needed — that caused RLS infinite recursion (42P17).
        setSuccess('Account created successfully! Redirecting...');
        setTimeout(() => {
          router.push('/student');
          router.refresh();
        }, 1500);
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
            <Image src="/iluzia-logo.png" alt="iLuZia Lab" width={48} height={48} style={{ objectFit: 'contain', width: 'auto', height: '48px' }} />
            iLuZia Lab
          </Link>
          <h1>Create Account</h1>
          <p>Join thousands of students learning in 3D</p>
        </div>

        <div className={styles['auth-card']}>
          <form className={styles['auth-form']} onSubmit={handleSignup}>
            {error && (
              <div className={styles['auth-error']}>
                ⚠ {error}
              </div>
            )}

            {success && (
              <div className={styles['auth-success']}>
                ✓ {success}
              </div>
            )}

            <div className="input-group">
              <label htmlFor="username">Username</label>
              <input
                id="username"
                type="text"
                className="input"
                placeholder="your_username (letters, numbers, _)"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                required
              />
            </div>

            <div className="input-group">
              <label htmlFor="fullName">Full Name</label>
              <input
                id="fullName"
                type="text"
                className="input"
                placeholder="John Doe"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>

            <div className="input-group">
              <label htmlFor="phone">Phone Number</label>
              <input
                id="phone"
                type="tel"
                className="input"
                placeholder="+91 XXXXX XXXXX"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
            </div>

            <div className="input-group">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                className="input"
                placeholder="Min. 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                autoComplete="new-password"
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
                  Creating Account...
                </>
              ) : (
                '🚀 Create Account'
              )}
            </button>
          </form>
        </div>

        <div className={styles['auth-footer']}>
          Already have an account?{' '}
          <Link href="/login">Sign in</Link>
        </div>
      </div>
    </div>
  );
}
