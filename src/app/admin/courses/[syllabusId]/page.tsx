'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import ImageUploader from '@/components/ImageUploader';

interface ClassItem {
  id: number;
  name: string;
  class_number: number | null;
  description: string | null;
  image_url?: string | null;
  subject_count?: number;
}

export default function AdminClassesPage() {
  const supabase = createClient();
  const router = useRouter();
  const params = useParams();
  const syllabusId = Number(params.syllabusId);

  const [syllabusName, setSyllabusName] = useState('');
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<ClassItem | null>(null);
  const [form, setForm] = useState({ name: '', class_number: '', description: '', image_url: '' });
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    const { data: syl } = await supabase.from('syllabuses').select('name').eq('id', syllabusId).single();
    if (syl) setSyllabusName(syl.name);

    const { data, error } = await supabase
      .from('classes')
      .select('*, subjects(count)')
      .eq('syllabus_id', syllabusId)
      .order('class_number', { ascending: true, nullsFirst: false });

    if (!error && data) {
      const mapped = data.map((c: Record<string, unknown>) => ({
        ...c,
        subject_count: Array.isArray(c.subjects) ? (c.subjects[0] as { count: number })?.count ?? 0 : 0,
      })) as ClassItem[];
      setClasses(mapped);
    }
    setLoading(false);
  }, [supabase, syllabusId]);

  useEffect(() => { loadData(); }, [loadData]);

  const openCreate = () => { setEditing(null); setForm({ name: '', class_number: '', description: '', image_url: '' }); setShowModal(true); };
  const openEdit = (cls: ClassItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditing(cls);
    setForm({ name: cls.name, class_number: cls.class_number?.toString() || '', description: cls.description || '', image_url: cls.image_url || '' });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      class_number: form.class_number ? parseInt(form.class_number) : null,
      description: form.description.trim() || null,
      image_url: form.image_url.trim() || null,
      syllabus_id: syllabusId,
    };
    if (editing) await supabase.from('classes').update(payload).eq('id', editing.id);
    else await supabase.from('classes').insert(payload);
    setSaving(false); setShowModal(false); loadData();
  };

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (deleteConfirm === id) {
      await supabase.from('classes').delete().eq('id', id);
      setDeleteConfirm(null); loadData();
    } else { setDeleteConfirm(id); setTimeout(() => setDeleteConfirm(null), 3000); }
  };

  const colors = [
    'linear-gradient(135deg, #7c3aed, #06b6d4)',
    'linear-gradient(135deg, #ec4899, #8b5cf6)',
    'linear-gradient(135deg, #f59e0b, #ef4444)',
    'linear-gradient(135deg, #10b981, #3b82f6)',
    'linear-gradient(135deg, #6366f1, #ec4899)',
    'linear-gradient(135deg, #14b8a6, #8b5cf6)',
    'linear-gradient(135deg, #f97316, #ec4899)',
    'linear-gradient(135deg, #06b6d4, #3b82f6)',
  ];

  if (loading) return <div className="loading-page"><div className="spinner spinner-lg" /><p className="text-muted">Loading classes...</p></div>;

  return (
    <>
      <div className="page-header">
        <div className="breadcrumb mb-sm">
          <Link href="/admin/courses" style={{ color: 'var(--primary-400)' }}>Courses</Link>
          <span className="separator"> / </span>
          <span className="current">{syllabusName}</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-md">
            <button className="btn btn-ghost btn-sm" onClick={() => router.push('/admin/courses')}>← Back</button>
            <h1 style={{ fontSize: '1.5rem' }}>Classes — {syllabusName}</h1>
          </div>
          <button className="btn btn-primary" onClick={openCreate}>➕ Add Class</button>
        </div>
      </div>

      <div className="page-body">
        {classes.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🏫</div>
            <h3>No classes yet</h3>
            <p>Add classes to this syllabus to organize your content</p>
            <button className="btn btn-primary mt-lg" onClick={openCreate}>➕ Add First Class</button>
          </div>
        ) : (
          <div className="content-grid">
            {classes.map((cls, i) => (
              <div key={cls.id} className="content-card" onClick={() => router.push(`/admin/courses/${syllabusId}/${cls.id}`)} style={{ cursor: 'pointer' }}>
                <div className="content-card-image" style={{ background: cls.image_url ? `url(${cls.image_url}) center/cover no-repeat` : colors[i % colors.length] }}>
                  {!cls.image_url && <span style={{ position: 'relative', zIndex: 2, fontSize: '2.5rem' }}>🏫</span>}
                </div>
                <div className="content-card-body">
                  <h3>{cls.name}</h3>
                  {cls.description && <p style={{ marginBottom: '8px' }}>{cls.description}</p>}
                  <div className="flex items-center justify-between mt-sm">
                    <span className="badge badge-primary">📖 {cls.subject_count || 0} subject{(cls.subject_count || 0) !== 1 ? 's' : ''}</span>
                    <div className="flex gap-xs">
                      <button className="btn btn-ghost btn-sm" onClick={(e) => openEdit(cls, e)}>✏️</button>
                      <button className={`btn btn-sm ${deleteConfirm === cls.id ? 'btn-danger' : 'btn-ghost'}`} onClick={(e) => handleDelete(cls.id, e)}>
                        {deleteConfirm === cls.id ? 'Confirm?' : '🗑️'}
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
              <h2>{editing ? 'Edit Class' : 'Add Class'}</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="input-group">
                <label>Class Name *</label>
                <input className="input" placeholder="e.g. Class 6" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="input-group">
                <label>Class Number</label>
                <input className="input" type="number" placeholder="e.g. 6" value={form.class_number} onChange={e => setForm({ ...form, class_number: e.target.value })} />
              </div>
              <div className="input-group">
                <label>Description</label>
                <textarea className="input" placeholder="Optional..." value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="input-group">
                <label>Class Image</label>
                <ImageUploader 
                  currentUrl={form.image_url} 
                  onUpload={(url) => setForm({ ...form, image_url: url })} 
                  onDelete={() => setForm({ ...form, image_url: '' })} 
                  folderPath="classes" 
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving || !form.name.trim()}>
                {saving ? 'Saving...' : editing ? 'Update' : 'Add Class'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
