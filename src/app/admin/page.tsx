'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function AdminDashboard() {
  const supabase = createClient();
  const [stats, setStats] = useState({
    totalStudents: 0,
    paidStudents: 0,
    totalClasses: 0,
  });
  const [recentStudents, setRecentStudents] = useState<Array<{
    id: string;
    full_name: string;
    email: string;
    is_paid: boolean;
    created_at: string;
  }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboard() {
      try {
        // Get student counts
        const { count: totalStudents } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .eq('role', 'student');

        const { count: paidStudents } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .eq('role', 'student')
          .eq('is_paid', true);

        // Get class count from XR API via our proxy
        let totalClasses = 0;
        try {
          const res = await fetch('/api/xr/classes');
          const classes = await res.json();
          totalClasses = Array.isArray(classes) ? classes.length : 0;
        } catch {
          console.log('Could not fetch classes from API');
        }

        setStats({
          totalStudents: totalStudents || 0,
          paidStudents: paidStudents || 0,
          totalClasses,
        });

        // Recent students
        const { data: students } = await supabase
          .from('profiles')
          .select('id, full_name, email, is_paid, created_at')
          .eq('role', 'student')
          .order('created_at', { ascending: false })
          .limit(5);

        setRecentStudents(students || []);
      } catch (err) {
        console.error('Dashboard load error:', err);
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, [supabase]);

  if (loading) {
    return (
      <div className="loading-page">
        <div className="spinner spinner-lg" />
        <p className="text-muted">Loading dashboard...</p>
      </div>
    );
  }

  return (
    <>
      <div className="page-header">
        <h1 style={{ fontSize: '1.5rem' }}>Dashboard</h1>
        <p className="text-muted text-sm mt-sm">Welcome to Iluzia My Class Admin Panel</p>
      </div>

      <div className="page-body">
        {/* Stat Cards */}
        <div className="grid grid-3 gap-lg" style={{ marginBottom: '32px' }}>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'rgba(124, 58, 237, 0.15)' }}>
              👥
            </div>
            <div className="stat-value">{stats.totalStudents}</div>
            <div className="stat-label">Total Students</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'rgba(34, 197, 94, 0.15)' }}>
              💎
            </div>
            <div className="stat-value">{stats.paidStudents}</div>
            <div className="stat-label">Paid Students</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'rgba(6, 182, 212, 0.15)' }}>
              📚
            </div>
            <div className="stat-value">{stats.totalClasses}</div>
            <div className="stat-label">Available Classes</div>
          </div>
        </div>

        {/* Recent Students */}
        <div className="card-flat" style={{ marginBottom: '24px' }}>
          <div className="flex items-center justify-between" style={{ marginBottom: '20px' }}>
            <h2 style={{ fontSize: '1.15rem' }}>Recent Students</h2>
            <a href="/admin/students" className="btn btn-ghost btn-sm">
              View All →
            </a>
          </div>
          
          {recentStudents.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">👥</div>
              <h3>No students yet</h3>
              <p>Create student accounts from the Students page</p>
            </div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Status</th>
                    <th>Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {recentStudents.map((student) => (
                    <tr key={student.id}>
                      <td style={{ fontWeight: 500, color: 'var(--neutral-100)' }}>
                        {student.full_name || '—'}
                      </td>
                      <td className="text-muted">{student.email}</td>
                      <td>
                        <span className={`badge ${student.is_paid ? 'badge-success' : 'badge-warning'}`}>
                          {student.is_paid ? '✓ Paid' : '○ Free'}
                        </span>
                      </td>
                      <td className="text-muted text-sm">
                        {new Date(student.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="card-flat">
          <h2 style={{ fontSize: '1.15rem', marginBottom: '20px' }}>Quick Actions</h2>
          <div className="flex gap-md flex-wrap">
            <a href="/admin/content" className="btn btn-primary">
              📚 Manage Content
            </a>
            <a href="/admin/students" className="btn btn-secondary">
              👥 Add Student
            </a>
          </div>
        </div>
      </div>
    </>
  );
}
