'use client';

import { useEffect, useState, useCallback } from 'react';

interface ClassItem {
  id: number;
  name: string;
  class_number?: number;
}

interface SubjectItem {
  id: number;
  name: string;
  class_id: number;
}

interface ChapterItem {
  id: number;
  name: string;
  subject_id: number;
}

interface TopicItem {
  id: number;
  name: string;
  chapter_id: number;
  content_url?: string;
  presigned_url?: string;
}

type ActiveView = 'classes' | 'subjects' | 'chapters' | 'topics';

export default function AdminContentPage() {
  const [activeView, setActiveView] = useState<ActiveView>('classes');
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [chapters, setChapters] = useState<ChapterItem[]>([]);
  const [topics, setTopics] = useState<TopicItem[]>([]);

  const [selectedClass, setSelectedClass] = useState<ClassItem | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<SubjectItem | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<ChapterItem | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Load classes from XR AI API
  const loadClasses = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/xr/classes');
      if (!res.ok) throw new Error('Failed to load classes');
      const data = await res.json();
      setClasses(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load classes');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSubjects = useCallback(async (classId: number) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/xr/subjects?class_id=${classId}`);
      if (!res.ok) throw new Error('Failed to load subjects');
      const data = await res.json();
      setSubjects(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load subjects');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadChapters = useCallback(async (subjectId: number) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/xr/chapters?subject_id=${subjectId}`);
      if (!res.ok) throw new Error('Failed to load chapters');
      const data = await res.json();
      setChapters(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load chapters');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadTopics = useCallback(async (chapterId: number) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/xr/topics?chapter_id=${chapterId}`);
      if (!res.ok) throw new Error('Failed to load topics');
      const data = await res.json();
      setTopics(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load topics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadClasses();
  }, [loadClasses]);

  const handleClassSelect = (cls: ClassItem) => {
    setSelectedClass(cls);
    setSelectedSubject(null);
    setSelectedChapter(null);
    setActiveView('subjects');
    loadSubjects(cls.id);
  };

  const handleSubjectSelect = (subject: SubjectItem) => {
    setSelectedSubject(subject);
    setSelectedChapter(null);
    setActiveView('chapters');
    loadChapters(subject.id);
  };

  const handleChapterSelect = (chapter: ChapterItem) => {
    setSelectedChapter(chapter);
    setActiveView('topics');
    loadTopics(chapter.id);
  };

  const handleBack = () => {
    if (activeView === 'topics') {
      setActiveView('chapters');
      if (selectedSubject) loadChapters(selectedSubject.id);
    } else if (activeView === 'chapters') {
      setActiveView('subjects');
      if (selectedClass) loadSubjects(selectedClass.id);
    } else if (activeView === 'subjects') {
      setActiveView('classes');
      loadClasses();
    }
  };

  const openPlayer = (topic: TopicItem) => {
    const contentUrl = topic.content_url || topic.presigned_url;
    if (contentUrl) {
      window.open(`/player?content=${encodeURIComponent(contentUrl)}`, '_blank');
    }
  };

  const getBreadcrumb = () => {
    const parts: string[] = ['Content'];
    if (selectedClass) parts.push(`Class ${selectedClass.name}`);
    if (selectedSubject) parts.push(selectedSubject.name);
    if (selectedChapter) parts.push(selectedChapter.name);
    return parts;
  };

  const getTitle = () => {
    switch (activeView) {
      case 'classes': return 'Classes';
      case 'subjects': return `Subjects — Class ${selectedClass?.name}`;
      case 'chapters': return `Chapters — ${selectedSubject?.name}`;
      case 'topics': return `Topics — ${selectedChapter?.name}`;
    }
  };

  const getEmoji = () => {
    switch (activeView) {
      case 'classes': return '🏫';
      case 'subjects': return '📖';
      case 'chapters': return '📑';
      case 'topics': return '🎯';
    }
  };

  return (
    <>
      <div className="page-header">
        <div className="breadcrumb mb-sm">
          {getBreadcrumb().map((part, i) => (
            <span key={i}>
              {i > 0 && <span className="separator"> / </span>}
              {i === getBreadcrumb().length - 1 ? (
                <span className="current">{part}</span>
              ) : (
                <span>{part}</span>
              )}
            </span>
          ))}
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-md">
            {activeView !== 'classes' && (
              <button className="btn btn-ghost btn-sm" onClick={handleBack}>
                ← Back
              </button>
            )}
            <h1 style={{ fontSize: '1.5rem' }}>{getTitle()}</h1>
          </div>
        </div>
      </div>

      <div className="page-body">
        {error && (
          <div className="auth-error" style={{
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            borderRadius: 'var(--radius-md)',
            padding: '12px 16px',
            color: 'var(--error-400)',
            fontSize: '0.85rem',
            marginBottom: '20px',
          }}>
            ⚠ {error}
          </div>
        )}

        {loading ? (
          <div className="empty-state">
            <div className="spinner spinner-lg" />
            <p className="text-muted mt-md">Loading content from XR AI...</p>
          </div>
        ) : (
          <>
            {/* Classes View */}
            {activeView === 'classes' && (
              <div className="content-grid">
                {classes.length === 0 ? (
                  <div className="empty-state" style={{ gridColumn: '1 / -1' }}>
                    <div className="empty-state-icon">🏫</div>
                    <h3>No classes available</h3>
                    <p>Classes are fetched from the XR AI content platform. Contact XR AI to sync content.</p>
                  </div>
                ) : (
                  classes.map((cls) => (
                    <div key={cls.id} className="content-card" onClick={() => handleClassSelect(cls)}>
                      <div className="content-card-image" style={{
                        background: `linear-gradient(135deg, hsl(${(cls.id * 40) % 360}, 60%, 30%), hsl(${(cls.id * 40 + 60) % 360}, 60%, 20%))`,
                      }}>
                        <span style={{ position: 'relative', zIndex: 2 }}>🏫</span>
                      </div>
                      <div className="content-card-body">
                        <h3>Class {cls.name}</h3>
                        <p>Tap to view subjects</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Subjects View */}
            {activeView === 'subjects' && (
              <div className="content-grid">
                {subjects.length === 0 ? (
                  <div className="empty-state" style={{ gridColumn: '1 / -1' }}>
                    <div className="empty-state-icon">📖</div>
                    <h3>No subjects found</h3>
                    <p>No subjects available for this class</p>
                  </div>
                ) : (
                  subjects.map((subject) => (
                    <div key={subject.id} className="content-card" onClick={() => handleSubjectSelect(subject)}>
                      <div className="content-card-image" style={{
                        background: `linear-gradient(135deg, hsl(${(subject.id * 55) % 360}, 65%, 28%), hsl(${(subject.id * 55 + 80) % 360}, 55%, 18%))`,
                      }}>
                        <span style={{ position: 'relative', zIndex: 2 }}>📖</span>
                      </div>
                      <div className="content-card-body">
                        <h3>{subject.name}</h3>
                        <p>Explore chapters →</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Chapters View */}
            {activeView === 'chapters' && (
              <div className="content-grid">
                {chapters.length === 0 ? (
                  <div className="empty-state" style={{ gridColumn: '1 / -1' }}>
                    <div className="empty-state-icon">📑</div>
                    <h3>No chapters found</h3>
                    <p>No chapters available for this subject</p>
                  </div>
                ) : (
                  chapters.map((chapter) => (
                    <div key={chapter.id} className="content-card" onClick={() => handleChapterSelect(chapter)}>
                      <div className="content-card-image" style={{
                        background: `linear-gradient(135deg, hsl(${(chapter.id * 70) % 360}, 55%, 30%), hsl(${(chapter.id * 70 + 90) % 360}, 50%, 20%))`,
                      }}>
                        <span style={{ position: 'relative', zIndex: 2 }}>📑</span>
                      </div>
                      <div className="content-card-body">
                        <h3>{chapter.name}</h3>
                        <p>View topics →</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Topics View */}
            {activeView === 'topics' && (
              <div className="content-grid">
                {topics.length === 0 ? (
                  <div className="empty-state" style={{ gridColumn: '1 / -1' }}>
                    <div className="empty-state-icon">{getEmoji()}</div>
                    <h3>No topics found</h3>
                    <p>No topics available for this chapter</p>
                  </div>
                ) : (
                  topics.map((topic) => (
                    <div key={topic.id} className="content-card" onClick={() => openPlayer(topic)}>
                      <div className="content-card-image" style={{
                        background: `linear-gradient(135deg, hsl(${(topic.id * 45) % 360}, 60%, 28%), hsl(${(topic.id * 45 + 100) % 360}, 55%, 18%))`,
                      }}>
                        <span style={{ position: 'relative', zIndex: 2 }}>🎯</span>
                      </div>
                      <div className="content-card-body">
                        <h3>{topic.name}</h3>
                        <div className="flex items-center gap-sm mt-sm">
                          <span className="badge badge-accent">3D Content</span>
                          {(topic.content_url || topic.presigned_url) && (
                            <span className="badge badge-success">▶ Play</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
