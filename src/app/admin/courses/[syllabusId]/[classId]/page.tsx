'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

interface SubjectItem {
  id: number;
  name: string;
  description: string | null;
  sort_order: number;
  image_url?: string | null;
  chapter_count?: number;
}

export default function AdminSubjectsPage() {
  const supabase = createClient();
  const router = useRouter();
  const params = useParams();
  const syllabusId = Number(params.syllabusId);
  const classId = Number(params.classId);

  const [syllabusName, setSyllabusName] = useState('');
  const [className, setClassName] = useState('');
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<SubjectItem | null>(null);
  const [form, setForm] = useState({ name: '', description: '', image_url: '' });
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [sylRes, clsRes, subRes] = await Promise.all([
      supabase.from('syllabuses').select('name').eq('id', syllabusId).single(),
      supabase.from('classes').select('name').eq('id', classId).single(),
      supabase.from('subjects').select('*, chapters(count)').eq('class_id', classId).order('sort_order'),
    ]);
    if (sylRes.data) setSyllabusName(sylRes.data.name);
    if (clsRes.data) setClassName(clsRes.data.name);
    if (!subRes.error && subRes.data) {
      const mapped = subRes.data.map((s: Record<string, unknown>) => ({
        ...s,
        chapter_count: Array.isArray(s.chapters) ? (s.chapters[0] as { count: number })?.count ?? 0 : 0,
      })) as SubjectItem[];
      setSubjects(mapped);
    }
    setLoading(false);
  }, [supabase, syllabusId, classId]);

  useEffect(() => { loadData(); }, [loadData]);

  const openCreate = () => { setEditing(null); setForm({ name: '', description: '', image_url: '' }); setShowModal(true); };
  const openEdit = (sub: SubjectItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditing(sub);
    setForm({ name: sub.name, description: sub.description || '', image_url: sub.image_url || '' });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    const payload = { name: form.name.trim(), description: form.description.trim() || null, image_url: form.image_url.trim() || null, class_id: classId, sort_order: editing ? editing.sort_order : subjects.length };
    if (editing) await supabase.from('subjects').update(payload).eq('id', editing.id);
    else await supabase.from('subjects').insert(payload);
    setSaving(false); setShowModal(false); loadData();
  };

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (deleteConfirm === id) { await supabase.from('subjects').delete().eq('id', id); setDeleteConfirm(null); loadData(); }
    else { setDeleteConfirm(id); setTimeout(() => setDeleteConfirm(null), 3000); }
  };

  const subjectIcons: Record<string, string> = {
    mathematics: '🔢', math: '🔢', science: '🔬', physics: '⚛️', chemistry: '🧪', biology: '🧬',
    english: '📝', hindi: '📖', history: '🏛️', geography: '🌍', computer: '💻', art: '🎨', default: '📖',
  };
  const getIcon = (name: string) => {
    const lower = name.toLowerCase();
    for (const [key, icon] of Object.entries(subjectIcons)) { if (lower.includes(key)) return icon; }
    return subjectIcons.default;
  };

  const colors = [
    'linear-gradient(135deg, #3b82f6, #8b5cf6)', 'linear-gradient(135deg, #10b981, #06b6d4)',
    'linear-gradient(135deg, #f59e0b, #ef4444)', 'linear-gradient(135deg, #ec4899, #6366f1)',
    'linear-gradient(135deg, #14b8a6, #3b82f6)', 'linear-gradient(135deg, #8b5cf6, #ec4899)',
  ];

  if (loading) return <div className="loading-page"><div className="spinner spinner-lg" /><p className="text-muted">Loading subjects...</p></div>;

  return (
    <>
      <div className="page-header">
        <div className="breadcrumb mb-sm">
          <Link href="/admin/courses" style={{ color: 'var(--primary-400)' }}>Courses</Link>
          <span className="separator"> / </span>
          <Link href={`/admin/courses/${syllabusId}`} style={{ color: 'var(--primary-400)' }}>{syllabusName}</Link>
          <span className="separator"> / </span>
          <span className="current">{className}</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-md">
            <button className="btn btn-ghost btn-sm" onClick={() => router.push(`/admin/courses/${syllabusId}`)}>← Back</button>
            <h1 style={{ fontSize: '1.5rem' }}>Subjects — {className}</h1>
          </div>
          <button className="btn btn-primary" onClick={openCreate}>➕ Add Subject</button>
        </div>
      </div>

      <div className="page-body">
        {subjects.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📖</div>
            <h3>No subjects yet</h3>
            <p>Add subjects to organize your course content</p>
            <button className="btn btn-primary mt-lg" onClick={openCreate}>➕ Add First Subject</button>
          </div>
        ) : (
          <div className="content-grid">
            {subjects.map((sub, i) => (
              <div key={sub.id} className="content-card" onClick={() => router.push(`/admin/courses/${syllabusId}/${classId}/${sub.id}`)} style={{ cursor: 'pointer' }}>
                <div className="content-card-image" style={{ background: sub.image_url ? `url(${sub.image_url}) center/cover no-repeat` : colors[i % colors.length] }}>
                  {!sub.image_url && <span style={{ position: 'relative', zIndex: 2, fontSize: '2.5rem' }}>{getIcon(sub.name)}</span>}
                </div>
                <div className="content-card-body">
                  <h3>{sub.name}</h3>
                  {sub.description && <p style={{ marginBottom: '8px' }}>{sub.description}</p>}
                  <div className="flex items-center justify-between mt-sm">
                    <span className="badge badge-accent">📑 {sub.chapter_count || 0} chapter{(sub.chapter_count || 0) !== 1 ? 's' : ''}</span>
                    <div className="flex gap-xs">
                      <button className="btn btn-ghost btn-sm" onClick={(e) => openEdit(sub, e)}>✏️</button>
                      <button className={`btn btn-sm ${deleteConfirm === sub.id ? 'btn-danger' : 'btn-ghost'}`} onClick={(e) => handleDelete(sub.id, e)}>
                        {deleteConfirm === sub.id ? 'Confirm?' : '🗑️'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editing ? 'Edit Subject' : 'Add Subject'}</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="input-group">
                <label>Subject Name *</label>
                <input className="input" placeholder="e.g. Mathematics" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="input-group">
                <label>Description</label>
                <textarea className="input" placeholder="Optional..." value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="input-group">
                <label>Image URL</label>
                <input className="input" placeholder="Optional image URL..." value={form.image_url} onChange={e => setForm({ ...form, image_url: e.target.value })} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving || !form.name.trim()}>
                {saving ? 'Saving...' : editing ? 'Update' : 'Add Subject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
