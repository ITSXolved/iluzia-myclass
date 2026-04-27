'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

interface SyllabusItem {
  id: number;
  name: string;
  description: string | null;
  sort_order: number;
  created_at: string;
  image_url?: string | null;
  class_count?: number;
}

export default function AdminCoursesPage() {
  const supabase = createClient();
  const router = useRouter();
  const [syllabuses, setSyllabuses] = useState<SyllabusItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<SyllabusItem | null>(null);
  const [form, setForm] = useState({ name: '', description: '', image_url: '' });
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  const loadSyllabuses = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('syllabuses')
      .select('*, classes(count)')
      .order('sort_order', { ascending: true });

    if (!error && data) {
      const mapped = data.map((s: Record<string, unknown>) => ({
        ...s,
        class_count: Array.isArray(s.classes) ? (s.classes[0] as { count: number })?.count ?? 0 : 0,
      })) as SyllabusItem[];
      setSyllabuses(mapped);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => { loadSyllabuses(); }, [loadSyllabuses]);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', description: '', image_url: '' });
    setShowModal(true);
  };

  const openEdit = (item: SyllabusItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditing(item);
    setForm({ name: item.name, description: item.description || '', image_url: item.image_url || '' });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      image_url: form.image_url.trim() || null,
      sort_order: editing ? editing.sort_order : syllabuses.length,
    };
    if (editing) {
      await supabase.from('syllabuses').update(payload).eq('id', editing.id);
    } else {
      await supabase.from('syllabuses').insert(payload);
    }
    setSaving(false);
    setShowModal(false);
    loadSyllabuses();
  };

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (deleteConfirm === id) {
      await supabase.from('syllabuses').delete().eq('id', id);
      setDeleteConfirm(null);
      loadSyllabuses();
    } else {
      setDeleteConfirm(id);
      setTimeout(() => setDeleteConfirm(null), 3000);
    }
  };

  const gradients = [
    'linear-gradient(135deg, #7c3aed, #06b6d4)',
    'linear-gradient(135deg, #ec4899, #8b5cf6)',
    'linear-gradient(135deg, #f59e0b, #ef4444)',
    'linear-gradient(135deg, #10b981, #3b82f6)',
    'linear-gradient(135deg, #6366f1, #ec4899)',
    'linear-gradient(135deg, #14b8a6, #8b5cf6)',
  ];

  if (loading) {
    return (
      <div className="loading-page">
        <div className="spinner spinner-lg" />
        <p className="text-muted">Loading courses...</p>
      </div>
    );
  }

  return (
    <>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1 style={{ fontSize: '1.5rem' }}>Course Configuration</h1>
            <p className="text-muted text-sm mt-sm">Manage syllabuses, classes, subjects, chapters, topics & materials</p>
          </div>
          <button className="btn btn-primary" onClick={openCreate}>
            ➕ Add Syllabus
          </button>
        </div>
      </div>

      <div className="page-body">
        {syllabuses.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🎓</div>
            <h3>No syllabuses yet</h3>
            <p>Create a syllabus to organize your classes and course content</p>
            <button className="btn btn-primary mt-lg" onClick={openCreate}>
              ➕ Create First Syllabus
            </button>
          </div>
        ) : (
          <div className="content-grid">
            {syllabuses.map((syl, i) => (
              <div
                key={syl.id}
                className="content-card"
                onClick={() => router.push(`/admin/courses/${syl.id}`)}
                style={{ cursor: 'pointer' }}
              >
                <div
                  className="content-card-image"
                  style={{
                    background: syl.image_url ? `url(${syl.image_url}) center/cover no-repeat` : gradients[i % gradients.length],
                  }}
                >
                  {!syl.image_url && <span style={{ position: 'relative', zIndex: 2, fontSize: '2.5rem' }}>📋</span>}
                </div>
                <div className="content-card-body">
                  <h3>{syl.name}</h3>
                  {syl.description && <p style={{ marginBottom: '8px' }}>{syl.description}</p>}
                  <div className="flex items-center justify-between mt-sm">
                    <span className="badge badge-primary">
                      🏫 {syl.class_count || 0} class{(syl.class_count || 0) !== 1 ? 'es' : ''}
                    </span>
                    <div className="flex gap-xs">
                      <button className="btn btn-ghost btn-sm" onClick={(e) => openEdit(syl, e)} title="Edit">✏️</button>
                      <button
                        className={`btn btn-sm ${deleteConfirm === syl.id ? 'btn-danger' : 'btn-ghost'}`}
                        onClick={(e) => handleDelete(syl.id, e)}
                      >
                        {deleteConfirm === syl.id ? 'Confirm?' : '🗑️'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editing ? 'Edit Syllabus' : 'Create Syllabus'}</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="input-group">
                <label htmlFor="syl-name">Syllabus Name *</label>
                <input
                  id="syl-name"
                  className="input"
                  placeholder="e.g. CBSE, ICSE, State Board"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="input-group">
                <label htmlFor="syl-desc">Description</label>
                <textarea
                  id="syl-desc"
                  className="input"
                  placeholder="Optional description..."
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>
              <div className="input-group">
                <label htmlFor="syl-image">Image URL</label>
                <input
                  id="syl-image"
                  className="input"
                  placeholder="Optional image URL..."
                  value={form.image_url}
                  onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving || !form.name.trim()}>
                {saving ? 'Saving...' : editing ? 'Update' : 'Create Syllabus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
