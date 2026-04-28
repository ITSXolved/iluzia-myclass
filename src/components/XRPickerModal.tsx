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
  onSelect: (topic: XRTopicRecord, parentChapterId: number) => void;
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
    setLevel(newLevel);
  };

  const handlePreview = async (topicId: number, chapterId: number) => {
    try {
      // Need fresh presigned_url to play
      const res = await fetch(`/api/xr/topics?chapter_id=${chapterId}`);
      if (!res.ok) throw new Error('Failed to fetch from XR API');
      const externalTopics = await res.json();
      const freshTopic = externalTopics.find((t: any) => t.id === topicId);
      if (freshTopic && freshTopic.presigned_url) {
        window.open(`/player?content=${encodeURIComponent(freshTopic.content_url)}`, '_blank');
      } else {
        alert('Could not fetch playable URL from XRAI.');
      }
    } catch (e) {
      alert('Error loading topic visualization.');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 300 }}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px', width: '100%' }}>
        <div className="modal-header">
          <h2>Select XR Content</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>
        
        <div className="modal-body" style={{ padding: '0', maxHeight: '60vh', overflowY: 'auto' }}>
          {/* Breadcrumbs */}
          <div style={{ padding: '12px 16px', background: 'var(--surface-50)', borderBottom: '1px solid var(--surface-glass-border)' }}>
            <div className="breadcrumb" style={{ fontSize: '0.8rem', margin: 0 }}>
              <span style={{ cursor: 'pointer', color: level === 'class' ? 'var(--neutral-900)' : 'var(--primary-400)' }} onClick={() => navigateToLevel('class')}>
                Classes
              </span>
              {selectedClass && (
                <>
                  <span className="separator" style={{ margin: '0 4px' }}>/</span>
                  <span style={{ cursor: 'pointer', color: level === 'subject' ? 'var(--neutral-900)' : 'var(--primary-400)' }} onClick={() => navigateToLevel('subject')}>
                    {selectedClass.name}
                  </span>
                </>
              )}
              {selectedSubject && (
                <>
                  <span className="separator" style={{ margin: '0 4px' }}>/</span>
                  <span style={{ cursor: 'pointer', color: level === 'chapter' ? 'var(--neutral-900)' : 'var(--primary-400)' }} onClick={() => navigateToLevel('chapter')}>
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

          <div style={{ padding: '16px' }}>
            {loading ? (
              <div style={{ padding: '24px', textAlign: 'center' }}>
                <div className="spinner"></div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {level === 'class' && classes.map(cls => (
                  <div key={cls.id} onClick={() => { setSelectedClass(cls); setLevel('subject'); }}
                    style={{ padding: '12px 16px', border: '1px solid var(--surface-glass-border)', borderRadius: '8px', cursor: 'pointer', background: 'var(--surface-50)' }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--primary-300)'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--surface-glass-border)'}>
                    <strong>{cls.name}</strong>
                  </div>
                ))}
                
                {level === 'subject' && subjects.map(sub => (
                  <div key={sub.id} onClick={() => { setSelectedSubject(sub); setLevel('chapter'); }}
                    style={{ padding: '12px 16px', border: '1px solid var(--surface-glass-border)', borderRadius: '8px', cursor: 'pointer', background: 'var(--surface-50)' }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--primary-300)'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--surface-glass-border)'}>
                    <strong>{sub.name}</strong>
                  </div>
                ))}

                {level === 'chapter' && chapters.map(chap => (
                  <div key={chap.id} onClick={() => { setSelectedChapter(chap); setLevel('topic'); }}
                    style={{ padding: '12px 16px', border: '1px solid var(--surface-glass-border)', borderRadius: '8px', cursor: 'pointer', background: 'var(--surface-50)' }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--primary-300)'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--surface-glass-border)'}>
                    <strong>{chap.name}</strong>
                  </div>
                ))}

                {level === 'topic' && topics.map(topic => (
                  <div key={topic.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', border: '1px solid var(--surface-glass-border)', borderRadius: '8px', background: 'var(--surface-50)' }}>
                    <strong>{topic.name}</strong>
                    <div className="flex gap-sm">
                      <button className="btn btn-outline btn-sm" onClick={(e) => { e.stopPropagation(); handlePreview(topic.id, selectedChapter.id); }}>
                        ▶️ View
                      </button>
                      <button className="btn btn-primary btn-sm" onClick={(e) => { e.stopPropagation(); onSelect(topic, selectedChapter.id); }}>
                        ➕ Add
                      </button>
                    </div>
                  </div>
                ))}

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
        </div>
      </div>
    </div>
  );
}
