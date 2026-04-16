'use client';

import Link from 'next/link';

export default function StudentDashboard() {
  const userName = 'Student';
  const isPaid = false;

  return (
    <>
      <div className="page-header">
        <h1 style={{ fontSize: '1.5rem' }}>Welcome back, {userName}! 👋</h1>
        <p className="text-muted text-sm mt-sm">Explore immersive 3D learning content</p>
      </div>

      <div className="page-body">
        {/* Upgrade Banner */}
        {!isPaid && (
          <div style={{
            background: 'linear-gradient(135deg, rgba(124,58,237,.12), rgba(6,182,212,.08))',
            border: '1px solid rgba(124,58,237,.16)',
            borderRadius: 20, padding: '28px 32px', marginBottom: 32,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: 24, flexWrap: 'wrap',
          }}>
            <div>
              <h2 style={{ fontSize: '1.2rem', marginBottom: 6 }}>🔒 Unlock All Content</h2>
              <p style={{ color: 'var(--neutral-400)', fontSize: '.9rem', maxWidth: 420 }}>
                You can access the first 3 topics free. Upgrade to Premium for ₹2,499/year to unlock everything.
              </p>
            </div>
            <Link href="/payment" className="btn btn-primary btn-lg" style={{ flexShrink: 0 }}>
              💎 Upgrade — ₹2,499/year
            </Link>
          </div>
        )}

        {/* Quick-start cards */}
        <div className="grid grid-2 gap-lg" style={{ marginBottom: 32 }}>
          <Link href="/student/explore" className="card" style={{ textDecoration: 'none', display: 'block' }}>
            <div style={{ fontSize: '2.2rem', marginBottom: 14 }}>📚</div>
            <h3 style={{ fontSize: '1.1rem', marginBottom: 6 }}>Explore Content</h3>
            <p className="text-muted text-sm" style={{ lineHeight: 1.6 }}>
              Browse Classes → Subjects → Chapters → Topics.
              Experience immersive 3D models and virtual labs.
            </p>
            <span className="badge badge-primary" style={{ marginTop: 14 }}>Start Exploring →</span>
          </Link>

          <div className="card" style={{ opacity: .7 }}>
            <div style={{ fontSize: '2.2rem', marginBottom: 14 }}>📊</div>
            <h3 style={{ fontSize: '1.1rem', marginBottom: 6 }}>Your Progress</h3>
            <p className="text-muted text-sm" style={{ lineHeight: 1.6 }}>
              Track your learning journey across all topics. Upgrade to premium to unlock progress tracking.
            </p>
            <span className="badge badge-warning" style={{ marginTop: 14 }}>
              {isPaid ? '✓ Premium' : '○ Free Plan'}
            </span>
          </div>
        </div>

        {/* Features */}
        <div className="card-flat">
          <h2 style={{ fontSize: '1.1rem', marginBottom: 20 }}>What You Get</h2>
          <div className="grid grid-3 gap-lg">
            {[
              { icon: '🥽', title: '3D Models', desc: 'Interactive 3D visualizations' },
              { icon: '🔬', title: 'Virtual Labs', desc: 'Safe experimentation' },
              { icon: '📱', title: 'Any Device', desc: 'Learn on any browser' },
            ].map((f, i) => (
              <div key={i} style={{ textAlign: 'center', padding: 16 }}>
                <div style={{ fontSize: '2rem', marginBottom: 10 }}>{f.icon}</div>
                <h4 style={{ fontSize: '.95rem', marginBottom: 4 }}>{f.title}</h4>
                <p className="text-muted text-xs">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
