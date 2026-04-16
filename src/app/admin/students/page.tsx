'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

interface Student {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  is_paid: boolean;
  paid_at: string | null;
  subscription_expires_at: string | null;
  class_id: number | null;
  created_at: string;
}

export default function AdminStudentsPage() {
  const supabase = createClient();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    password: '',
  });
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const loadStudents = useCallback(async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'student')
      .order('created_at', { ascending: false });
    setStudents(data || []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setMessage({ type: '', text: '' });

    try {
      const res = await fetch('/api/admin/create-student', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const result = await res.json();

      if (!res.ok) {
        setMessage({ type: 'error', text: result.error || 'Failed to create student' });
        setCreating(false);
        return;
      }

      setMessage({ type: 'success', text: 'Student account created successfully!' });

      // Generate WhatsApp message
      const whatsappMessage = encodeURIComponent(
        `Welcome to *Iluzia My Class*! 🎓\n\n` +
        `Your account has been created:\n` +
        `📧 Email: ${formData.email}\n` +
        `🔑 Password: ${formData.password}\n\n` +
        `Login here: ${window.location.origin}/login\n\n` +
        `Start your 3D learning journey today! 🚀`
      );

      const phoneNumber = formData.phone.replace(/\D/g, '');
      const whatsappUrl = `https://wa.me/${phoneNumber}?text=${whatsappMessage}`;

      // Open WhatsApp
      window.open(whatsappUrl, '_blank');

      // Reset form
      setFormData({ full_name: '', email: '', phone: '', password: '' });
      setShowModal(false);
      loadStudents();
    } catch {
      setMessage({ type: 'error', text: 'An unexpected error occurred' });
    } finally {
      setCreating(false);
    }
  };

  const generatePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    let password = '';
    for (let i = 0; i < 8; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData(prev => ({ ...prev, password }));
  };

  return (
    <>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1 style={{ fontSize: '1.5rem' }}>Students</h1>
            <p className="text-muted text-sm mt-sm">Manage student accounts</p>
          </div>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            + Add Student
          </button>
        </div>
      </div>

      <div className="page-body">
        {loading ? (
          <div className="empty-state">
            <div className="spinner spinner-lg" />
            <p className="text-muted mt-md">Loading students...</p>
          </div>
        ) : students.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">👥</div>
            <h3>No students yet</h3>
            <p>Create student accounts and share their login details via WhatsApp</p>
            <button className="btn btn-primary mt-lg" onClick={() => setShowModal(true)}>
              + Create First Student
            </button>
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Status</th>
                  <th>Joined</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student) => (
                  <tr key={student.id}>
                    <td style={{ fontWeight: 500, color: 'var(--neutral-100)' }}>
                      {student.full_name || '—'}
                    </td>
                    <td className="text-muted">{student.email}</td>
                    <td className="text-muted">{student.phone || '—'}</td>
                    <td>
                      {student.is_paid ? (
                        <span className="badge badge-success">✓ Paid</span>
                      ) : (
                        <span className="badge badge-warning">○ Free</span>
                      )}
                    </td>
                    <td className="text-muted text-sm">
                      {new Date(student.created_at).toLocaleDateString()}
                    </td>
                    <td>
                      <div className="flex gap-sm">
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => {
                            const msg = encodeURIComponent(
                              `Hi ${student.full_name}, this is from *Iluzia My Class*! 🎓\n` +
                              `Login: ${window.location.origin}/login\n` +
                              `Email: ${student.email}`
                            );
                            const phone = (student.phone || '').replace(/\D/g, '');
                            window.open(`https://wa.me/${phone}?text=${msg}`, '_blank');
                          }}
                        >
                          💬 WhatsApp
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Student Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={(e) => {
          if (e.target === e.currentTarget) setShowModal(false);
        }}>
          <div className="modal">
            <div className="modal-header">
              <h2>Create Student Account</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}>
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateStudent}>
              <div className="modal-body">
                {message.text && (
                  <div style={{
                    padding: '12px 16px',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.85rem',
                    background: message.type === 'error'
                      ? 'rgba(239, 68, 68, 0.12)'
                      : 'rgba(34, 197, 94, 0.12)',
                    border: `1px solid ${message.type === 'error'
                      ? 'rgba(239, 68, 68, 0.2)'
                      : 'rgba(34, 197, 94, 0.2)'}`,
                    color: message.type === 'error'
                      ? 'var(--error-400)'
                      : 'var(--success-400)',
                  }}>
                    {message.text}
                  </div>
                )}

                <div className="input-group">
                  <label>Full Name</label>
                  <input
                    className="input"
                    placeholder="Student's full name"
                    value={formData.full_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
                    required
                  />
                </div>

                <div className="input-group">
                  <label>Email</label>
                  <input
                    type="email"
                    className="input"
                    placeholder="student@example.com"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    required
                  />
                </div>

                <div className="input-group">
                  <label>Phone (with country code)</label>
                  <input
                    className="input"
                    placeholder="+91 XXXXX XXXXX"
                    value={formData.phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    required
                  />
                </div>

                <div className="input-group">
                  <label>Password</label>
                  <div className="flex gap-sm">
                    <input
                      className="input"
                      placeholder="Enter password"
                      value={formData.password}
                      onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                      required
                      minLength={6}
                      style={{ flex: 1 }}
                    />
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={generatePassword}
                    >
                      🎲 Generate
                    </button>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={creating}>
                  {creating ? (
                    <>
                      <span className="spinner" style={{ width: '16px', height: '16px' }} />
                      Creating...
                    </>
                  ) : (
                    '✓ Create & Share via WhatsApp'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
