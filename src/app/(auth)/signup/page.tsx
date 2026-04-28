'use client';

import { useState, useEffect } from 'react';
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
  const [syllabuses, setSyllabuses] = useState<{ id: number; name: string }[]>([]);
  const [classes, setClasses] = useState<{ id: number; name: string; syllabus_id: number }[]>([]);
  const [selectedSyllabus, setSelectedSyllabus] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function fetchOptions() {
      try {
        const { data: sData, error: sErr } = await supabase.from('syllabuses').select('id, name').order('sort_order', { ascending: true });
        if (sErr) console.error('Syllabuses fetch error:', sErr);
        console.log('Fetched syllabuses:', sData);
        if (sData) setSyllabuses(sData);

        const { data: cData, error: cErr } = await supabase.from('classes').select('id, name, syllabus_id').order('class_number', { ascending: true });
        if (cErr) console.error('Classes fetch error:', cErr);
        console.log('Fetched classes:', cData);
        if (cData) setClasses(cData);
      } catch (err) {
        console.error('Fetch exception:', err);
      }
    }
    fetchOptions();
  }, []);

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

    if (!selectedSyllabus || !selectedClass) {
      setError('Please select a syllabus and class');
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
            class_id: parseInt(selectedClass, 10),
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

            <div className="input-group">
              <label htmlFor="syllabus">Syllabus</label>
              <select
                id="syllabus"
                className="input"
                value={selectedSyllabus}
                onChange={(e) => {
                  setSelectedSyllabus(e.target.value);
                  setSelectedClass('');
                }}
                required
              >
                <option value="">Select Syllabus</option>
                {syllabuses.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            {selectedSyllabus && (
              <div className="input-group">
                <label htmlFor="class">Class</label>
                <select
                  id="class"
                  className="input"
                  value={selectedClass}
                  onChange={(e) => setSelectedClass(e.target.value)}
                  required
                >
                  <option value="">Select Class</option>
                  {classes
                    .filter((c) => c.syllabus_id === parseInt(selectedSyllabus, 10))
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </div>
            )}

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
