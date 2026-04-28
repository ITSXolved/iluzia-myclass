'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { motion } from 'framer-motion';

export default function StudentDashboard() {
  const [userName, setUserName] = useState('Student');
  const [isPaid, setIsPaid] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Real stats
  const [activeTimeMins, setActiveTimeMins] = useState(0);
  const [masteryAvg, setMasteryAvg] = useState(0);
  const [streak, setStreak] = useState(0);
  const [overallProgress, setOverallProgress] = useState(0);
  
  const [subjects, setSubjects] = useState<{ id: number; name: string; progress: number; color: string }[]>([]);
  const [topicBasket, setTopicBasket] = useState<{ topic_id: number; name: string; avg_score: number }[]>([]);
  const [classRank, setClassRank] = useState<{ rank: number; total: number } | null>(null);

  // Badges state
  const [badges, setBadges] = useState([
    { id: 'quick_starter', icon: '🌟', title: 'Quick Starter', desc: 'Complete 3 materials', unlocked: false },
    { id: 'on_fire', icon: '🔥', title: 'On Fire', desc: '3-day learning streak', unlocked: false },
    { id: 'sharpshooter', icon: '🎯', title: 'Sharpshooter', desc: '100% on any Quiz', unlocked: false },
    { id: 'scholar', icon: '👑', title: 'Top Scholar', desc: '80%+ average mastery', unlocked: false },
  ]);

  useEffect(() => {
    async function init() {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        setLoading(false);
        return;
      }

      // 1. Fetch profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, username, is_paid, class_id')
        .eq('id', session.user.id)
        .single();
        
      if (profile) {
        setUserName(profile.full_name || profile.username || 'Student');
        setIsPaid(profile.is_paid || false);
        
        // 2. Fetch Active Time & Calculate Streak
        const { data: sessions } = await supabase
          .from('student_active_time')
          .select('duration_minutes, session_date')
          .eq('user_id', session.user.id)
          .order('session_date', { ascending: false });
          
        let totalMins = 0;
        let currentStreak = 0;
        
        if (sessions && sessions.length > 0) {
          totalMins = sessions.reduce((acc, s) => acc + s.duration_minutes, 0);
          
          // Basic streak calculation (consecutive days)
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          let checkDate = new Date(today);
          
          // Check if there is a session today or yesterday to start streak
          const dates = new Set(sessions.map(s => s.session_date));
          const todayStr = checkDate.toISOString().split('T')[0];
          
          let yesterday = new Date(checkDate);
          yesterday.setDate(yesterday.getDate() - 1);
          const yesterdayStr = yesterday.toISOString().split('T')[0];

          if (dates.has(todayStr) || dates.has(yesterdayStr)) {
            let curr = dates.has(todayStr) ? checkDate : yesterday;
            while (true) {
              const dStr = curr.toISOString().split('T')[0];
              if (dates.has(dStr)) {
                currentStreak++;
                curr.setDate(curr.getDate() - 1);
              } else {
                break;
              }
            }
          }
        }
        setActiveTimeMins(totalMins);
        setStreak(currentStreak);

        // 3. Fetch Quiz Scores for Mastery & Topic Basket
        const { data: scores } = await supabase
          .from('student_quiz_scores')
          .select('score, total, topic_id, topics(name)')
          .eq('user_id', session.user.id);

        let sumPct = 0;
        let hasPerfectQuiz = false;
        const topicScores: Record<number, { name: string; sumScore: number; sumTotal: number }> = {};

        if (scores && scores.length > 0) {
          scores.forEach(s => {
            const pct = (s.score / s.total) * 100;
            sumPct += pct;
            if (pct === 100) hasPerfectQuiz = true;

            const tName = s.topics ? (s.topics as any).name : 'Unknown Topic';
            if (!topicScores[s.topic_id]) {
              topicScores[s.topic_id] = { name: tName, sumScore: 0, sumTotal: 0 };
            }
            topicScores[s.topic_id].sumScore += s.score;
            topicScores[s.topic_id].sumTotal += s.total;
          });
          
          const overallAvg = Math.round(sumPct / scores.length);
          setMasteryAvg(overallAvg);

          // Build Topic Basket (>= 80% avg)
          const basket = Object.values(topicScores).map(t => ({
            topic_id: 0,
            name: t.name,
            avg_score: Math.round((t.sumScore / t.sumTotal) * 100)
          })).filter(t => t.avg_score >= 80);
          setTopicBasket(basket);
        }

        // 4. Fetch Progress (Subject Completion)
        // For accurate tracking, we fetch all subjects and their topics/materials in this class
        let totalClassMaterials = 0;
        let completedClassMaterials = 0;

        if (profile.class_id) {
          // Fetch completed material IDs
          const { data: progressList } = await supabase
            .from('student_progress')
            .select('material_id')
            .eq('user_id', session.user.id);
            
          const completedIds = new Set((progressList || []).map(p => p.material_id));

          // Fetch subjects
          const { data: subs } = await supabase
            .from('subjects')
            .select('id, name')
            .eq('class_id', profile.class_id)
            .order('sort_order');
            
          if (subs) {
            const colors = ['#8b5cf6', '#0ea5e9', '#10b981', '#f59e0b', '#ec4899', '#6366f1'];
            const subData = [];
            
            for (let i = 0; i < subs.length; i++) {
              const s = subs[i];
              // Get materials for this subject
              // subjects -> chapters -> topics -> materials
              const { data: chaps } = await supabase.from('chapters').select('id').eq('subject_id', s.id);
              if (chaps && chaps.length > 0) {
                const chapIds = chaps.map(c => c.id);
                const { data: tops } = await supabase.from('topics').select('id').in('chapter_id', chapIds);
                if (tops && tops.length > 0) {
                  const topIds = tops.map(t => t.id);
                  const { data: mats } = await supabase.from('materials').select('id').in('topic_id', topIds);
                  
                  if (mats && mats.length > 0) {
                    totalClassMaterials += mats.length;
                    const compMats = mats.filter(m => completedIds.has(m.id)).length;
                    completedClassMaterials += compMats;
                    
                    subData.push({
                      id: s.id,
                      name: s.name,
                      progress: Math.round((compMats / mats.length) * 100),
                      color: colors[i % colors.length]
                    });
                  } else {
                    subData.push({ id: s.id, name: s.name, progress: 0, color: colors[i % colors.length] });
                  }
                } else {
                  subData.push({ id: s.id, name: s.name, progress: 0, color: colors[i % colors.length] });
                }
              } else {
                subData.push({ id: s.id, name: s.name, progress: 0, color: colors[i % colors.length] });
              }
            }
            setSubjects(subData);
          }
          
          if (totalClassMaterials > 0) {
            setOverallProgress(Math.round((completedClassMaterials / totalClassMaterials) * 100));
          }
          
          // Evaluate Badges
          setBadges(prev => prev.map(b => {
            if (b.id === 'quick_starter') return { ...b, unlocked: completedIds.size >= 3 };
            if (b.id === 'on_fire') return { ...b, unlocked: currentStreak >= 3 };
            if (b.id === 'sharpshooter') return { ...b, unlocked: hasPerfectQuiz };
            if (b.id === 'scholar') return { ...b, unlocked: (sumPct / Math.max(1, (scores?.length || 1))) >= 80 };
            return b;
          }));

          // Calculate Class Rank efficiently via Supabase RPC
          const { data: rankData } = await supabase.rpc('get_student_class_rank', {
            p_user_id: session.user.id
          });
          
          if (rankData && rankData.total > 0) {
            setClassRank({ rank: rankData.rank, total: rankData.total });
          }
        }
      }
      setLoading(false);
    }
    init();

    // Visually tick active time up every 60 seconds on the dashboard
    const visualTick = setInterval(() => {
      setActiveTimeMins(prev => prev + 1);
    }, 60000);

    return () => clearInterval(visualTick);
  }, []);

  const formatMins = (mins: number) => {
    if (mins < 60) return `${mins}m`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}><div className="spinner spinner-lg" /></div>;

  return (
    <>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 20 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 8 }}>
            <h1 style={{ fontSize: '1.6rem', margin: 0 }}>Welcome back, {userName}!</h1>
            {badges.find(b => b.id === 'scholar')?.unlocked && (
              <span style={{ 
                background: 'linear-gradient(135deg, #FFD700, #FFA500)', 
                color: '#000', padding: '4px 10px', borderRadius: 20, 
                fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5 
              }}>⭐ Top Scholar</span>
            )}
            {classRank && (
              <span style={{ 
                background: 'rgba(124,58,237,0.1)', color: 'var(--primary-400)', border: '1px solid rgba(124,58,237,0.2)',
                padding: '4px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5 
              }}>🏆 Rank {classRank.rank} / {classRank.total}</span>
            )}
          </div>
          <p className="text-muted text-sm" style={{ margin: 0 }}>Track your immersive learning journey and mastery.</p>
        </div>
        <Link href="/student/explore" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>📚</span> Resume Curriculum →
        </Link>
      </div>

      <div className="page-body">
        
        {/* Upgrade Banner */}
        {!isPaid && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
            style={{
              background: 'linear-gradient(135deg, rgba(124,58,237,.12), rgba(6,182,212,.08))',
              border: '1px solid rgba(124,58,237,.16)',
              borderRadius: 14, padding: '12px 20px', marginBottom: 24,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: '1.2rem' }}>🔒</span>
              <h2 style={{ fontSize: '0.95rem', margin: 0, color: 'var(--primary-300)' }}>Premium Dashboard Locked</h2>
            </div>
            <Link href="/payment" className="btn btn-primary btn-sm" style={{ flexShrink: 0 }}>💎 Upgrade Now</Link>
          </motion.div>
        )}

        {/* --- Top Metrics (Premium Neuromorphic Design) --- */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: '20px', marginBottom: '32px' }}>
          
          {/* Card 1: Learning Progress */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} 
            whileHover={{ y: -5, boxShadow: '0 15px 35px -10px rgba(168,85,247,0.3)' }}
            style={{ 
              background: 'rgba(255, 255, 255, 0.03)', backdropFilter: 'blur(20px)',
              border: '1px solid rgba(168,85,247,0.2)',
              borderRadius: '20px', padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px',
              position: 'relative', overflow: 'hidden'
            }}
          >
            {/* Subtle background glow */}
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '80%', height: '80%', background: 'radial-gradient(circle, rgba(168,85,247,0.12) 0%, transparent 60%)', filter: 'blur(20px)' }} />
            
            <div style={{ position: 'relative', width: 90, height: 90, flexShrink: 0 }}>
              <svg viewBox="0 0 36 36" style={{ width: '100%', height: '100%', filter: 'drop-shadow(0 0 12px rgba(168,85,247,0.6))' }}>
                {/* Background Track */}
                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="3.5" />
                {/* Glowing Progress */}
                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="url(#progressGradient)" strokeWidth="3.5" strokeDasharray={`${overallProgress}, 100`} strokeLinecap="round" style={{ animation: 'progress 1.5s cubic-bezier(0.4, 0, 0.2, 1) forwards' }} />
                <defs>
                  <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#3b82f6" />
                    <stop offset="50%" stopColor="#a855f7" />
                    <stop offset="100%" stopColor="#ec4899" />
                  </linearGradient>
                </defs>
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem', fontWeight: 800, color: '#fff', textShadow: '0 2px 8px rgba(0,0,0,0.6)' }}>
                {overallProgress}%
              </div>
            </div>
            <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--neutral-400)', textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 600, marginBottom: 2 }}>Learning Progress</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f4f4f5', letterSpacing: '0.02em', textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}>Overall</div>
            </div>
          </motion.div>

          {/* Card 2: Active Time */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} 
            whileHover={{ y: -5, boxShadow: '0 15px 35px -10px rgba(6,182,212,0.2)' }}
            style={{ 
              background: 'rgba(255, 255, 255, 0.03)', backdropFilter: 'blur(20px)',
              border: '1px solid rgba(6,182,212,0.15)',
              borderRadius: '20px', padding: '24px', position: 'relative', overflow: 'hidden'
            }}
          >
            <div style={{ position: 'absolute', bottom: '-20%', right: '-20%', width: '70%', height: '70%', background: 'radial-gradient(circle, rgba(6,182,212,0.08) 0%, transparent 70%)', filter: 'blur(20px)' }} />
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px', position: 'relative', zIndex: 1 }}>
              <div style={{ width: 44, height: 44, borderRadius: '12px', background: 'linear-gradient(135deg, rgba(6,182,212,0.2), rgba(2,132,199,0.2))', border: '1px solid rgba(6,182,212,0.3)', color: '#22d3ee', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', boxShadow: '0 4px 15px -3px rgba(6,182,212,0.3)' }}>⏱️</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--neutral-400)', textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 600 }}>Total Active Time</div>
            </div>
            <div style={{ fontSize: '2.1rem', fontWeight: 800, color: '#fff', letterSpacing: '-0.03em', position: 'relative', zIndex: 1, textShadow: '0 2px 10px rgba(0,0,0,0.3)' }}>{formatMins(activeTimeMins)}</div>
            <div style={{ fontSize: '0.8rem', color: '#0ea5e9', marginTop: 6, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6, position: 'relative', zIndex: 1 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#0ea5e9', display: 'inline-block', boxShadow: '0 0 8px #0ea5e9' }}></span>
              Session Recorded
            </div>
          </motion.div>

          {/* Card 3: Topic Mastery */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} 
            whileHover={{ y: -5, boxShadow: '0 15px 35px -10px rgba(16,185,129,0.2)' }}
            style={{ 
              background: 'rgba(255, 255, 255, 0.03)', backdropFilter: 'blur(20px)',
              border: '1px solid rgba(16,185,129,0.15)',
              borderRadius: '20px', padding: '24px', position: 'relative', overflow: 'hidden'
            }}
          >
            <div style={{ position: 'absolute', top: '10%', right: '10%', width: '50%', height: '50%', background: 'radial-gradient(circle, rgba(16,185,129,0.06) 0%, transparent 70%)', filter: 'blur(20px)' }} />
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px', position: 'relative', zIndex: 1 }}>
              <div style={{ width: 44, height: 44, borderRadius: '12px', background: 'linear-gradient(135deg, rgba(16,185,129,0.2), rgba(5,150,105,0.2))', border: '1px solid rgba(16,185,129,0.3)', color: '#34d399', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', boxShadow: '0 4px 15px -3px rgba(16,185,129,0.3)' }}>🎯</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--neutral-400)', textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 600 }}>Topic Mastery (MCQ)</div>
            </div>
            <div style={{ fontSize: '2.1rem', fontWeight: 800, color: '#fff', letterSpacing: '-0.03em', position: 'relative', zIndex: 1, display: 'flex', alignItems: 'baseline', gap: 4 }}>
              {masteryAvg} <span style={{ fontSize: '1.2rem', color: 'var(--neutral-400)' }}>%</span>
            </div>
            <div style={{ width: '100%', height: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 3, marginTop: 16, overflow: 'hidden', position: 'relative', zIndex: 1, boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.3)' }}>
              <div style={{ width: `${masteryAvg}%`, height: '100%', background: 'linear-gradient(90deg, #10b981, #34d399)', borderRadius: 3, boxShadow: '0 0 10px rgba(52,211,153,0.5)' }} />
            </div>
          </motion.div>

          {/* Card 4: Current Streak */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} 
            whileHover={{ y: -5, boxShadow: '0 15px 35px -10px rgba(245,158,11,0.2)' }}
            style={{ 
              background: 'rgba(255, 255, 255, 0.03)', backdropFilter: 'blur(20px)',
              border: '1px solid rgba(245,158,11,0.15)',
              borderRadius: '20px', padding: '24px', position: 'relative', overflow: 'hidden'
            }}
          >
            <div style={{ position: 'absolute', bottom: '0', left: '0', width: '100%', height: '50%', background: 'linear-gradient(to top, rgba(245,158,11,0.05) 0%, transparent 100%)' }} />
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px', position: 'relative', zIndex: 1 }}>
              <div style={{ width: 44, height: 44, borderRadius: '12px', background: 'linear-gradient(135deg, rgba(245,158,11,0.2), rgba(217,119,6,0.2))', border: '1px solid rgba(245,158,11,0.3)', color: '#fbbf24', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', boxShadow: '0 4px 15px -3px rgba(245,158,11,0.3)' }}>🔥</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--neutral-400)', textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 600 }}>Current Streak</div>
            </div>
            <div style={{ fontSize: '2.1rem', fontWeight: 800, color: '#fff', letterSpacing: '-0.03em', position: 'relative', zIndex: 1, display: 'flex', alignItems: 'baseline', gap: 6 }}>
              {streak} <span style={{ fontSize: '1.1rem', color: '#fbbf24', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>Days</span>
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 16, position: 'relative', zIndex: 1 }}>
              {[1, 2, 3, 4, 5, 6, 7].map(d => {
                const isActive = d <= streak;
                return (
                  <div key={d} style={{ 
                    flex: 1, height: 8, borderRadius: 4, 
                    background: isActive ? 'linear-gradient(to right, #f59e0b, #fbbf24)' : 'rgba(255,255,255,0.06)',
                    boxShadow: isActive ? '0 0 8px rgba(245,158,11,0.4)' : 'inset 0 1px 2px rgba(0,0,0,0.2)'
                  }} />
                );
              })}
            </div>
          </motion.div>

        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 400px), 1fr))', gap: '24px', marginBottom: '32px' }}>
          
          {/* --- Subject Progress Graphical Representation --- */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.5 }} 
            whileHover={{ y: -5, boxShadow: '0 15px 35px -10px rgba(139,92,246,0.15)' }}
            style={{ 
              background: 'rgba(255, 255, 255, 0.03)', backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255,255,255,0.05)',
              borderRadius: '20px', padding: '32px', position: 'relative', overflow: 'hidden'
            }}
          >
            <div style={{ position: 'absolute', top: 0, right: 0, width: '300px', height: '300px', background: 'radial-gradient(circle, rgba(139,92,246,0.05) 0%, transparent 70%)', filter: 'blur(30px)', pointerEvents: 'none' }} />
            
            <h2 style={{ fontSize: '1.25rem', marginBottom: 28, display: 'flex', alignItems: 'center', gap: 10, color: '#f4f4f5', fontWeight: 700 }}>
              <span style={{ fontSize: '1.4rem' }}>📊</span> Subject Completion
            </h2>
            {subjects.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--neutral-500)', fontSize: '0.95rem', background: 'rgba(0,0,0,0.2)', borderRadius: 16 }}>No subjects available for tracking.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {subjects.map(sub => (
                  <div key={sub.id} style={{ position: 'relative', zIndex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: '0.9rem' }}>
                      <span style={{ fontWeight: 600, color: 'var(--neutral-300)' }}>{sub.name}</span>
                      <span style={{ color: sub.color, fontWeight: 700, textShadow: `0 0 10px ${sub.color}66` }}>{sub.progress}%</span>
                    </div>
                    <div style={{ width: '100%', height: 10, background: 'rgba(0,0,0,0.3)', borderRadius: 5, overflow: 'hidden', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.5)' }}>
                      <motion.div 
                        initial={{ width: 0 }} animate={{ width: `${sub.progress}%` }} transition={{ duration: 1, delay: 0.6, ease: 'easeOut' }}
                        style={{ height: '100%', background: `linear-gradient(90deg, ${sub.color}bb, ${sub.color})`, borderRadius: 5, boxShadow: `0 0 10px ${sub.color}88` }} 
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* --- Topic Basket (80%+) --- */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.6 }} 
              whileHover={{ y: -5, boxShadow: '0 15px 35px -10px rgba(16,185,129,0.15)' }}
              style={{ 
                background: 'rgba(255, 255, 255, 0.03)', backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255,255,255,0.05)',
                borderRadius: '20px', padding: '32px', position: 'relative', overflow: 'hidden'
              }}
            >
              <div style={{ position: 'absolute', top: '-10%', right: '-10%', width: '150px', height: '150px', background: 'radial-gradient(circle, rgba(16,185,129,0.1) 0%, transparent 70%)', filter: 'blur(20px)', pointerEvents: 'none' }} />
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, position: 'relative', zIndex: 1 }}>
                <h2 style={{ fontSize: '1.25rem', margin: 0, display: 'flex', alignItems: 'center', gap: 10, color: '#f4f4f5', fontWeight: 700 }}>
                  <span style={{ fontSize: '1.4rem' }}>🧺</span> Mastery Basket <span style={{ fontSize: '0.8rem', color: 'var(--neutral-500)', fontWeight: 600 }}>(80%+)</span>
                </h2>
                <span style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399', padding: '4px 12px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 700, border: '1px solid rgba(16,185,129,0.3)' }}>{topicBasket.length} Topics</span>
              </div>
              
              {topicBasket.length === 0 ? (
                <div style={{ padding: '30px 20px', textAlign: 'center', color: 'var(--neutral-500)', fontSize: '0.95rem', background: 'rgba(0,0,0,0.2)', borderRadius: 16 }}>
                  Score 80% or more on a topic quiz to add it to your mastery basket!
                </div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', position: 'relative', zIndex: 1 }}>
                  {topicBasket.map((tb, i) => (
                    <motion.div 
                      whileHover={{ scale: 1.05 }}
                      key={i} style={{
                      background: 'linear-gradient(135deg, rgba(16,185,129,0.15), rgba(5,150,105,0.1))', 
                      border: '1px solid rgba(16,185,129,0.3)',
                      padding: '10px 16px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '10px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
                    }}>
                      <span style={{ fontSize: '1.2rem', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }}>🎓</span>
                      <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#e4e4e7' }}>{tb.name}</span>
                      <span style={{ background: 'linear-gradient(90deg, #10b981, #059669)', color: '#fff', padding: '2px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 800, textShadow: '0 1px 2px rgba(0,0,0,0.4)', boxShadow: '0 0 8px rgba(16,185,129,0.4)' }}>
                        {tb.avg_score}%
                      </span>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>

            {/* --- Achievements --- */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.7 }} 
              whileHover={{ y: -5, boxShadow: '0 15px 35px -10px rgba(245,158,11,0.15)' }}
              style={{ 
                background: 'rgba(255, 255, 255, 0.03)', backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255,255,255,0.05)',
                borderRadius: '20px', padding: '32px', position: 'relative', overflow: 'hidden'
              }}
            >
              <div style={{ position: 'absolute', bottom: '-10%', left: '-10%', width: '150px', height: '150px', background: 'radial-gradient(circle, rgba(245,158,11,0.08) 0%, transparent 70%)', filter: 'blur(20px)', pointerEvents: 'none' }} />
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, position: 'relative', zIndex: 1 }}>
                <h2 style={{ fontSize: '1.25rem', margin: 0, display: 'flex', alignItems: 'center', gap: 10, color: '#f4f4f5', fontWeight: 700 }}>
                  <span style={{ fontSize: '1.4rem' }}>🏆</span> Achievements
                </h2>
                <span style={{ background: 'rgba(245,158,11,0.15)', color: '#fbbf24', padding: '4px 12px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 700, border: '1px solid rgba(245,158,11,0.3)' }}>{badges.filter(b => b.unlocked).length} / {badges.length} Unlocked</span>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: '16px', position: 'relative', zIndex: 1 }}>
                {badges.map((badge, i) => (
                  <motion.div 
                    whileHover={badge.unlocked ? { scale: 1.02 } : {}}
                    key={i} style={{
                    padding: '16px', borderRadius: '16px',
                    background: badge.unlocked ? 'linear-gradient(145deg, rgba(40,40,50,0.9), rgba(25,25,35,0.9))' : 'rgba(0,0,0,0.2)',
                    border: `1px solid ${badge.unlocked ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.02)'}`,
                    opacity: badge.unlocked ? 1 : 0.6,
                    display: 'flex', alignItems: 'center', gap: '16px',
                    boxShadow: badge.unlocked ? '0 8px 20px rgba(0,0,0,0.3)' : 'inset 0 2px 4px rgba(0,0,0,0.2)'
                  }}>
                    <div style={{
                      width: 48, height: 48, borderRadius: '50%', flexShrink: 0,
                      background: badge.unlocked ? 'linear-gradient(135deg, #fbbf24, #f59e0b)' : 'rgba(255,255,255,0.05)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem',
                      boxShadow: badge.unlocked ? '0 4px 15px rgba(245,158,11,0.4)' : 'none',
                      filter: badge.unlocked ? 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' : 'grayscale(100%)'
                    }}>
                      {badge.unlocked ? badge.icon : '🔒'}
                    </div>
                    <div>
                      <div style={{ fontSize: '0.95rem', fontWeight: 700, color: badge.unlocked ? '#f4f4f5' : 'var(--neutral-500)', textShadow: badge.unlocked ? '0 1px 2px rgba(0,0,0,0.5)' : 'none' }}>{badge.title}</div>
                      <div style={{ fontSize: '0.75rem', color: badge.unlocked ? 'var(--neutral-400)' : 'var(--neutral-600)', marginTop: 4, lineHeight: 1.4 }}>{badge.desc}</div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>

        </div>

      </div>
    </>
  );
}
