'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { XRClass, XRSubject, XRChapter, XRTopic } from '@/lib/xrai-api';

type Level = 'class' | 'subject' | 'chapter' | 'topic';

interface SyncedStatus {
  [id: number]: boolean;
}

export default function XRSyncPage() {
  const supabase = createClient();
  const [level, setLevel] = useState<Level>('class');
  const [loading, setLoading] = useState(true);
  
  // Breadcrumbs
  const [selectedClass, setSelectedClass] = useState<XRClass | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<XRSubject | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<XRChapter | null>(null);

  // Data
  const [classes, setClasses] = useState<XRClass[]>([]);
  const [subjects, setSubjects] = useState<XRSubject[]>([]);
  const [chapters, setChapters] = useState<XRChapter[]>([]);
  const [topics, setTopics] = useState<XRTopic[]>([]);
  
  const [syncedStatus, setSyncedStatus] = useState<SyncedStatus>({});
  
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [syncProgress, setSyncProgress] = useState('');

  const fetchExternalData = async (url: string) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch from XR API');
    return res.json();
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      if (level === 'class') {
        const external = await fetchExternalData('/api/xr/classes');
        const { data: internal } = await supabase.from('xr_classes').select('id');
        setClasses(external);
        
        const status: SyncedStatus = {};
        internal?.forEach(item => { status[item.id] = true; });
        setSyncedStatus(status);
      } 
      else if (level === 'subject' && selectedClass) {
        const external = await fetchExternalData(`/api/xr/subjects?class_id=${selectedClass.id}`);
        const { data: internal } = await supabase.from('xr_subjects').select('id').eq('class_id', selectedClass.id);
        setSubjects(external);
        
        const status: SyncedStatus = {};
        internal?.forEach(item => { status[item.id] = true; });
        setSyncedStatus(status);
      }
      else if (level === 'chapter' && selectedSubject) {
        const external = await fetchExternalData(`/api/xr/chapters?subject_id=${selectedSubject.id}`);
        const { data: internal } = await supabase.from('xr_chapters').select('id').eq('subject_id', selectedSubject.id);
        setChapters(external);
        
        const status: SyncedStatus = {};
        internal?.forEach(item => { status[item.id] = true; });
        setSyncedStatus(status);
      }
      else if (level === 'topic' && selectedChapter) {
        const external = await fetchExternalData(`/api/xr/topics?chapter_id=${selectedChapter.id}`);
        const { data: internal } = await supabase.from('xr_topics').select('id').eq('chapter_id', selectedChapter.id);
        setTopics(external);
        
        const status: SyncedStatus = {};
        internal?.forEach(item => { status[item.id] = true; });
        setSyncedStatus(status);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  }, [level, selectedClass, selectedSubject, selectedChapter, supabase]);

  useEffect(() => {
    if (!isSyncingAll) {
      loadData();
    }
  }, [loadData, isSyncingAll]);

  const syncToDb = async (itemType: Level, data: any | any[]) => {
    const res = await fetch('/api/xr/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: itemType, data })
    });
    if (!res.ok) throw new Error(`Sync failed for ${itemType}`);
  };

  const handleSync = async (itemType: Level, data: any) => {
    try {
      // First optimistic update
      setSyncedStatus(prev => ({ ...prev, [data.id]: true }));
      await syncToDb(itemType, data);
    } catch (error) {
      console.error(error);
      alert('Failed to sync item');
      // Revert optimistic update
      setSyncedStatus(prev => ({ ...prev, [data.id]: false }));
    }
  };

  const handleSyncAll = async () => {
    if (!confirm('This will fetch all classes, subjects, chapters, and topics from the XRAI API and sync them to your database. This may take a minute or two. Proceed?')) {
      return;
    }

    try {
      setIsSyncingAll(true);
      setSyncProgress('Fetching and syncing Classes...');
      
      const allClasses = await fetchExternalData('/api/xr/classes');
      await syncToDb('class', allClasses);

      for (let i = 0; i < allClasses.length; i++) {
        const cls = allClasses[i];
        setSyncProgress(`Syncing Subjects for Class ${i + 1}/${allClasses.length} (${cls.name})...`);
        const subjects = await fetchExternalData(`/api/xr/subjects?class_id=${cls.id}`);
        
        if (subjects.length > 0) {
          const subjectsWithClassId = subjects.map((s: any) => ({ ...s, class_id: cls.id }));
          await syncToDb('subject', subjectsWithClassId);
          
          for (let j = 0; j < subjects.length; j++) {
            const sub = subjects[j];
            setSyncProgress(`Syncing Chapters for Subject ${j + 1}/${subjects.length} (${sub.name})...`);
            const chapters = await fetchExternalData(`/api/xr/chapters?subject_id=${sub.id}`);
            
            if (chapters.length > 0) {
              const chaptersWithSubjectId = chapters.map((c: any) => ({ ...c, subject_id: sub.id }));
              await syncToDb('chapter', chaptersWithSubjectId);
              
              for (let k = 0; k < chapters.length; k++) {
                const chap = chapters[k];
                setSyncProgress(`Syncing Topics for Chapter ${k + 1}/${chapters.length} (${chap.name})...`);
                const topics = await fetchExternalData(`/api/xr/topics?chapter_id=${chap.id}`);
                
                if (topics.length > 0) {
                  const topicsWithChapterId = topics.map((t: any) => ({ ...t, chapter_id: chap.id }));
                  await syncToDb('topic', topicsWithChapterId);
                }
              }
            }
          }
        }
      }

      setSyncProgress('Sync Complete!');
      setTimeout(() => {
        setIsSyncingAll(false);
        setSyncProgress('');
        loadData();
      }, 2000);
      
    } catch (error) {
      console.error('Error during global sync:', error);
      alert('An error occurred during global sync. Please check console.');
      setIsSyncingAll(false);
      setSyncProgress('');
    }
  };

  const navigateToLevel = (newLevel: Level) => {
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

  // Helper to fetch a fresh presigned URL for topics and navigate
  const handlePlayTopic = async (topicId: number, chapterId: number) => {
    try {
      // Fetch fresh topic data from the external API to get a new presigned_url
      const externalTopics = await fetchExternalData(`/api/xr/topics?chapter_id=${chapterId}`);
      const freshTopic = externalTopics.find((t: any) => t.id === topicId);
      if (freshTopic && freshTopic.presigned_url) {
        // Open the internal player route with the fresh content URL
        window.open(`/player?content=${encodeURIComponent(freshTopic.content_url)}`, '_blank');
      } else {
        alert('Could not fetch playable URL.');
      }
    } catch (e) {
      alert('Error loading topic visualization.');
    }
  };

  return (
    <>
      <div className="page-header">
        <div className="breadcrumb mb-sm">
          <span 
            style={{ cursor: 'pointer', color: level === 'class' ? 'var(--neutral-900)' : 'var(--primary-400)' }} 
            onClick={() => navigateToLevel('class')}
          >
            XR Classes
          </span>
          {selectedClass && (
            <>
              <span className="separator"> / </span>
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
              <span className="separator"> / </span>
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
              <span className="separator"> / </span>
              <span className="current">{selectedChapter.name}</span>
            </>
          )}
        </div>
        <div className="flex items-center justify-between mt-sm">
          <h1 style={{ fontSize: '1.5rem' }}>XR Synchronization Dashboard</h1>
          <button 
            className="btn btn-primary" 
            onClick={handleSyncAll}
            disabled={isSyncingAll}
          >
            {isSyncingAll ? 'Syncing...' : '🔄 Sync All Content'}
          </button>
        </div>
        <p className="text-muted text-sm mt-xs">
          Browse external XRAI API content and sync metadata to the local database.
        </p>

        {isSyncingAll && (
          <div style={{ marginTop: '16px', padding: '16px', background: 'var(--primary-50)', borderRadius: '8px', border: '1px solid var(--primary-100)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div className="spinner" style={{ borderColor: 'var(--primary-300)', borderTopColor: 'var(--primary-600)' }}></div>
              <strong style={{ color: 'var(--primary-800)' }}>{syncProgress}</strong>
            </div>
          </div>
        )}
      </div>

      <div className="page-body">
        {loading || isSyncingAll ? (
          <div className="loading-page">
            <div className="spinner spinner-lg" />
            <p className="text-muted">Fetching from XR API...</p>
          </div>
        ) : (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--surface-50)', textAlign: 'left', borderBottom: '1px solid var(--neutral-200)' }}>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Name</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>External ID</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Status</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {level === 'class' && classes.map(cls => (
                  <tr key={cls.id} style={{ borderBottom: '1px solid var(--neutral-100)' }}>
                    <td style={{ padding: '12px 16px', cursor: 'pointer', color: 'var(--primary-600)' }} onClick={() => { setSelectedClass(cls); setLevel('subject'); }}>
                      <strong>{cls.name}</strong>
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--neutral-500)' }}>{cls.id}</td>
                    <td style={{ padding: '12px 16px' }}>
                      {syncedStatus[cls.id] ? <span className="badge badge-accent">✅ Synced</span> : <span className="badge" style={{ background: 'var(--warning-100)', color: 'var(--warning-800)' }}>Unsynced</span>}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      {!syncedStatus[cls.id] && (
                        <button className="btn btn-primary btn-sm" onClick={() => handleSync('class', cls)}>🔄 Sync to DB</button>
                      )}
                    </td>
                  </tr>
                ))}

                {level === 'subject' && subjects.map(sub => (
                  <tr key={sub.id} style={{ borderBottom: '1px solid var(--neutral-100)' }}>
                    <td style={{ padding: '12px 16px', cursor: 'pointer', color: 'var(--primary-600)' }} onClick={() => { setSelectedSubject(sub); setLevel('chapter'); }}>
                      <strong>{sub.name}</strong>
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--neutral-500)' }}>{sub.id}</td>
                    <td style={{ padding: '12px 16px' }}>
                      {syncedStatus[sub.id] ? <span className="badge badge-accent">✅ Synced</span> : <span className="badge" style={{ background: 'var(--warning-100)', color: 'var(--warning-800)' }}>Unsynced</span>}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      {!syncedStatus[sub.id] && (
                        <button className="btn btn-primary btn-sm" onClick={() => handleSync('subject', { ...sub, class_id: selectedClass?.id })}>🔄 Sync to DB</button>
                      )}
                    </td>
                  </tr>
                ))}

                {level === 'chapter' && chapters.map(chap => (
                  <tr key={chap.id} style={{ borderBottom: '1px solid var(--neutral-100)' }}>
                    <td style={{ padding: '12px 16px', cursor: 'pointer', color: 'var(--primary-600)' }} onClick={() => { setSelectedChapter(chap); setLevel('topic'); }}>
                      <strong>{chap.name}</strong>
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--neutral-500)' }}>{chap.id}</td>
                    <td style={{ padding: '12px 16px' }}>
                      {syncedStatus[chap.id] ? <span className="badge badge-accent">✅ Synced</span> : <span className="badge" style={{ background: 'var(--warning-100)', color: 'var(--warning-800)' }}>Unsynced</span>}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      {!syncedStatus[chap.id] && (
                        <button className="btn btn-primary btn-sm" onClick={() => handleSync('chapter', { ...chap, subject_id: selectedSubject?.id })}>🔄 Sync to DB</button>
                      )}
                    </td>
                  </tr>
                ))}

                {level === 'topic' && topics.map(topic => (
                  <tr key={topic.id} style={{ borderBottom: '1px solid var(--neutral-100)' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <strong>{topic.name}</strong>
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--neutral-500)' }}>{topic.id}</td>
                    <td style={{ padding: '12px 16px' }}>
                      {syncedStatus[topic.id] ? <span className="badge badge-accent">✅ Synced</span> : <span className="badge" style={{ background: 'var(--warning-100)', color: 'var(--warning-800)' }}>Unsynced</span>}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <div className="flex gap-sm justify-end">
                        <button className="btn btn-outline btn-sm" onClick={() => handlePlayTopic(topic.id, selectedChapter!.id)}>▶️ Visualize</button>
                        {!syncedStatus[topic.id] && (
                          <button className="btn btn-primary btn-sm" onClick={() => handleSync('topic', { ...topic, chapter_id: selectedChapter?.id })}>🔄 Sync to DB</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            {((level === 'class' && classes.length === 0) || 
              (level === 'subject' && subjects.length === 0) || 
              (level === 'chapter' && chapters.length === 0) || 
              (level === 'topic' && topics.length === 0)) && (
              <div style={{ padding: '32px', textAlign: 'center', color: 'var(--neutral-500)' }}>
                No records found at this level.
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
