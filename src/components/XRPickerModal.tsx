'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

export interface XRTopicRecord {
  id: number;
  chapter_id: number;
  name: string;
  content_url: string;
}

interface XRPickerModalProps {
  onClose: () => void;
  /** Called with the array of selected topics and the parent chapter id */
  onSelect: (topics: XRTopicRecord[], parentChapterId: number) => void;
}

export default function XRPickerModal({ onClose, onSelect }: XRPickerModalProps) {
  const supabase = createClient();
  const [level, setLevel] = useState<'class' | 'subject' | 'chapter' | 'topic'>('class');
  const [loading, setLoading] = useState(true);

  const [classes, setClasses] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [chapters, setChapters] = useState<any[]>([]);
  const [topics, setTopics] = useState<XRTopicRecord[]>([]);

  const [selectedClass, setSelectedClass] = useState<any | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<any | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<any | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  /** IDs of topics currently checked */
  const [checkedIds, setCheckedIds] = useState<Set<number>>(new Set());

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      if (level === 'class') {
        const { data } = await supabase.from('xr_classes').select('*').order('name');
        setClasses(data || []);
      } else if (level === 'subject' && selectedClass) {
        const { data } = await supabase.from('xr_subjects').select('*').eq('class_id', selectedClass.id).order('name');
        setSubjects(data || []);
      } else if (level === 'chapter' && selectedSubject) {
        const { data } = await supabase.from('xr_chapters').select('*').eq('subject_id', selectedSubject.id).order('name');
        setChapters(data || []);
      } else if (level === 'topic' && selectedChapter) {
        const { data } = await supabase.from('xr_topics').select('*').eq('chapter_id', selectedChapter.id).order('name');
        setTopics(data || []);
        setCheckedIds(new Set()); // reset selection on new topic list
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [level, selectedClass, selectedSubject, selectedChapter, supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const navigateToLevel = (newLevel: 'class' | 'subject' | 'chapter' | 'topic') => {
    if (newLevel === 'class') {
      setSelectedClass(null);
      setSelectedSubject(null);
      setSelectedChapter(null);
    } else if (newLevel === 'subject') {
      setSelectedSubject(null);
      setSelectedChapter(null);
    } else if (newLevel === 'chapter') {
      setSelectedChapter(null);
    }
    setCheckedIds(new Set());
    setLevel(newLevel);
  };

  const handlePreview = async (topicId: number, chapterId: number) => {
    try {
      const res = await fetch(`/api/xr/topics?chapter_id=${chapterId}`);
      if (!res.ok) throw new Error('Failed to fetch from XR API');
      const externalTopics = await res.json();
      const freshTopic = externalTopics.find((t: any) => t.id === topicId);
      if (freshTopic && freshTopic.presigned_url) {
        setPreviewUrl(`/player?content=${encodeURIComponent(freshTopic.content_url)}`);
      } else {
        alert('Could not fetch playable URL from XRAI.');
      }
    } catch (e) {
      alert('Error loading topic visualization.');
    }
  };

  /* ── Multi-select helpers ── */
  const toggleCheck = (id: number) => {
    setCheckedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const allChecked = topics.length > 0 && checkedIds.size === topics.length;
  const someChecked = checkedIds.size > 0 && !allChecked;

  const toggleAll = () => {
    if (allChecked) {
      setCheckedIds(new Set());
    } else {
      setCheckedIds(new Set(topics.map(t => t.id)));
    }
  };

  const handleAddSelected = () => {
    const selected = topics.filter(t => checkedIds.has(t.id));
    if (selected.length === 0) return;
    onSelect(selected, selectedChapter.id);
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 300 }}>
      <div
        className="modal"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: '600px', width: '100%', display: 'flex', flexDirection: 'column', maxHeight: '80vh' }}
      >
        {/* Header */}
        <div className="modal-header" style={{ flexShrink: 0 }}>
          <h2>Select XR Content</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>

        {/* Breadcrumbs */}
        <div style={{ flexShrink: 0, padding: '10px 16px', background: 'var(--surface-50)', borderBottom: '1px solid var(--surface-glass-border)' }}>
          <div className="breadcrumb" style={{ fontSize: '0.8rem', margin: 0 }}>
            <span
              style={{ cursor: 'pointer', color: level === 'class' ? 'var(--neutral-900)' : 'var(--primary-400)' }}
              onClick={() => navigateToLevel('class')}
            >
              Classes
            </span>
            {selectedClass && (
              <>
                <span className="separator" style={{ margin: '0 4px' }}>/</span>
                <span
                  style={{ cursor: 'pointer', color: level === 'subject' ? 'var(--neutral-900)' : 'var(--primary-400)' }}
                  onClick={() => navigateToLevel('subject')}
                >
                  {selectedClass.name}
                </span>
              </>
            )}
            {selectedSubject && (
              <>
                <span className="separator" style={{ margin: '0 4px' }}>/</span>
                <span
                  style={{ cursor: 'pointer', color: level === 'chapter' ? 'var(--neutral-900)' : 'var(--primary-400)' }}
                  onClick={() => navigateToLevel('chapter')}
                >
                  {selectedSubject.name}
                </span>
              </>
            )}
            {selectedChapter && (
              <>
                <span className="separator" style={{ margin: '0 4px' }}>/</span>
                <span className="current" style={{ color: 'var(--neutral-900)' }}>
                  {selectedChapter.name}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Select All bar — only at topic level */}
        {level === 'topic' && !loading && topics.length > 0 && (
          <div
            style={{
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '8px 16px',
              borderBottom: '1px solid var(--surface-glass-border)',
              background: 'var(--surface-card)',
            }}
          >
            <input
              type="checkbox"
              id="xr-select-all"
              checked={allChecked}
              ref={el => { if (el) el.indeterminate = someChecked; }}
              onChange={toggleAll}
              style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: 'var(--primary-400)' }}
            />
            <label htmlFor="xr-select-all" style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--neutral-300)', cursor: 'pointer', userSelect: 'none' }}>
              {allChecked ? 'Deselect All' : 'Select All'} ({topics.length})
            </label>
            {checkedIds.size > 0 && (
              <span style={{
                marginLeft: 'auto', fontSize: '0.75rem', fontWeight: 700,
                padding: '2px 10px', borderRadius: '50px',
                background: 'rgba(124,58,237,0.15)', color: 'var(--primary-300)',
              }}>
                {checkedIds.size} selected
              </span>
            )}
          </div>
        )}

        {/* Scrollable list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
          {loading ? (
            <div style={{ padding: '24px', textAlign: 'center' }}>
              <div className="spinner" />
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {level === 'class' && classes.map(cls => (
                <div
                  key={cls.id}
                  onClick={() => { setSelectedClass(cls); setLevel('subject'); }}
                  style={{ padding: '12px 16px', border: '1px solid var(--surface-glass-border)', borderRadius: '8px', cursor: 'pointer', background: 'var(--surface-50)' }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--primary-300)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--surface-glass-border)'}
                >
                  <strong>{cls.name}</strong>
                </div>
              ))}

              {level === 'subject' && subjects.map(sub => (
                <div
                  key={sub.id}
                  onClick={() => { setSelectedSubject(sub); setLevel('chapter'); }}
                  style={{ padding: '12px 16px', border: '1px solid var(--surface-glass-border)', borderRadius: '8px', cursor: 'pointer', background: 'var(--surface-50)' }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--primary-300)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--surface-glass-border)'}
                >
                  <strong>{sub.name}</strong>
                </div>
              ))}

              {level === 'chapter' && chapters.map(chap => (
                <div
                  key={chap.id}
                  onClick={() => { setSelectedChapter(chap); setLevel('topic'); }}
                  style={{ padding: '12px 16px', border: '1px solid var(--surface-glass-border)', borderRadius: '8px', cursor: 'pointer', background: 'var(--surface-50)' }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--primary-300)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--surface-glass-border)'}
                >
                  <strong>{chap.name}</strong>
                </div>
              ))}

              {level === 'topic' && topics.map(topic => {
                const isChecked = checkedIds.has(topic.id);
                return (
                  <div
                    key={topic.id}
                    onClick={() => toggleCheck(topic.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '12px 16px',
                      border: `1px solid ${isChecked ? 'var(--primary-400)' : 'var(--surface-glass-border)'}`,
                      borderRadius: '8px',
                      background: isChecked ? 'rgba(124,58,237,0.07)' : 'var(--surface-50)',
                      cursor: 'pointer',
                      transition: 'all 150ms',
                    }}
                  >
                    {/* Checkbox */}
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleCheck(topic.id)}
                      onClick={e => e.stopPropagation()}
                      style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: 'var(--primary-400)', flexShrink: 0 }}
                    />

                    <strong style={{ flex: 1, color: isChecked ? 'var(--primary-300)' : 'var(--neutral-100)', fontSize: '0.9rem' }}>
                      {topic.name}
                    </strong>

                    {/* Play button */}
                    <button
                      onClick={e => { e.stopPropagation(); handlePreview(topic.id, selectedChapter.id); }}
                      style={{
                        background: 'linear-gradient(90deg, #8b5cf6, #0ea5e9)',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '50px',
                        padding: '6px 14px',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        cursor: 'pointer',
                        boxShadow: '0 4px 10px -2px rgba(139, 92, 246, 0.5)',
                        flexShrink: 0,
                      }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                      Play
                    </button>
                  </div>
                );
              })}

              {((level === 'class' && classes.length === 0) ||
                (level === 'subject' && subjects.length === 0) ||
                (level === 'chapter' && chapters.length === 0) ||
                (level === 'topic' && topics.length === 0)) && (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--neutral-500)' }}>
                  No synchronized content found at this level.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sticky footer — only on topic level */}
        {level === 'topic' && (
          <div
            style={{
              flexShrink: 0,
              padding: '14px 16px',
              borderTop: '1px solid var(--surface-glass-border)',
              background: 'var(--surface-card)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '10px',
            }}
          >
            <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
            <button
              className="btn btn-primary btn-sm"
              disabled={checkedIds.size === 0}
              onClick={handleAddSelected}
              style={{
                opacity: checkedIds.size === 0 ? 0.45 : 1,
                transition: 'opacity 150ms',
                minWidth: '140px',
              }}
            >
              ➕ Add Selected ({checkedIds.size})
            </button>
          </div>
        )}
      </div>

      {/* Fullscreen Iframe Preview */}
      {previewUrl && (
        <div className="modal-overlay" onClick={() => setPreviewUrl(null)} style={{ zIndex: 400, padding: '24px' }}>
          <div
            onClick={e => e.stopPropagation()}
            style={{ width: '100%', height: '100%', background: '#000', borderRadius: '16px', overflow: 'hidden', position: 'relative', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.7)' }}
          >
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '12px 20px', background: 'linear-gradient(rgba(0,0,0,0.8), transparent)', display: 'flex', justifyContent: 'flex-end', zIndex: 10 }}>
              <button className="btn btn-ghost btn-icon" onClick={() => setPreviewUrl(null)} style={{ color: '#fff', background: 'rgba(255,255,255,0.1)', borderRadius: '50%' }}>✕</button>
            </div>
            <iframe src={previewUrl} style={{ width: '100%', height: '100%', border: 'none' }} allowFullScreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" />
          </div>
        </div>
      )}
    </div>
  );
}
