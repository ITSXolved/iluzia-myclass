'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import MCQManager from '@/components/MCQManager';
import XRPickerModal, { XRTopicRecord } from '@/components/XRPickerModal';

interface Chapter { id: number; name: string; description: string | null; sort_order: number; }
interface Topic { id: number; chapter_id: number; name: string; description: string | null; sort_order: number; }
interface Material { id: number; topic_id: number; title: string; type: string; url: string; description: string | null; sort_order: number; }

const MATERIAL_TYPES = [
  { value: 'iframe', label: 'Iframe Embed', icon: '🌐' },
  { value: 'video', label: 'Video', icon: '🎬' },
  { value: 'youtube', label: 'YouTube', icon: '▶️' },
  { value: 'xr', label: 'XR Experiential Content', icon: '🥽' },
  { value: 'pdf', label: 'PDF Document', icon: '📄' },
  { value: 'link', label: 'External Link', icon: '🔗' },
  { value: 'document', label: 'Document', icon: '📝' },
];

export default function LMSContentManager() {
  const supabase = createClient();
  const params = useParams();
  const syllabusId = Number(params.syllabusId);
  const classId = Number(params.classId);
  const subjectId = Number(params.subjectId);

  const [syllabusName, setSyllabusName] = useState('');
  const [className, setClassName] = useState('');
  const [subjectName, setSubjectName] = useState('');
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedChapters, setExpandedChapters] = useState<Set<number>>(new Set());
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);

  const [chapterModal, setChapterModal] = useState(false);
  const [topicModal, setTopicModal] = useState(false);
  const [materialModal, setMaterialModal] = useState(false);
  const [editingChapter, setEditingChapter] = useState<Chapter | null>(null);
  const [editingTopic, setEditingTopic] = useState<Topic | null>(null);
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
  const [targetChapterId, setTargetChapterId] = useState<number | null>(null);
  const [chapterForm, setChapterForm] = useState({ name: '', description: '' });
  const [topicForm, setTopicForm] = useState({ name: '', description: '' });
  const [materialForm, setMaterialForm] = useState({ title: '', type: 'iframe', url: '', description: '' });
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [previewMaterial, setPreviewMaterial] = useState<Material | null>(null);
  const [mcqBulkTrigger, setMcqBulkTrigger] = useState(0);
  const [resourcePickerModal, setResourcePickerModal] = useState(false);
  const [xrPickerModal, setXrPickerModal] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [sylRes, clsRes, subRes, chapRes] = await Promise.all([
      supabase.from('syllabuses').select('name').eq('id', syllabusId).single(),
      supabase.from('classes').select('name').eq('id', classId).single(),
      supabase.from('subjects').select('name').eq('id', subjectId).single(),
      supabase.from('chapters').select('*').eq('subject_id', subjectId).order('sort_order'),
    ]);
    if (sylRes.data) setSyllabusName(sylRes.data.name);
    if (clsRes.data) setClassName(clsRes.data.name);
    if (subRes.data) setSubjectName(subRes.data.name);
    const chaps = chapRes.data || [];
    setChapters(chaps);
    if (chaps.length > 0) {
      const ids = chaps.map((c: Chapter) => c.id);
      const { data: allTopics } = await supabase.from('topics').select('*').in('chapter_id', ids).order('sort_order');
      setTopics(allTopics || []);
      setExpandedChapters(new Set([chaps[0].id]));
    } else { setTopics([]); }
    setLoading(false);
  }, [supabase, syllabusId, classId, subjectId]);

  useEffect(() => { loadAll(); }, [loadAll]);

  useEffect(() => {
    if (!selectedTopic) { setMaterials([]); return; }
    (async () => {
      const { data } = await supabase.from('materials').select('*').eq('topic_id', selectedTopic.id).order('sort_order');
      setMaterials(data || []);
    })();
  }, [selectedTopic, supabase]);

  const toggleChapter = (id: number) => {
    setExpandedChapters(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  // Chapter CRUD
  const saveChapter = async () => {
    if (!chapterForm.name.trim()) return;
    setSaving(true);
    const payload = { name: chapterForm.name.trim(), description: chapterForm.description.trim() || null, subject_id: subjectId, sort_order: editingChapter ? editingChapter.sort_order : chapters.length };
    if (editingChapter) await supabase.from('chapters').update(payload).eq('id', editingChapter.id);
    else await supabase.from('chapters').insert(payload);
    setSaving(false); setChapterModal(false); loadAll();
  };
  const deleteChapter = async (id: number) => {
    const key = `ch-${id}`;
    if (deleteConfirm === key) { await supabase.from('chapters').delete().eq('id', id); setDeleteConfirm(null); if (selectedTopic && topics.find(t => t.chapter_id === id && t.id === selectedTopic.id)) setSelectedTopic(null); loadAll(); }
    else { setDeleteConfirm(key); setTimeout(() => setDeleteConfirm(null), 3000); }
  };

  // Topic CRUD
  const saveTopic = async () => {
    if (!topicForm.name.trim() || !targetChapterId) return;
    setSaving(true);
    const ct = topics.filter(t => t.chapter_id === targetChapterId);
    const payload = { name: topicForm.name.trim(), description: topicForm.description.trim() || null, chapter_id: targetChapterId, sort_order: editingTopic ? editingTopic.sort_order : ct.length };
    if (editingTopic) await supabase.from('topics').update(payload).eq('id', editingTopic.id);
    else await supabase.from('topics').insert(payload);
    setSaving(false); setTopicModal(false); loadAll();
  };
  const deleteTopic = async (id: number) => {
    const key = `tp-${id}`;
    if (deleteConfirm === key) { await supabase.from('topics').delete().eq('id', id); setDeleteConfirm(null); if (selectedTopic?.id === id) setSelectedTopic(null); loadAll(); }
    else { setDeleteConfirm(key); setTimeout(() => setDeleteConfirm(null), 3000); }
  };

  // Material CRUD
  const saveMaterial = async () => {
    if (!materialForm.title.trim() || !materialForm.url.trim() || !selectedTopic) return;
    setSaving(true);
    const payload = { title: materialForm.title.trim(), type: materialForm.type, url: materialForm.url.trim(), description: materialForm.description.trim() || null, topic_id: selectedTopic.id, sort_order: editingMaterial ? editingMaterial.sort_order : materials.length };
    if (editingMaterial) await supabase.from('materials').update(payload).eq('id', editingMaterial.id);
    else await supabase.from('materials').insert(payload);
    setSaving(false); setMaterialModal(false);
    const { data } = await supabase.from('materials').select('*').eq('topic_id', selectedTopic.id).order('sort_order');
    setMaterials(data || []);
  };
  const deleteMaterial = async (id: number) => {
    const key = `mt-${id}`;
    if (deleteConfirm === key) { await supabase.from('materials').delete().eq('id', id); setDeleteConfirm(null); if (selectedTopic) { const { data } = await supabase.from('materials').select('*').eq('topic_id', selectedTopic.id).order('sort_order'); setMaterials(data || []); } }
    else { setDeleteConfirm(key); setTimeout(() => setDeleteConfirm(null), 3000); }
  };

  const getMaterialIcon = (type: string) => MATERIAL_TYPES.find(t => t.value === type)?.icon || '📎';

  const canPreview = (type: string) => ['iframe', 'video', 'youtube', 'pdf', 'xr'].includes(type);

  const handlePreview = async (mat: Material) => {
    if (mat.type === 'xr') {
      try {
        const { topic_id, chapter_id } = JSON.parse(mat.url);
        const res = await fetch(`/api/xr/topics?chapter_id=${chapter_id}`);
        if (!res.ok) throw new Error('Failed to fetch from XR API');
        const externalTopics = await res.json();
        const freshTopic = externalTopics.find((t: any) => t.id === topic_id);
        if (freshTopic && freshTopic.presigned_url) {
          window.open(`/player?content=${encodeURIComponent(freshTopic.content_url)}`, '_blank');
        } else {
          alert('Could not fetch playable URL from XRAI.');
        }
      } catch (e) {
        alert('Error loading XR topic visualization.');
      }
    } else {
      setPreviewMaterial(mat);
    }
  };

  const getPreviewUrl = (mat: Material) => {
    if (mat.type === 'youtube') {
      // Convert youtube watch URLs to embed URLs
      const url = mat.url;
      const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
      if (match) return `https://www.youtube.com/embed/${match[1]}`;
      // Already an embed URL
      if (url.includes('youtube.com/embed/')) return url;
    }
    return mat.url;
  };

  if (loading) return <div className="loading-page"><div className="spinner spinner-lg" /><p className="text-muted">Loading content...</p></div>;

  return (
    <>
      <div className="page-header">
        <div className="breadcrumb mb-sm">
          <Link href="/admin/courses" style={{ color: 'var(--primary-400)' }}>Courses</Link>
          <span className="separator"> / </span>
          <Link href={`/admin/courses/${syllabusId}`} style={{ color: 'var(--primary-400)' }}>{syllabusName}</Link>
          <span className="separator"> / </span>
          <Link href={`/admin/courses/${syllabusId}/${classId}`} style={{ color: 'var(--primary-400)' }}>{className}</Link>
          <span className="separator"> / </span>
          <span className="current">{subjectName}</span>
        </div>
        <div className="flex items-center gap-md">
          <Link href={`/admin/courses/${syllabusId}/${classId}`} className="btn btn-ghost btn-sm">← Back</Link>
          <h1 style={{ fontSize: '1.35rem' }}>{subjectName} — Content Manager</h1>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '24px', minHeight: 'calc(100vh - 140px)' }}>
        {/* Left Column: Chapters & Topics */}
        <div style={{ flex: '1 1 60%', minWidth: 0 }}>
          {chapters.length === 0 ? (
            <div style={{ padding: '48px 16px', textAlign: 'center', color: 'var(--neutral-500)' }}>
              <p style={{ marginBottom: '12px' }}>No chapters yet. Start building your course.</p>
            </div>
          ) : chapters.map(ch => {
            const chTopics = topics.filter(t => t.chapter_id === ch.id);
            const isExp = expandedChapters.has(ch.id);
            return (
              <div key={ch.id} style={{
                background: 'var(--surface-card)', border: '1px solid var(--surface-glass-border)',
                borderRadius: '14px', marginBottom: '12px', overflow: 'hidden',
              }}>
                {/* Chapter header */}
                <div style={{
                  padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px', cursor: 'pointer',
                  background: isExp ? 'rgba(124,58,237,0.04)' : 'transparent',
                }} onClick={() => toggleChapter(ch.id)}>
                  <div style={{
                    width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(124,58,237,0.12)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', flexShrink: 0,
                  }}>📘</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--neutral-100)' }}>{ch.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--neutral-500)', marginTop: '2px' }}>
                      {chTopics.length} topic{chTopics.length !== 1 ? 's' : ''}
                    </div>
                  </div>
                  <div className="flex gap-xs" onClick={e => e.stopPropagation()}>
                    <button className="btn btn-ghost" style={{ padding: '4px 6px', fontSize: '0.75rem' }}
                      onClick={() => { setEditingChapter(ch); setChapterForm({ name: ch.name, description: ch.description || '' }); setChapterModal(true); }}>✏️</button>
                    <button className={`btn ${deleteConfirm === `ch-${ch.id}` ? 'btn-danger' : 'btn-ghost'}`}
                      style={{ padding: '4px 6px', fontSize: '0.75rem' }}
                      onClick={() => deleteChapter(ch.id)}>
                      {deleteConfirm === `ch-${ch.id}` ? '⚠' : '🗑️'}
                    </button>
                  </div>
                  <span style={{
                    fontSize: '0.75rem', color: 'var(--neutral-500)', transition: 'transform 200ms',
                    transform: isExp ? 'rotate(180deg)' : 'rotate(0deg)',
                  }}>⌃</span>
                </div>

                {/* Expanded topics */}
                {isExp && (
                  <div style={{ borderTop: '1px solid var(--surface-glass-border)', padding: '8px 12px 12px' }}>
                    {chTopics.map((topic, ti) => (
                      <div key={topic.id} style={{ marginBottom: '4px' }}>
                        <div
                          style={{
                            display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px',
                            borderRadius: '10px', cursor: 'pointer',
                            background: selectedTopic?.id === topic.id ? 'rgba(6,182,212,0.1)' : 'rgba(148,163,184,0.03)',
                            border: `1px solid ${selectedTopic?.id === topic.id ? 'rgba(6,182,212,0.25)' : 'transparent'}`,
                            transition: 'all 150ms',
                          }}
                          onClick={() => setSelectedTopic(selectedTopic?.id === topic.id ? null : topic)}>
                          <span style={{
                            width: '26px', height: '26px', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 700,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: selectedTopic?.id === topic.id ? 'rgba(6,182,212,0.2)' : 'rgba(148,163,184,0.08)',
                            color: selectedTopic?.id === topic.id ? 'var(--accent-400)' : 'var(--neutral-400)',
                          }}>{String(ti + 1).padStart(2, '0')}</span>
                          <span style={{
                            flex: 1, fontSize: '0.88rem',
                            fontWeight: selectedTopic?.id === topic.id ? 600 : 400,
                            color: selectedTopic?.id === topic.id ? 'var(--accent-400)' : 'var(--neutral-200)',
                          }}>{topic.name}</span>
                          <div className="flex gap-xs" onClick={e => e.stopPropagation()}>
                            <button className="btn btn-ghost" style={{ padding: '2px 4px', fontSize: '0.65rem', opacity: 0.5 }}
                              onClick={() => { setTargetChapterId(topic.chapter_id); setEditingTopic(topic); setTopicForm({ name: topic.name, description: topic.description || '' }); setTopicModal(true); }}>✏️</button>
                            <button className={`btn ${deleteConfirm === `tp-${topic.id}` ? 'btn-danger' : 'btn-ghost'}`}
                              style={{ padding: '2px 4px', fontSize: '0.65rem', opacity: 0.5 }}
                              onClick={() => deleteTopic(topic.id)}>
                              {deleteConfirm === `tp-${topic.id}` ? '⚠' : '🗑️'}
                            </button>
                          </div>
                          <span style={{ fontSize: '0.6rem', color: 'var(--neutral-500)', transition: 'transform 200ms', transform: selectedTopic?.id === topic.id ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
                        </div>
                        {/* Inline content under selected topic */}
                        {selectedTopic?.id === topic.id && (
                          <div style={{ marginLeft: '36px', marginTop: '6px', marginBottom: '8px', padding: '12px 16px', borderRadius: '10px', background: 'rgba(6,182,212,0.03)', borderLeft: '2px solid rgba(6,182,212,0.2)' }}>
                            {materials.length > 0 && (
                              <div style={{ marginBottom: '12px' }}>
                                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--neutral-500)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>📎 Materials ({materials.length})</div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                  {materials.map(mat => (
                                    <div key={mat.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', borderRadius: '8px', background: 'rgba(148,163,184,0.04)', border: '1px solid rgba(148,163,184,0.06)' }}>
                                      <span style={{ fontSize: '0.9rem' }}>{getMaterialIcon(mat.type)}</span>
                                      <span style={{ flex: 1, fontSize: '0.82rem', color: 'var(--neutral-200)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{mat.title}</span>
                                      <span className="badge" style={{ fontSize: '0.55rem', padding: '1px 5px', background: 'rgba(124,58,237,0.1)', color: 'var(--primary-300)' }}>{mat.type}</span>
                                      <div className="flex gap-xs">
                                        {canPreview(mat.type) && <button className="btn btn-ghost" style={{ padding: '1px 3px', fontSize: '0.6rem' }} onClick={() => handlePreview(mat)}>▶️</button>}
                                        <button className="btn btn-ghost" style={{ padding: '1px 3px', fontSize: '0.6rem' }} onClick={() => { setEditingMaterial(mat); setMaterialForm({ title: mat.title, type: mat.type, url: mat.url, description: mat.description || '' }); setMaterialModal(true); }}>✏️</button>
                                        <button className={`btn ${deleteConfirm === `mt-${mat.id}` ? 'btn-danger' : 'btn-ghost'}`} style={{ padding: '1px 3px', fontSize: '0.6rem' }} onClick={() => deleteMaterial(mat.id)}>{deleteConfirm === `mt-${mat.id}` ? '⚠' : '🗑️'}</button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            <MCQManager topicId={topic.id} topicName={topic.name} bulkTrigger={mcqBulkTrigger} />
                            {materials.length === 0 && <p style={{ fontSize: '0.78rem', color: 'var(--neutral-500)', textAlign: 'center', padding: '8px 0' }}>No content yet. Click below to add.</p>}
                            <div style={{ marginTop: '12px', textAlign: 'center' }}>
                              <button className="btn btn-ghost btn-sm" style={{ color: 'var(--primary-400)', fontSize: '0.8rem', padding: '6px 12px' }} onClick={() => setResourcePickerModal(true)}>
                                + Add Materials / Quizzes
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                    <button className="btn btn-ghost btn-sm" style={{
                      color: 'var(--primary-400)', fontSize: '0.8rem', padding: '6px 12px', marginTop: '4px',
                    }} onClick={() => { setTargetChapterId(ch.id); setEditingTopic(null); setTopicForm({ name: '', description: '' }); setTopicModal(true); }}>
                      + Add Topic
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          {/* Add New Chapter card */}
          <div
            onClick={() => { setEditingChapter(null); setChapterForm({ name: '', description: '' }); setChapterModal(true); }}
            style={{
              border: '2px dashed var(--surface-glass-border)', borderRadius: '14px',
              padding: '28px', textAlign: 'center', cursor: 'pointer',
              color: 'var(--neutral-500)', transition: 'all 200ms',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary-400)'; e.currentTarget.style.color = 'var(--primary-400)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--surface-glass-border)'; e.currentTarget.style.color = 'var(--neutral-500)'; }}>
            <div style={{ fontSize: '1.5rem', marginBottom: '6px' }}>⊕</div>
            <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Add New Chapter</div>
          </div>
        </div>

      </div>

      {/* Resource Picker Modal */}
      {resourcePickerModal && (
        <div className="modal-overlay" onClick={() => setResourcePickerModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h2>Add Content</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setResourcePickerModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              {/* Learning Resources Grid */}
              <div style={{ marginBottom: '20px' }}>
                <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--neutral-500)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '14px' }}>
                  Learning Resources
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                  {MATERIAL_TYPES.map(t => (
                    <button key={t.value}
                      onClick={() => { 
                        setResourcePickerModal(false); 
                        if (t.value === 'xr') {
                          setXrPickerModal(true);
                        } else {
                          setEditingMaterial(null); 
                          setMaterialForm({ title: '', type: t.value, url: '', description: '' }); 
                          setMaterialModal(true); 
                        }
                      }}
                      style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
                        padding: '14px 8px', borderRadius: '12px', cursor: 'pointer',
                        background: 'rgba(148,163,184,0.04)', border: '1px solid var(--surface-glass-border)',
                        color: 'var(--neutral-300)', transition: 'all 150ms', fontSize: '0.75rem', fontWeight: 600,
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(124,58,237,0.08)'; e.currentTarget.style.borderColor = 'rgba(124,58,237,0.2)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(148,163,184,0.04)'; e.currentTarget.style.borderColor = 'var(--surface-glass-border)'; }}>
                      <span style={{ fontSize: '1.4rem' }}>{t.icon}</span>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Assessment Types */}
              <div>
                <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--neutral-500)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '14px' }}>
                  Assessment Types
                </div>
                <button
                  onClick={() => { setResourcePickerModal(false); setMcqBulkTrigger(t => t + 1); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px', width: '100%',
                    borderRadius: '10px', cursor: 'pointer', textAlign: 'left',
                    background: 'rgba(148,163,184,0.04)', border: '1px solid var(--surface-glass-border)',
                    transition: 'all 150ms',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(34,197,94,0.06)'; e.currentTarget.style.borderColor = 'rgba(34,197,94,0.15)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(148,163,184,0.04)'; e.currentTarget.style.borderColor = 'var(--surface-glass-border)'; }}>
                  <span style={{
                    width: '34px', height: '34px', borderRadius: '8px', background: 'rgba(34,197,94,0.1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', flexShrink: 0,
                  }}>📝</span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--neutral-100)' }}>Formative Quiz</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--neutral-500)' }}>Auto-grading MCQs</div>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Chapter Modal */}
      {chapterModal && (
        <div className="modal-overlay" onClick={() => setChapterModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h2>{editingChapter ? 'Edit Chapter' : 'Add Chapter'}</h2><button className="btn btn-ghost btn-icon" onClick={() => setChapterModal(false)}>✕</button></div>
            <div className="modal-body">
              <div className="input-group"><label>Chapter Name *</label><input className="input" placeholder="e.g. Algebra Basics" value={chapterForm.name} onChange={e => setChapterForm({ ...chapterForm, name: e.target.value })} /></div>
              <div className="input-group"><label>Description</label><textarea className="input" placeholder="Optional..." value={chapterForm.description} onChange={e => setChapterForm({ ...chapterForm, description: e.target.value })} /></div>
            </div>
            <div className="modal-footer"><button className="btn btn-ghost" onClick={() => setChapterModal(false)}>Cancel</button><button className="btn btn-primary" onClick={saveChapter} disabled={saving || !chapterForm.name.trim()}>{saving ? 'Saving...' : editingChapter ? 'Update' : 'Add Chapter'}</button></div>
          </div>
        </div>
      )}
      {/* Topic Modal */}
      {topicModal && (
        <div className="modal-overlay" onClick={() => setTopicModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h2>{editingTopic ? 'Edit Topic' : 'Add Topic'}</h2><button className="btn btn-ghost btn-icon" onClick={() => setTopicModal(false)}>✕</button></div>
            <div className="modal-body">
              <div className="input-group"><label>Topic Name *</label><input className="input" placeholder="e.g. Variables" value={topicForm.name} onChange={e => setTopicForm({ ...topicForm, name: e.target.value })} /></div>
              <div className="input-group"><label>Description</label><textarea className="input" placeholder="Optional..." value={topicForm.description} onChange={e => setTopicForm({ ...topicForm, description: e.target.value })} /></div>
            </div>
            <div className="modal-footer"><button className="btn btn-ghost" onClick={() => setTopicModal(false)}>Cancel</button><button className="btn btn-primary" onClick={saveTopic} disabled={saving || !topicForm.name.trim()}>{saving ? 'Saving...' : editingTopic ? 'Update' : 'Add Topic'}</button></div>
          </div>
        </div>
      )}
      {/* Material Modal */}
      {materialModal && (
        <div className="modal-overlay" onClick={() => setMaterialModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h2>{editingMaterial ? 'Edit Material' : 'Add Material'}</h2><button className="btn btn-ghost btn-icon" onClick={() => setMaterialModal(false)}>✕</button></div>
            <div className="modal-body">
              <div className="input-group"><label>Title *</label><input className="input" placeholder="e.g. Introduction Video" value={materialForm.title} onChange={e => setMaterialForm({ ...materialForm, title: e.target.value })} /></div>
              <div className="input-group"><label>Type *</label><select className="input" value={materialForm.type} onChange={e => setMaterialForm({ ...materialForm, type: e.target.value })}>{MATERIAL_TYPES.map(t => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}</select></div>
              <div className="input-group"><label>URL *</label><input className="input" placeholder="https://..." value={materialForm.url} onChange={e => setMaterialForm({ ...materialForm, url: e.target.value })} /></div>
              <div className="input-group"><label>Description</label><textarea className="input" placeholder="Optional..." value={materialForm.description} onChange={e => setMaterialForm({ ...materialForm, description: e.target.value })} /></div>
            </div>
            <div className="modal-footer"><button className="btn btn-ghost" onClick={() => setMaterialModal(false)}>Cancel</button><button className="btn btn-primary" onClick={saveMaterial} disabled={saving || !materialForm.title.trim() || !materialForm.url.trim()}>{saving ? 'Saving...' : editingMaterial ? 'Update' : 'Add Material'}</button></div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewMaterial && (
        <div className="modal-overlay" onClick={() => setPreviewMaterial(null)} style={{ padding: '24px', zIndex: 200 }}>
          <div onClick={e => e.stopPropagation()} style={{
            width: '100%', maxWidth: '1100px', height: '85vh',
            background: 'var(--neutral-850)', border: '1px solid var(--surface-glass-border)',
            borderRadius: 'var(--radius-xl)', overflow: 'hidden', display: 'flex', flexDirection: 'column',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.7)',
          }}>
            {/* Preview Header */}
            <div style={{
              padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              borderBottom: '1px solid var(--surface-glass-border)', background: 'rgba(15,23,42,0.5)',
            }}>
              <div className="flex items-center gap-md">
                <span style={{ fontSize: '1.2rem' }}>{getMaterialIcon(previewMaterial.type)}</span>
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--neutral-100)', fontSize: '0.95rem' }}>{previewMaterial.title}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--neutral-500)' }}>{previewMaterial.type.toUpperCase()} preview</div>
                </div>
              </div>
              <div className="flex gap-sm">
                <a href={previewMaterial.url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">Open in new tab 🔗</a>
                <button className="btn btn-ghost btn-icon" onClick={() => setPreviewMaterial(null)} style={{ fontSize: '1.1rem' }}>✕</button>
              </div>
            </div>
            {/* Preview Content */}
            <div style={{ flex: 1, position: 'relative', background: '#000' }}>
              {previewMaterial.type === 'video' ? (
                <video
                  src={previewMaterial.url}
                  controls
                  autoPlay
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
              ) : (
                <iframe
                  src={getPreviewUrl(previewMaterial)}
                  style={{ width: '100%', height: '100%', border: 'none' }}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                  allowFullScreen
                  title={previewMaterial.title}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* XR Content Picker Modal */}
      {xrPickerModal && (
        <XRPickerModal 
          onClose={() => setXrPickerModal(false)} 
          onSelect={(topic: XRTopicRecord, chapterId: number) => {
            setXrPickerModal(false);
            setEditingMaterial(null);
            // Save immediately or open standard material modal to let them edit the title?
            // Let's open the material modal prefilled so they can review/edit.
            // Notice we save the topic_id AND chapter_id in the url as a JSON string so we can fetch it later, 
            // OR just rely on topic.id since `/api/xr/topics?chapter_id=X` requires chapter_id.
            // Actually, we can just save it as `topicId:chapterId` or a stringified JSON object.
            setMaterialForm({ 
              title: topic.name, 
              type: 'xr', 
              url: JSON.stringify({ topic_id: topic.id, chapter_id: chapterId }), 
              description: 'XR Experiential Learning Content' 
            });
            setMaterialModal(true);
          }} 
        />
      )}
    </>
  );
}
