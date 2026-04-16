'use client';

import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useEffect, useState } from 'react';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userName, setUserName] = useState('');

  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', user.id)
          .single();
        if (profile) setUserName(profile.full_name || user.email || 'Admin');
      }
    }
    loadProfile();
  }, [supabase]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const navItems = [
    { href: '/admin', label: 'Dashboard', icon: '📊' },
    { href: '/admin/content', label: 'Content', icon: '📚' },
    { href: '/admin/students', label: 'Students', icon: '👥' },
  ];

  const isActive = (href: string) => {
    if (href === '/admin') return pathname === '/admin';
    return pathname.startsWith(href);
  };

  return (
    <div>
      {/* Mobile menu button */}
      <button
        className="btn btn-ghost btn-icon"
        onClick={() => setSidebarOpen(!sidebarOpen)}
        style={{
          position: 'fixed',
          top: '16px',
          left: '16px',
          zIndex: 60,
          display: 'none',
          fontSize: '1.2rem',
        }}
        id="mobile-menu-btn"
      >
        ☰
      </button>

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <Link href="/admin" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--gradient-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1rem',
              color: 'white',
              boxShadow: 'var(--shadow-glow)',
            }}>✦</div>
            <div>
              <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '1rem', color: 'var(--neutral-50)' }}>
                Iluzia My Class
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--neutral-500)', fontWeight: 500 }}>
                Admin Panel
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
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '8px 14px',
            marginBottom: '8px',
          }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: 'var(--radius-full)',
              background: 'rgba(124, 58, 237, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.8rem',
              color: 'var(--primary-300)',
              fontWeight: 700,
              flexShrink: 0,
            }}>
              {userName ? userName[0]?.toUpperCase() : 'A'}
            </div>
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--neutral-200)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {userName || 'Admin'}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--neutral-500)' }}>Administrator</div>
            </div>
          </div>
          <button
            className="sidebar-link"
            onClick={handleLogout}
            style={{ color: 'var(--error-400)' }}
          >
            <span className="icon">🚪</span>
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        {children}
      </main>

      <style jsx>{`
        @media (max-width: 768px) {
          #mobile-menu-btn {
            display: flex !important;
          }
        }
      `}</style>
    </div>
  );
}
