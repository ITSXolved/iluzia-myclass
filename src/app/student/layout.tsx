'use client';

import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [userName, setUserName] = useState('Student');
  const [className, setClassName] = useState('Enrolled Class');
  const [isPaid, setIsPaid] = useState(false);

  useEffect(() => {
    async function fetchProfile() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data } = await supabase
          .from('profiles')
          .select('full_name, username, is_paid, classes(name)')
          .eq('id', session.user.id)
          .single();
          
        if (data) {
          setUserName(data.full_name || data.username || 'Student');
          setIsPaid(data.is_paid || false);
          const classesData = data.classes as any;
          if (classesData?.name) {
            setClassName(classesData.name);
          }
        }
      }
    }
    fetchProfile();

    // Track active time immediately on load, then every 60 seconds
    const trackTime = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const today = new Date().toISOString().split('T')[0];
        const { data } = await supabase
          .from('student_active_time')
          .select('id, duration_minutes')
          .eq('user_id', session.user.id)
          .eq('session_date', today)
          .single();
        if (data) {
          await supabase.from('student_active_time').update({ duration_minutes: data.duration_minutes + 1 }).eq('id', data.id);
        } else {
          await supabase.from('student_active_time').insert({ user_id: session.user.id, session_date: today, duration_minutes: 1 });
        }
      }
    };
    
    trackTime(); // Track first minute immediately
    const interval = setInterval(trackTime, 60000);

    return () => clearInterval(interval);
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const navItems = [
    { href: '/student', label: 'Dashboard', icon: '🏠' },
    { href: '/student/explore', label: 'My Curriculum', icon: '📚' },
  ];

  const isActive = (href: string) => {
    if (href === '/student') return pathname === '/student';
    return pathname.startsWith(href);
  };

  return (
    <div>
      {/* Mobile hamburger */}
      <button
        className="btn btn-ghost btn-icon"
        onClick={() => setSidebarOpen(!sidebarOpen)}
        aria-label="Toggle menu"
        style={{
          position: 'fixed', top: 16, left: 16, zIndex: 60,
          display: 'none', fontSize: '1.25rem',
        }}
        id="student-menu-btn"
      >
        {sidebarOpen ? '✕' : '☰'}
      </button>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            zIndex: 49, display: 'none',
          }}
          id="sidebar-overlay"
        />
      )}

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <Link href="/student" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <Image src="/iluzia-logo.png" alt="iLuZia Lab" width={36} height={36} style={{ objectFit: 'contain', width: 'auto', height: '36px' }} />
            <div>
              <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '1rem', color: 'var(--neutral-50)' }}>
                iLuZia Lab
              </div>
              <div style={{ fontSize: '.7rem', color: 'var(--neutral-500)', fontWeight: 500 }}>
                Student Portal
              </div>
            </div>
          </Link>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`sidebar-link ${isActive(item.href) ? 'active' : ''}`}
              onClick={() => setSidebarOpen(false)}
            >
              <span className="icon">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="sidebar-footer">
          {/* Subscription banner */}
          <div style={{
            padding: '12px 14px', borderRadius: 10, marginBottom: 12,
            background: isPaid ? 'rgba(34,197,94,.08)' : 'rgba(124,58,237,.06)',
            border: `1px solid ${isPaid ? 'rgba(34,197,94,.15)' : 'rgba(124,58,237,.12)'}`,
          }}>
            <div style={{
              fontSize: '.75rem', fontWeight: 600, marginBottom: 4,
              color: isPaid ? 'var(--success-400)' : 'var(--primary-300)',
            }}>
              {isPaid ? '✓ Premium Active' : '○ Free Plan'}
            </div>
            {!isPaid && (
              <Link
                href="/payment"
                className="btn btn-primary btn-sm"
                style={{ width: '100%', marginTop: 8, fontSize: '.75rem' }}
              >
                🔓 Unlock All — ₹2,499
              </Link>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', marginBottom: 8 }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: 'rgba(6,182,212,.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '.8rem', color: 'var(--accent-400)', fontWeight: 700, flexShrink: 0,
            }}>{userName.charAt(0).toUpperCase()}</div>
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontSize: '.85rem', fontWeight: 600, color: 'var(--neutral-200)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{userName}</div>
              <div style={{ fontSize: '.7rem', color: 'var(--neutral-500)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{className}</div>
            </div>
          </div>

          <button className="sidebar-link" onClick={handleLogout} style={{ color: 'var(--error-400)' }}>
            <span className="icon">🚪</span>
            Sign Out
          </button>
        </div>
      </aside>

      <main className="main-content">{children}</main>

      <style jsx>{`
        @media (max-width: 768px) {
          #student-menu-btn, #sidebar-overlay { display: flex !important; }
        }
      `}</style>
    </div>
  );
}
