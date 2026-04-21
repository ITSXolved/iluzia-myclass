'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

/* ── Types (match XR AI API responses) ── */
interface XRClass   { id: number; name: string; grade: string; description: string }
interface XRSubject { id: number; name: string; class_id: number }
interface XRChapter { id: number; name: string; subject_id: number }
interface XRTopic   { id: number; name: string; chapter_id: number; content_url: string; presigned_url: string }

type View = 'classes' | 'subjects' | 'chapters' | 'topics';
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

export default function StudentExplorePage() {
  const router = useRouter();

  /* ── State ── */
  const [view, setView] = useState<View>('classes');

  const [classes,  setClasses]  = useState<XRClass[]>([]);
  const [subjects, setSubjects] = useState<XRSubject[]>([]);
  const [chapters, setChapters] = useState<XRChapter[]>([]);
  const [topics,   setTopics]   = useState<XRTopic[]>([]);

  const [selClass,   setSelClass]   = useState<XRClass | null>(null);
  const [selSubject, setSelSubject] = useState<XRSubject | null>(null);
  const [selChapter, setSelChapter] = useState<XRChapter | null>(null);

  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  const isPaid = false; // TODO: wire to Supabase profile.is_paid

  /* Track when topics were fetched — presigned_url expires ~1 h */
  const topicsFetchedAt = useRef(0);

  /* ── Generic fetcher (no caching on client — server caches token) ── */
  const fetchJson = useCallback(async <T,>(url: string): Promise<T[]> => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error(`API error ${res.status}`);
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load';
      setError(msg);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  /* ── Lazy loaders (called on user interaction) ── */
  useEffect(() => {
    fetchJson<XRClass>('/api/xr/classes').then(setClasses);
  }, [fetchJson]);

  const openClass = (cls: XRClass) => {
    setSelClass(cls); setSelSubject(null); setSelChapter(null);
    setView('subjects');
    fetchJson<XRSubject>(`/api/xr/subjects?class_id=${cls.id}`).then(setSubjects);
  };

  const openSubject = (sub: XRSubject) => {
    setSelSubject(sub); setSelChapter(null);
    setView('chapters');
    fetchJson<XRChapter>(`/api/xr/chapters?subject_id=${sub.id}`).then(setChapters);
  };

  const openChapter = (ch: XRChapter) => {
    setSelChapter(ch);
    setView('topics');
    topicsFetchedAt.current = Date.now();
    fetchJson<XRTopic>(`/api/xr/topics?chapter_id=${ch.id}`).then(setTopics);
  };

  const goBack = () => {
    if (view === 'topics' && selSubject) {
      setView('chapters');
      fetchJson<XRChapter>(`/api/xr/chapters?subject_id=${selSubject.id}`).then(setChapters);
    } else if (view === 'chapters' && selClass) {
      setView('subjects');
      fetchJson<XRSubject>(`/api/xr/subjects?class_id=${selClass.id}`).then(setSubjects);
    } else {
      setView('classes');
    }
  };

  /* ── Play a topic — open XR AI player in new tab ── */
  const playTopic = async (topic: XRTopic, idx: number) => {
    if (!isPaid && idx >= FREE_LIMIT) return; // locked

    let url = topic.content_url || topic.presigned_url;

    // If more than 50 min since topics were fetched, re-fetch for fresh presigned URL
    if (Date.now() - topicsFetchedAt.current > 50 * 60_000 && selChapter) {
      const fresh = await fetchJson<XRTopic>(`/api/xr/topics?chapter_id=${selChapter.id}`);
      setTopics(fresh);
      topicsFetchedAt.current = Date.now();
      const match = fresh.find(t => t.id === topic.id);
      if (match) url = match.content_url || match.presigned_url;
    }

    if (!url) { setError('No content URL available for this topic'); return; }

    // Use the internal /player page — avoids xraitechnolab.com login requirement
    router.push(`/player?content=${encodeURIComponent(url)}&title=${encodeURIComponent(topic.name)}`);
  };

  /* ── Breadcrumbs ── */
  const crumbs: string[] = ['Explore'];
  if (selClass)   crumbs.push(selClass.name);
  if (selSubject) crumbs.push(selSubject.name);
  if (selChapter) crumbs.push(selChapter.name);

  const heading =
    view === 'classes'  ? 'Select Your Class' :
    view === 'subjects' ? selClass?.name ?? '' :
    view === 'chapters' ? selSubject?.name ?? '' :
    selChapter?.name ?? '';

  /* ── Card component ── */
  const Card = ({ emoji, hue, title, sub, onClick, badge, locked, freeIdx }: {
    emoji: string; hue: number; title: string; sub?: string;
    onClick: () => void; badge?: string; locked?: boolean; freeIdx?: number;
  }) => (
    <div
      onClick={locked ? undefined : onClick}
      role="button" tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && !locked && onClick()}
      className="content-card"
      style={{ position: 'relative', cursor: locked ? 'default' : 'pointer' }}
    >
      {/* lock overlay */}
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

      {/* coloured header */}
      <div className="content-card-image" style={{
        height: 120,
        background: `linear-gradient(135deg, hsl(${hue},55%,24%), hsl(${(hue + 40) % 360},50%,16%))`,
      }}>
        <span style={{ position: 'relative', zIndex: 2, fontSize: '2.5rem',
          filter: 'drop-shadow(0 4px 12px rgba(0,0,0,.35))' }}>
          {locked ? '🔒' : emoji}
        </span>
      </div>

      {/* body */}
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

      {/* ─── Page header ─── */}
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
          {view !== 'classes' && (
            <button className="btn btn-ghost btn-sm" onClick={goBack}>← Back</button>
          )}
          <h1 style={{ fontSize: '1.5rem' }}>{heading}</h1>
        </div>
      </div>

      {/* ─── Page body ─── */}
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
            {/* ── Classes ── */}
            {view === 'classes' && (
              <div className="content-grid">
                {classes.length === 0 ? (
                  <div className="empty-state" style={{ gridColumn: '1/-1' }}>
                    <div className="empty-state-icon">🏫</div>
                    <h3>No classes available</h3>
                    <p>Content is being prepared — check back soon!</p>
                  </div>
                ) : classes.map(cls => (
                  <Card key={cls.id} emoji="🎓" hue={(cls.id * 48) % 360}
                    title={cls.name} sub={cls.description}
                    onClick={() => openClass(cls)} />
                ))}
              </div>
            )}

            {/* ── Subjects (lazy-loaded on class click) ── */}
            {view === 'subjects' && (
              <div className="content-grid">
                {subjects.length === 0 ? (
                  <div className="empty-state" style={{ gridColumn: '1/-1' }}>
                    <div className="empty-state-icon">📖</div>
                    <h3>No subjects yet</h3>
                    <p>Subjects for {selClass?.name} are being added</p>
                  </div>
                ) : subjects.map(s => {
                  const m = meta(s.name);
                  return (
                    <Card key={s.id} emoji={m.emoji} hue={m.hue}
                      title={s.name} sub="View chapters →"
                      onClick={() => openSubject(s)} />
                  );
                })}
              </div>
            )}

            {/* ── Chapters (lazy-loaded on subject click) ── */}
            {view === 'chapters' && (
              <div className="content-grid">
                {chapters.length === 0 ? (
                  <div className="empty-state" style={{ gridColumn: '1/-1' }}>
                    <div className="empty-state-icon">📑</div>
                    <h3>No chapters yet</h3>
                    <p>Chapters for {selSubject?.name} are being synced.
                      Try Class 9 or 10 for full content.</p>
                  </div>
                ) : chapters.map(ch => (
                  <Card key={ch.id} emoji="📑" hue={(ch.id * 55) % 360}
                    title={ch.name} sub="View topics →"
                    onClick={() => openChapter(ch)} />
                ))}
              </div>
            )}

            {/* ── Topics (lazy-loaded on chapter click, always fresh URLs) ── */}
            {view === 'topics' && (
              <>
                {!isPaid && topics.length > FREE_LIMIT && (
                  <div style={{
                    padding: '10px 16px', borderRadius: 10, marginBottom: 18,
                    background: 'rgba(234,179,8,.06)', border: '1px solid rgba(234,179,8,.12)',
                    fontSize: '.83rem', color: 'var(--warning-400)',
                    display: 'flex', alignItems: 'center', gap: 8,
                  }}>
                    💡 First {FREE_LIMIT} topics are free — upgrade for full access
                  </div>
                )}

                <div className="content-grid">
                  {topics.length === 0 ? (
                    <div className="empty-state" style={{ gridColumn: '1/-1' }}>
                      <div className="empty-state-icon">🎯</div>
                      <h3>No topics yet</h3>
                      <p>Topics for this chapter will be available soon</p>
                    </div>
                  ) : topics.map((t, i) => {
                    const locked = !isPaid && i >= FREE_LIMIT;
                    return (
                      <Card key={t.id} emoji="🎯" hue={(t.id * 50) % 360}
                        title={t.name}
                        sub={locked ? 'Premium content' : 'Tap to view 3D content'}
                        badge={locked ? '🔒 Premium' : '▶ Play'}
                        locked={locked} freeIdx={i}
                        onClick={() => playTopic(t, i)} />
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </>
  );
}
