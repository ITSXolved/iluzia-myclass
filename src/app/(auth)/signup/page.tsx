'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import styles from '../auth.module.css';

export default function SignupPage() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
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

    try {
      // Sign up with Supabase Auth
      const { data, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            phone: phone,
            role: 'student',
          },
        },
      });

      if (authError) {
        setError(authError.message);
        setLoading(false);
        return;
      }

      if (data.user) {
        // Create profile
        const { error: profileError } = await supabase
          .from('profiles')
          .upsert({
            id: data.user.id,
            full_name: fullName,
            email: email,
            phone: phone,
            role: 'student',
            is_paid: false,
          });

        if (profileError) {
          console.error('Profile creation error:', profileError);
        }

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
            <div className={styles['auth-logo-icon']}>✦</div>
            Iluzia My Class
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
              <label htmlFor="email">Email Address</label>
              <input
                id="email"
                type="email"
                className="input"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
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
