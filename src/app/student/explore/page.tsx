'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import MCQManager from '@/components/MCQManager';

/* ── Types (match local DB schema) ── */
interface Subject { id: number; name: string; description?: string; image_url?: string; }
interface Chapter { id: number; name: string; description?: string; }
interface Topic { id: number; name: string; description?: string; chapter_id: number; }
interface Material { id: number; title: string; type: string; url: string; description?: string; topic_id: number; sort_order: number; }

type View = 'subjects' | 'subject_content';
const FREE_LIMIT = 3;

/* ── Subject appearance ── */
const SUBJECT_META: Record<string, { emoji: string; hue: number }> = {
  biology:    { emoji: '🧬', hue: 140 },
  botany:     { emoji: '🌿', hue: 130 },
  botony:     { emoji: '🌿', hue: 130 },
  chemistry:  { emoji: '🧪', hue: 200 },
  physics:    { emoji: '⚡', hue: 45 },
  zoology:    { emoji: '🦁', hue: 20 },
  mathematics:{ emoji: '📐', hue: 270 },
  maths:      { emoji: '📐', hue: 270 },
  english:    { emoji: '📝', hue: 320 },
  geography:  { emoji: '🌍', hue: 170 },
  history:    { emoji: '🏛️', hue: 30 },
  computer:   { emoji: '💻', hue: 210 },
};
function meta(name: string) {
  const l = name.toLowerCase();
  for (const [k, v] of Object.entries(SUBJECT_META)) { if (l.includes(k)) return v; }
  return { emoji: '📖', hue: 220 };
}

const MATERIAL_TYPES = [
  { value: 'iframe', label: 'Iframe Embed', icon: '🌐' },
  { value: 'video', label: 'Video', icon: '🎬' },
  { value: 'youtube', label: 'YouTube', icon: '▶️' },
  { value: 'xr', label: 'XR Experiential Content', icon: '🥽' },
  { value: 'pdf', label: 'PDF Document', icon: '📄' },
  { value: 'link', label: 'External Link', icon: '🔗' },
  { value: 'document', label: 'Document', icon: '📝' },
];
const getMaterialIcon = (type: string) => MATERIAL_TYPES.find(t => t.value === type)?.icon || '📎';

export default function StudentExplorePage() {
  const router = useRouter();
  const supabase = createClient();

  /* ── State ── */
  const [view, setView] = useState<View>('subjects');

  const [classId, setClassId] = useState<number | null>(null);
  const [className, setClassName] = useState<string>('');
  
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [topics,   setTopics]   = useState<Topic[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);

  const [expandedChapters, setExpandedChapters] = useState<Set<number>>(new Set());

  const [selSubject, setSelSubject] = useState<Subject | null>(null);
  const [selTopic, setSelTopic] = useState<Topic | null>(null);

  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [previewMaterial, setPreviewMaterial] = useState<Material | null>(null);

  const [isPaid, setIsPaid] = useState(false);

  /* ── Initialization ── */
  useEffect(() => {
    async function init() {
      setLoading(true);
      setError('');
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const { data: profile, error: pErr } = await supabase
            .from('profiles')
            .select('class_id, is_paid, classes(name, class_number)')
            .eq('id', session.user.id)
            .single();

          if (pErr) {
            setError(`Profile error: ${pErr.message}`);
            return;
          }

          setIsPaid(profile?.is_paid || false);

          if (profile?.class_id) {
            setClassId(profile.class_id);
            const classesData = profile.classes as any;
            if (classesData?.name) setClassName(classesData.name);
            
            // Load subjects for this class
            const { data: subs } = await supabase
              .from('subjects')
              .select('*')
              .eq('class_id', profile.class_id)
              .order('sort_order');
              
            setSubjects(subs || []);
          } else {
            setError('You are not enrolled in any class. Please update your profile.');
          }
        } else {
          setError('Please log in to view your curriculum.');
        }
      } catch (err) {
        console.error('Failed to load curriculum:', err);
        setError('Failed to load curriculum.');
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [supabase]);

  /* ── Navigation ── */
  const openSubject = async (sub: Subject) => {
    setSelSubject(sub);
    setSelTopic(null);
    setView('subject_content');
    setLoading(true);
    const { data: chaps } = await supabase.from('chapters').select('*').eq('subject_id', sub.id).order('sort_order');
    setChapters(chaps || []);
    if (chaps && chaps.length > 0) {
      const ids = chaps.map(c => c.id);
      const { data: allTopics } = await supabase.from('topics').select('*').in('chapter_id', ids).order('sort_order');
      setTopics(allTopics || []);
      setExpandedChapters(new Set([chaps[0].id]));
    } else {
      setTopics([]);
    }
    setLoading(false);
  };

  const toggleChapter = (id: number) => {
    setExpandedChapters(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  useEffect(() => {
    if (!selTopic) { setMaterials([]); return; }
    (async () => {
      const { data } = await supabase.from('materials').select('*').eq('topic_id', selTopic.id).order('sort_order');
      setMaterials(data || []);
    })();
  }, [selTopic, supabase]);

  const goBack = () => {
    if (view === 'subject_content') {
      setView('subjects');
      setSelSubject(null);
      setSelTopic(null);
    } else {
      router.push('/student');
    }
  };

  /* ── Play Material ── */
  const canPreview = (type: string) => ['iframe', 'video', 'youtube', 'pdf', 'xr'].includes(type);

  const handlePreview = async (mat: Material, idx: number) => {
    if (!isPaid && idx >= FREE_LIMIT) return; // locked

    // Track progress
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      try {
        await supabase.from('student_progress').insert({
          user_id: session.user.id,
          material_id: mat.id
        });
      } catch (err) { /* ignore unique constraint */ }
    }

    if (mat.type === 'xr') {
      try {
        const { topic_id, chapter_id } = JSON.parse(mat.url);
        const res = await fetch(`/api/xr/topics?chapter_id=${chapter_id}`);
        if (!res.ok) throw new Error('Failed to fetch from XR API');
        const externalTopics = await res.json();
        const freshTopic = externalTopics.find((t: any) => t.id === topic_id);
        if (freshTopic && (freshTopic.content_url || freshTopic.presigned_url)) {
          const url = freshTopic.content_url || freshTopic.presigned_url;
          router.push(`/player?content=${encodeURIComponent(url)}&title=${encodeURIComponent(mat.title)}`);
        } else {
          alert('Could not fetch playable URL from XRAI.');
        }
      } catch (e) {
        alert('Error loading XR visualization.');
      }
    } else if (mat.type === 'link') {
      window.open(mat.url, '_blank');
    } else {
      setPreviewMaterial(mat);
    }
  };

  const getPreviewUrl = (mat: Material) => {
    if (mat.type === 'youtube') {
      const url = mat.url;
      const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
      if (match) return `https://www.youtube.com/embed/${match[1]}`;
      if (url.includes('youtube.com/embed/')) return url;
    }
    return mat.url;
  };

  /* ── Breadcrumbs ── */
  const crumbs: string[] = ['Curriculum'];
  if (className) crumbs.push(className);
  if (selSubject) crumbs.push(selSubject.name);

  const heading =
    view === 'subjects' ? 'Select Subject' :
    view === 'subject_content' ? `${selSubject?.name} — Course Material` :
    '';

  /* ── Card component ── */
  const Card = ({ emoji, hue, image_url, title, sub, onClick, badge, locked, freeIdx }: {
    emoji: string; hue: number; image_url?: string; title: string; sub?: string;
    onClick: () => void; badge?: string; locked?: boolean; freeIdx?: number;
  }) => (
    <div
      onClick={locked ? undefined : onClick}
      role="button" tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && !locked && onClick()}
      className="content-card"
      style={{ position: 'relative', cursor: locked ? 'default' : 'pointer' }}
    >
      {locked && (
        <Link href="/payment" style={{
          position: 'absolute', inset: 0, zIndex: 10, borderRadius: 18,
          background: 'rgba(2,6,23,.78)', backdropFilter: 'blur(5px)',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', gap: 6, textDecoration: 'none',
        }}>
          <span style={{ fontSize: '1.8rem', animation: 'pulse 2s infinite' }}>🔒</span>
          <span style={{ fontSize: '.8rem', color: 'var(--neutral-300)', fontWeight: 600 }}>
            Unlock — ₹2,499/year
          </span>
        </Link>
      )}

      <div className="content-card-image" style={{
        height: 120,
        background: image_url ? `url(${image_url}) center/cover no-repeat` : `linear-gradient(135deg, hsl(${hue},55%,24%), hsl(${(hue + 40) % 360},50%,16%))`,
      }}>
        {!image_url && (
          <span style={{ position: 'relative', zIndex: 2, fontSize: '2.5rem',
            filter: 'drop-shadow(0 4px 12px rgba(0,0,0,.35))' }}>
            {locked ? '🔒' : emoji}
          </span>
        )}
      </div>

      <div className="content-card-body">
        <h3>{title}</h3>
        {sub && <p>{sub}</p>}
        {badge && (
          <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <span className={`badge ${locked ? 'badge-warning' : 'badge-accent'}`}>{badge}</span>
            {freeIdx !== undefined && freeIdx < FREE_LIMIT && !isPaid && (
              <span className="badge badge-success">FREE</span>
            )}
          </div>
        )}
      </div>
    </div>
  );

  /* ── Render ── */
  return (
    <>
      <div className="page-header">
        <div className="breadcrumb mb-sm">
          {crumbs.map((c, i) => (
            <span key={i}>
              {i > 0 && <span className="separator">&nbsp;/&nbsp;</span>}
              <span className={i === crumbs.length - 1 ? 'current' : ''}>{c}</span>
            </span>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn-ghost btn-sm" onClick={goBack}>← Back</button>
          <h1 style={{ fontSize: '1.5rem' }}>{heading}</h1>
        </div>
      </div>

      <div className="page-body">
        {error && (
          <div style={{
            padding: '12px 16px', borderRadius: 10, marginBottom: 20,
            background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.18)',
            color: 'var(--error-400)', fontSize: '.85rem',
          }}>⚠ {error}</div>
        )}

        {loading ? (
          <div className="empty-state">
            <div className="spinner spinner-lg" />
            <p className="text-muted mt-md">Loading content…</p>
          </div>
        ) : (
          <>
            {/* ── Subjects Grid ── */}
            {view === 'subjects' && (
              <div className="content-grid">
                {subjects.length === 0 ? (
                  <div className="empty-state" style={{ gridColumn: '1/-1' }}>
                    <div className="empty-state-icon">📖</div>
                    <h3>No subjects yet</h3>
                    <p>Subjects for your enrolled class are being added.</p>
                  </div>
                ) : subjects.map(s => {
                  const m = meta(s.name);
                  return (
                    <Card key={s.id} emoji={m.emoji} hue={m.hue} image_url={s.image_url}
                      title={s.name} sub="View chapters →"
                      onClick={() => openSubject(s)} />
                  );
                })}
              </div>
            )}

            {/* ── Subject Content (Admin-like Accordion) ── */}
            {view === 'subject_content' && (
              <div style={{ display: 'flex', gap: '24px', minHeight: 'calc(100vh - 140px)' }}>
                <div style={{ flex: '1 1 60%', minWidth: 0 }}>
                  {chapters.length === 0 ? (
                    <div style={{ padding: '48px 16px', textAlign: 'center', color: 'var(--neutral-500)' }}>
                      <p style={{ marginBottom: '12px' }}>No chapters available yet.</p>
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
                                    background: selTopic?.id === topic.id ? 'rgba(6,182,212,0.1)' : 'rgba(148,163,184,0.03)',
                                    border: `1px solid ${selTopic?.id === topic.id ? 'rgba(6,182,212,0.25)' : 'transparent'}`,
                                    transition: 'all 150ms',
                                  }}
                                  onClick={() => setSelTopic(selTopic?.id === topic.id ? null : topic)}>
                                  <span style={{
                                    width: '26px', height: '26px', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 700,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    background: selTopic?.id === topic.id ? 'rgba(6,182,212,0.2)' : 'rgba(148,163,184,0.08)',
                                    color: selTopic?.id === topic.id ? 'var(--accent-400)' : 'var(--neutral-400)',
                                  }}>{String(ti + 1).padStart(2, '0')}</span>
                                  <span style={{
                                    flex: 1, fontSize: '0.88rem',
                                    fontWeight: selTopic?.id === topic.id ? 600 : 400,
                                    color: selTopic?.id === topic.id ? 'var(--accent-400)' : 'var(--neutral-200)',
                                  }}>{topic.name}</span>
                                  <span style={{ fontSize: '0.6rem', color: 'var(--neutral-500)', transition: 'transform 200ms', transform: selTopic?.id === topic.id ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
                                </div>
                                {/* Inline content under selected topic */}
                                {selTopic?.id === topic.id && (
                                  <div style={{ marginLeft: '36px', marginTop: '6px', marginBottom: '8px', padding: '12px 16px', borderRadius: '10px', background: 'rgba(6,182,212,0.03)', borderLeft: '2px solid rgba(6,182,212,0.2)' }}>
                                    
                                    {!isPaid && materials.length > FREE_LIMIT && (
                                      <div style={{
                                        padding: '8px 12px', borderRadius: '8px', marginBottom: '12px',
                                        background: 'rgba(234,179,8,.06)', border: '1px solid rgba(234,179,8,.12)',
                                        fontSize: '.75rem', color: 'var(--warning-400)',
                                        display: 'flex', alignItems: 'center', gap: 8,
                                      }}>
                                        💡 First {FREE_LIMIT} materials are free — upgrade for full access
                                      </div>
                                    )}

                                    {materials.length > 0 && (
                                      <div style={{ marginBottom: '12px' }}>
                                        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--neutral-500)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>📎 Materials ({materials.length})</div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                          {materials.map((mat, i) => {
                                            const locked = !isPaid && i >= FREE_LIMIT;
                                            return (
                                              <div key={mat.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', borderRadius: '8px', background: 'rgba(148,163,184,0.04)', border: '1px solid rgba(148,163,184,0.06)' }}>
                                                <span style={{ fontSize: '0.9rem' }}>{locked ? '🔒' : getMaterialIcon(mat.type)}</span>
                                                <span style={{ flex: 1, fontSize: '0.82rem', color: 'var(--neutral-200)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{mat.title}</span>
                                                <span className={`badge ${locked ? 'badge-warning' : ''}`} style={{ fontSize: '0.55rem', padding: '1px 5px', background: locked ? undefined : 'rgba(124,58,237,0.1)', color: locked ? undefined : 'var(--primary-300)' }}>
                                                  {locked ? 'Premium' : mat.type}
                                                </span>
                                                <div className="flex gap-xs">
                                                  {canPreview(mat.type) && (
                                                    <button 
                                                      onClick={() => locked ? router.push('/payment') : handlePreview(mat, i)}
                                                      style={{ 
                                                        background: locked ? 'var(--surface-border)' : 'linear-gradient(90deg, #8b5cf6, #0ea5e9)', 
                                                        color: locked ? 'var(--neutral-400)' : '#fff', 
                                                        border: 'none', 
                                                        borderRadius: '50px', 
                                                        padding: '4px 14px', 
                                                        fontSize: '0.75rem', 
                                                        fontWeight: 600, 
                                                        display: 'flex', 
                                                        alignItems: 'center', 
                                                        gap: '6px', 
                                                        cursor: 'pointer',
                                                        boxShadow: locked ? 'none' : '0 4px 10px -2px rgba(139, 92, 246, 0.5)'
                                                      }}
                                                    >
                                                      {locked ? '🔒 Unlock' : <><svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg> Play</>}
                                                    </button>
                                                  )}
                                                  {!canPreview(mat.type) && !locked && (
                                                    <button onClick={() => handlePreview(mat, i)} className="btn btn-ghost btn-sm" style={{ padding: '2px 8px', fontSize: '0.7rem' }}>🔗 Open</button>
                                                  )}
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    )}
                                    <MCQManager topicId={topic.id} topicName={topic.name} readOnly={true} />
                                    {materials.length === 0 && <p style={{ fontSize: '0.78rem', color: 'var(--neutral-500)', textAlign: 'center', padding: '8px 0' }}>No materials available yet.</p>}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Preview Modal for iframes, videos, pdfs */}
      {previewMaterial && (
        <div className="modal-overlay" onClick={() => setPreviewMaterial(null)} style={{ padding: '24px', zIndex: 200 }}>
          <div onClick={e => e.stopPropagation()} style={{
            width: '100%', maxWidth: '1100px', height: '85vh',
            background: 'var(--neutral-850)', border: '1px solid var(--surface-glass-border)',
            borderRadius: 'var(--radius-xl)', overflow: 'hidden', display: 'flex', flexDirection: 'column',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.7)',
          }}>
            {/* Header */}
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
            {/* Content */}
            <div style={{ flex: 1, position: 'relative', background: '#000' }}>
              {previewMaterial.type === 'video' ? (
                <video src={previewMaterial.url} controls autoPlay style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
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
    </>
  );
}
