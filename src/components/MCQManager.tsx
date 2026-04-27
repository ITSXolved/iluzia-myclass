'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';

interface Question {
  id: number;
  topic_id: number;
  question_text: string;
  question_image: string | null;
  explanation: string | null;
  sort_order: number;
  set_id: number | null;
  options?: QuestionOption[];
}

interface QuestionSet {
  id: number;
  topic_id: number;
  name: string;
  created_at: string;
  questions: Question[];
}

interface QuestionOption {
  id: number;
  question_id: number;
  option_text: string;
  option_image: string | null;
  is_correct: boolean;
  sort_order: number;
}

interface OptionForm {
  option_text: string;
  option_image: File | null;
  option_image_preview: string | null;
  is_correct: boolean;
  existing_image: string | null;
}

interface BulkQuestionForm {
  question_text: string;
  question_image: File | null;
  question_image_preview: string | null;
  explanation: string;
  options: OptionForm[];
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';

export default function MCQManager({ topicId, topicName, bulkTrigger }: { topicId: number; topicName: string; bulkTrigger?: number }) {
  const supabase = createClient();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [expandedSet, setExpandedSet] = useState<number | null>(null);
  const [sets, setSets] = useState<QuestionSet[]>([]);
  const [playSet, setPlaySet] = useState<QuestionSet | null>(null);
  const [playIndex, setPlayIndex] = useState(0);
  const [playAnswers, setPlayAnswers] = useState<Record<number, number>>({});
  const [playSubmitted, setPlaySubmitted] = useState(false);
  const [deleteSetConfirm, setDeleteSetConfirm] = useState<number | null>(null);

  // Bulk mode
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkQuestions, setBulkQuestions] = useState<BulkQuestionForm[]>([]);
  const [savingBulk, setSavingBulk] = useState(false);

  // Form state
  const [questionText, setQuestionText] = useState('');
  const [questionImage, setQuestionImage] = useState<File | null>(null);
  const [questionImagePreview, setQuestionImagePreview] = useState<string | null>(null);
  const [existingQuestionImage, setExistingQuestionImage] = useState<string | null>(null);
  const [explanation, setExplanation] = useState('');
  const [options, setOptions] = useState<OptionForm[]>([
    { option_text: '', option_image: null, option_image_preview: null, is_correct: true, existing_image: null },
    { option_text: '', option_image: null, option_image_preview: null, is_correct: false, existing_image: null },
    { option_text: '', option_image: null, option_image_preview: null, is_correct: false, existing_image: null },
    { option_text: '', option_image: null, option_image_preview: null, is_correct: false, existing_image: null },
  ]);

  const questionImageRef = useRef<HTMLInputElement>(null);

  const loadQuestions = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('questions')
      .select('*, question_options(*)')
      .eq('topic_id', topicId)
      .order('sort_order');

    const mapped = (data || []).map((q: Record<string, unknown>) => ({
      ...q,
      options: Array.isArray(q.question_options)
        ? (q.question_options as QuestionOption[]).sort((a, b) => a.sort_order - b.sort_order)
        : [],
    })) as Question[];
    setQuestions(mapped);

    // Load sets
    const { data: setsData } = await supabase
      .from('question_sets')
      .select('*')
      .eq('topic_id', topicId)
      .order('created_at', { ascending: false });

    if (setsData) {
      const setsWithQ: QuestionSet[] = setsData.map((s: Record<string, unknown>) => {
        const set = s as unknown as QuestionSet;
        return { ...set, questions: mapped.filter(q => q.set_id === set.id) };
      });
      setSets(setsWithQ);
    }
    setLoading(false);
  }, [supabase, topicId]);

  useEffect(() => { loadQuestions(); }, [loadQuestions]);

  // Bulk question helpers (must be before the useEffect that uses it)
  const newBulkQ = (): BulkQuestionForm => ({
    question_text: '', question_image: null, question_image_preview: null, explanation: '',
    options: [
      { option_text: '', option_image: null, option_image_preview: null, is_correct: true, existing_image: null },
      { option_text: '', option_image: null, option_image_preview: null, is_correct: false, existing_image: null },
      { option_text: '', option_image: null, option_image_preview: null, is_correct: false, existing_image: null },
      { option_text: '', option_image: null, option_image_preview: null, is_correct: false, existing_image: null },
    ],
  });

  // Open bulk modal when parent triggers it
  useEffect(() => {
    if (bulkTrigger && bulkTrigger > 0) {
      setBulkQuestions([newBulkQ()]);
      setShowBulkModal(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bulkTrigger]);

  const getImageUrl = (path: string | null) => {
    if (!path) return null;
    return `${SUPABASE_URL}/storage/v1/object/public/mcq-images/${path}`;
  };

  const uploadImage = async (file: File, prefix: string): Promise<string | null> => {
    const ext = file.name.split('.').pop();
    const path = `${prefix}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from('mcq-images').upload(path, file);
    if (error) { console.error('Upload error:', error); return null; }
    return path;
  };

  const deleteImage = async (path: string) => {
    await supabase.storage.from('mcq-images').remove([path]);
  };

  const resetForm = () => {
    setQuestionText('');
    setQuestionImage(null);
    setQuestionImagePreview(null);
    setExistingQuestionImage(null);
    setExplanation('');
    setOptions([
      { option_text: '', option_image: null, option_image_preview: null, is_correct: true, existing_image: null },
      { option_text: '', option_image: null, option_image_preview: null, is_correct: false, existing_image: null },
      { option_text: '', option_image: null, option_image_preview: null, is_correct: false, existing_image: null },
      { option_text: '', option_image: null, option_image_preview: null, is_correct: false, existing_image: null },
    ]);
  };

  const openCreate = () => {
    setEditingQuestion(null);
    resetForm();
    setShowModal(true);
  };

  const openEdit = (q: Question) => {
    setEditingQuestion(q);
    setQuestionText(q.question_text);
    setQuestionImage(null);
    setQuestionImagePreview(null);
    setExistingQuestionImage(q.question_image);
    setExplanation(q.explanation || '');
    const opts = q.options || [];
    const formOpts: OptionForm[] = [];
    for (let i = 0; i < Math.max(4, opts.length); i++) {
      const o = opts[i];
      formOpts.push({
        option_text: o?.option_text || '',
        option_image: null,
        option_image_preview: null,
        is_correct: o?.is_correct || false,
        existing_image: o?.option_image || null,
      });
    }
    setOptions(formOpts);
    setShowModal(true);
  };

  const handleQuestionImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setQuestionImage(file);
      setQuestionImagePreview(URL.createObjectURL(file));
    }
  };

  const handleOptionImageChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const newOpts = [...options];
      newOpts[index] = {
        ...newOpts[index],
        option_image: file,
        option_image_preview: URL.createObjectURL(file),
      };
      setOptions(newOpts);
    }
  };

  const setCorrectOption = (index: number) => {
    setOptions(options.map((o, i) => ({ ...o, is_correct: i === index })));
  };

  const updateOptionText = (index: number, text: string) => {
    const newOpts = [...options];
    newOpts[index] = { ...newOpts[index], option_text: text };
    setOptions(newOpts);
  };

  const addOption = () => {
    setOptions([...options, { option_text: '', option_image: null, option_image_preview: null, is_correct: false, existing_image: null }]);
  };

  const removeOption = (index: number) => {
    if (options.length <= 2) return;
    const newOpts = options.filter((_, i) => i !== index);
    if (!newOpts.some(o => o.is_correct) && newOpts.length > 0) newOpts[0].is_correct = true;
    setOptions(newOpts);
  };

  const openBulk = () => {
    setBulkQuestions([newBulkQ()]);
    setShowBulkModal(true);
  };

  const addBulkQ = () => setBulkQuestions([...bulkQuestions, newBulkQ()]);

  const removeBulkQ = (idx: number) => {
    if (bulkQuestions.length <= 1) return;
    setBulkQuestions(bulkQuestions.filter((_, i) => i !== idx));
  };

  const updateBulkQ = (idx: number, field: string, value: string) => {
    const updated = [...bulkQuestions];
    (updated[idx] as unknown as Record<string, unknown>)[field] = value;
    setBulkQuestions(updated);
  };

  const updateBulkQImage = (idx: number, file: File) => {
    const updated = [...bulkQuestions];
    updated[idx] = { ...updated[idx], question_image: file, question_image_preview: URL.createObjectURL(file) };
    setBulkQuestions(updated);
  };

  const updateBulkOption = (qIdx: number, oIdx: number, text: string) => {
    const updated = [...bulkQuestions];
    updated[qIdx].options[oIdx] = { ...updated[qIdx].options[oIdx], option_text: text };
    setBulkQuestions(updated);
  };

  const updateBulkOptionImage = (qIdx: number, oIdx: number, file: File) => {
    const updated = [...bulkQuestions];
    updated[qIdx].options[oIdx] = { ...updated[qIdx].options[oIdx], option_image: file, option_image_preview: URL.createObjectURL(file) };
    setBulkQuestions(updated);
  };

  const setBulkCorrect = (qIdx: number, oIdx: number) => {
    const updated = [...bulkQuestions];
    updated[qIdx].options = updated[qIdx].options.map((o, i) => ({ ...o, is_correct: i === oIdx }));
    setBulkQuestions(updated);
  };

  const handleBulkSave = async () => {
    const valid = bulkQuestions.filter(q => q.question_text.trim() && q.options.some(o => o.option_text.trim()));
    if (valid.length === 0) return;
    setSavingBulk(true);
    try {
      // Create a question set
      const { data: setData } = await supabase.from('question_sets').insert({
        topic_id: topicId,
        name: `Quiz Session (${valid.length} Q)`,
      }).select('id').single();
      const setId = setData?.id || null;

      for (let qi = 0; qi < valid.length; qi++) {
        const bq = valid[qi];
        let qImagePath: string | null = null;
        if (bq.question_image) {
          qImagePath = await uploadImage(bq.question_image, `questions/${topicId}`);
        }
        const { data } = await supabase.from('questions').insert({
          topic_id: topicId, question_text: bq.question_text.trim(),
          question_image: qImagePath, explanation: bq.explanation.trim() || null,
          sort_order: questions.length + qi, set_id: setId,
        }).select('id').single();
        if (!data) continue;
        const validOpts = bq.options.filter(o => o.option_text.trim());
        for (let oi = 0; oi < validOpts.length; oi++) {
          const opt = validOpts[oi];
          let optImg: string | null = null;
          if (opt.option_image) optImg = await uploadImage(opt.option_image, `options/${data.id}`);
          await supabase.from('question_options').insert({
            question_id: data.id, option_text: opt.option_text.trim(),
            option_image: optImg, is_correct: opt.is_correct, sort_order: oi,
          });
        }
      }
      setShowBulkModal(false);
      loadQuestions();
    } catch (err) { console.error('Bulk save error:', err); }
    finally { setSavingBulk(false); }
  };

  const handleDeleteSet = async (setId: number) => {
    if (deleteSetConfirm === setId) {
      await supabase.from('question_sets').delete().eq('id', setId);
      setDeleteSetConfirm(null);
      loadQuestions();
    } else {
      setDeleteSetConfirm(setId);
      setTimeout(() => setDeleteSetConfirm(null), 3000);
    }
  };

  const startPlay = (s: QuestionSet) => {
    setPlaySet(s); setPlayIndex(0); setPlayAnswers({}); setPlaySubmitted(false);
  };

  const playScore = () => {
    if (!playSet) return 0;
    return playSet.questions.reduce((acc, q) => {
      const chosen = playAnswers[q.id];
      const correct = q.options?.find(o => o.is_correct);
      return acc + (correct && chosen === correct.id ? 1 : 0);
    }, 0);
  };

  const handleSave = async () => {
    if (!questionText.trim() || !options.some(o => o.option_text.trim())) return;
    setSaving(true);

    try {
      // Upload question image if new
      let qImagePath = existingQuestionImage;
      if (questionImage) {
        if (existingQuestionImage) await deleteImage(existingQuestionImage);
        qImagePath = await uploadImage(questionImage, `questions/${topicId}`);
      }

      const qPayload = {
        topic_id: topicId,
        question_text: questionText.trim(),
        question_image: qImagePath,
        explanation: explanation.trim() || null,
        sort_order: editingQuestion ? editingQuestion.sort_order : questions.length,
      };

      let questionId: number;
      if (editingQuestion) {
        await supabase.from('questions').update(qPayload).eq('id', editingQuestion.id);
        questionId = editingQuestion.id;
        // Delete old options
        await supabase.from('question_options').delete().eq('question_id', questionId);
      } else {
        const { data } = await supabase.from('questions').insert(qPayload).select('id').single();
        if (!data) throw new Error('Failed to create question');
        questionId = data.id;
      }

      // Upload option images and insert options
      const validOptions = options.filter(o => o.option_text.trim());
      for (let i = 0; i < validOptions.length; i++) {
        const opt = validOptions[i];
        let optImagePath = opt.existing_image;
        if (opt.option_image) {
          if (opt.existing_image) await deleteImage(opt.existing_image);
          optImagePath = await uploadImage(opt.option_image, `options/${questionId}`);
        }
        await supabase.from('question_options').insert({
          question_id: questionId,
          option_text: opt.option_text.trim(),
          option_image: optImagePath,
          is_correct: opt.is_correct,
          sort_order: i,
        });
      }

      setShowModal(false);
      resetForm();
      loadQuestions();
    } catch (err) {
      console.error('Save error:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (deleteConfirm === id) {
      // Clean up images
      const q = questions.find(q => q.id === id);
      if (q?.question_image) await deleteImage(q.question_image);
      if (q?.options) {
        for (const opt of q.options) {
          if (opt.option_image) await deleteImage(opt.option_image);
        }
      }
      await supabase.from('questions').delete().eq('id', id);
      setDeleteConfirm(null);
      loadQuestions();
    } else {
      setDeleteConfirm(id);
      setTimeout(() => setDeleteConfirm(null), 3000);
    }
  };

  const correctLabel = (q: Question) => {
    const correct = q.options?.find(o => o.is_correct);
    return correct ? correct.option_text : '—';
  };

  if (loading) {
    return <div style={{ padding: '32px', textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>;
  }

  return (
    <div>

      {/* Question Sessions */}
      {sets.length === 0 && questions.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--neutral-500)' }}>
          <span style={{ fontSize: '2rem', display: 'block', marginBottom: '12px' }}>❓</span>
          <p>No questions yet. Click &quot;+ Add Questions&quot; above to create a quiz session.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {sets.map(s => (
            <div key={s.id} style={{
              background: 'var(--surface-card)', border: '1px solid var(--surface-glass-border)',
              borderRadius: '12px', overflow: 'hidden',
            }}>
              <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}
                onClick={() => setExpandedSet(expandedSet === s.id ? null : s.id)}>
                <span style={{
                  width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(124,58,237,0.12)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', flexShrink: 0,
                }}>📝</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--neutral-100)' }}>{s.name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--neutral-500)', marginTop: '2px' }}>
                    {s.questions.length} question{s.questions.length !== 1 ? 's' : ''} · {new Date(s.created_at).toLocaleDateString()}
                  </div>
                </div>
                <div className="flex gap-xs" onClick={e => e.stopPropagation()}>
                  <button className="btn btn-primary btn-sm" onClick={() => startPlay(s)} style={{ fontSize: '0.8rem' }}>▶ Play</button>
                  <button className={`btn btn-sm ${deleteSetConfirm === s.id ? 'btn-danger' : 'btn-ghost'}`} onClick={() => handleDeleteSet(s.id)}>
                    {deleteSetConfirm === s.id ? 'Confirm?' : '🗑️'}
                  </button>
                  <span style={{ fontSize: '0.7rem', color: 'var(--neutral-500)', transform: expandedSet === s.id ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 150ms' }}>▶</span>
                </div>
              </div>
              {expandedSet === s.id && (
                <div style={{ padding: '0 18px 16px', borderTop: '1px solid var(--surface-glass-border)' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
                    {s.questions.map((q, qi) => (
                      <div key={q.id} style={{ padding: '10px 14px', borderRadius: '8px', background: 'rgba(148,163,184,0.04)', border: '1px solid rgba(148,163,184,0.08)' }}>
                        <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--neutral-200)', marginBottom: '4px' }}>Q{qi + 1}. {q.question_text}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--neutral-500)' }}>✅ {correctLabel(q)} · {q.options?.length || 0} options</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Quiz Player Modal */}
      {playSet && (() => {
        const q = playSet.questions[playIndex];
        const total = playSet.questions.length;
        return (
          <div className="modal-overlay" onClick={() => setPlaySet(null)} style={{ zIndex: 300 }}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }}>
              <div className="modal-header">
                <h2>{playSet.name}</h2>
                <button className="btn btn-ghost btn-icon" onClick={() => setPlaySet(null)}>✕</button>
              </div>
              <div className="modal-body">
                {playSubmitted ? (
                  <div style={{ textAlign: 'center', padding: '24px' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '12px' }}>{playScore() === total ? '🏆' : playScore() >= total / 2 ? '👍' : '📖'}</div>
                    <h3 style={{ fontSize: '1.3rem', marginBottom: '8px' }}>Score: {playScore()} / {total}</h3>
                    <p style={{ color: 'var(--neutral-400)', marginBottom: '20px' }}>
                      {playScore() === total ? 'Perfect!' : playScore() >= total / 2 ? 'Good job!' : 'Keep practicing!'}
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', textAlign: 'left' }}>
                      {playSet.questions.map((rq, ri) => {
                        const chosen = playAnswers[rq.id];
                        const correct = rq.options?.find(o => o.is_correct);
                        const isRight = correct && chosen === correct.id;
                        return (
                          <div key={rq.id} style={{ padding: '10px 14px', borderRadius: '8px', background: isRight ? 'rgba(34,197,94,0.06)' : 'rgba(239,68,68,0.06)', border: `1px solid ${isRight ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)'}` }}>
                            <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{isRight ? '✅' : '❌'} Q{ri + 1}. {rq.question_text}</div>
                            {!isRight && <div style={{ fontSize: '0.75rem', color: 'var(--success-400)', marginTop: '4px' }}>Correct: {correct?.option_text}</div>}
                            {rq.explanation && <div style={{ fontSize: '0.75rem', color: 'var(--neutral-400)', marginTop: '4px' }}>💡 {rq.explanation}</div>}
                          </div>
                        );
                      })}
                    </div>
                    <div style={{ marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'center' }}>
                      <button className="btn btn-secondary" onClick={() => { setPlayIndex(0); setPlayAnswers({}); setPlaySubmitted(false); }}>Retry</button>
                      <button className="btn btn-ghost" onClick={() => setPlaySet(null)}>Close</button>
                    </div>
                  </div>
                ) : q ? (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                      <span className="badge badge-primary" style={{ padding: '4px 10px' }}>Question {playIndex + 1} of {total}</span>
                      <div style={{ width: '120px', height: '6px', borderRadius: '3px', background: 'rgba(148,163,184,0.1)' }}>
                        <div style={{ width: `${((playIndex + 1) / total) * 100}%`, height: '100%', borderRadius: '3px', background: 'var(--primary-400)', transition: 'width 300ms' }} />
                      </div>
                    </div>
                    <h3 style={{ fontSize: '1rem', marginBottom: '16px', lineHeight: 1.5 }}>{q.question_text}</h3>
                    {q.question_image && <img src={getImageUrl(q.question_image)!} alt="" style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: '8px', marginBottom: '16px' }} />}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {q.options?.map((opt, oi) => (
                        <button key={opt.id} onClick={() => setPlayAnswers({ ...playAnswers, [q.id]: opt.id })}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', borderRadius: '10px',
                            cursor: 'pointer', border: `2px solid ${playAnswers[q.id] === opt.id ? 'var(--primary-400)' : 'var(--surface-glass-border)'}`,
                            background: playAnswers[q.id] === opt.id ? 'rgba(124,58,237,0.08)' : 'rgba(148,163,184,0.04)',
                            textAlign: 'left', fontSize: '0.9rem', color: 'var(--neutral-100)', transition: 'all 150ms',
                          }}>
                          <span style={{
                            width: '26px', height: '26px', borderRadius: '50%', fontSize: '0.75rem', fontWeight: 700,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                            background: playAnswers[q.id] === opt.id ? 'var(--primary-400)' : 'rgba(148,163,184,0.1)',
                            color: playAnswers[q.id] === opt.id ? 'white' : 'var(--neutral-400)',
                          }}>{String.fromCharCode(65 + oi)}</span>
                          {opt.option_text}
                          {opt.option_image && <img src={getImageUrl(opt.option_image)!} alt="" style={{ width: '40px', height: '40px', borderRadius: '6px', objectFit: 'cover', marginLeft: 'auto' }} />}
                        </button>
                      ))}
                    </div>
                  </>
                ) : null}
              </div>
              {!playSubmitted && q && (
                <div className="modal-footer">
                  <button className="btn btn-ghost" disabled={playIndex === 0} onClick={() => setPlayIndex(playIndex - 1)}>← Previous</button>
                  {playIndex < total - 1 ? (
                    <button className="btn btn-primary" disabled={!playAnswers[q.id]} onClick={() => setPlayIndex(playIndex + 1)}>Next →</button>
                  ) : (
                    <button className="btn btn-primary" disabled={Object.keys(playAnswers).length < total} onClick={() => setPlaySubmitted(true)}>Submit</button>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Add/Edit Question Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)} style={{ zIndex: 200 }}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '650px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <h2>{editingQuestion ? 'Edit Question' : 'Add Question'}</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              {/* Question text */}
              <div className="input-group">
                <label>Question *</label>
                <textarea className="input" placeholder="Enter the question..." value={questionText}
                  onChange={e => setQuestionText(e.target.value)} style={{ minHeight: '80px' }} />
              </div>

              {/* Question image */}
              <div className="input-group">
                <label>Question Image (optional)</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <input ref={questionImageRef} type="file" accept="image/*" onChange={handleQuestionImageChange}
                    style={{ display: 'none' }} />
                  <button className="btn btn-secondary btn-sm" onClick={() => questionImageRef.current?.click()}>
                    📷 {questionImagePreview || existingQuestionImage ? 'Change Image' : 'Upload Image'}
                  </button>
                  {(questionImagePreview || existingQuestionImage) && (
                    <button className="btn btn-ghost btn-sm" onClick={() => { setQuestionImage(null); setQuestionImagePreview(null); setExistingQuestionImage(null); }}>
                      ✕ Remove
                    </button>
                  )}
                </div>
                {(questionImagePreview || existingQuestionImage) && (
                  <img
                    src={questionImagePreview || getImageUrl(existingQuestionImage)!}
                    alt="Question preview"
                    style={{ maxWidth: '200px', maxHeight: '120px', borderRadius: '8px', marginTop: '8px', border: '1px solid var(--surface-glass-border)' }}
                  />
                )}
              </div>

              {/* Options */}
              <div className="input-group">
                <label>Answer Options * <span style={{ color: 'var(--neutral-500)', fontWeight: 400 }}>(click radio to mark correct)</span></label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {options.map((opt, i) => (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '12px', borderRadius: '10px',
                      background: opt.is_correct ? 'rgba(34,197,94,0.06)' : 'rgba(148,163,184,0.04)',
                      border: `1px solid ${opt.is_correct ? 'rgba(34,197,94,0.2)' : 'var(--surface-glass-border)'}`,
                    }}>
                      {/* Radio */}
                      <div style={{ paddingTop: '6px' }}>
                        <button onClick={() => setCorrectOption(i)} style={{
                          width: '22px', height: '22px', borderRadius: '50%', border: `2px solid ${opt.is_correct ? 'var(--success-400)' : 'var(--neutral-600)'}`,
                          background: opt.is_correct ? 'var(--success-400)' : 'transparent', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', color: 'white',
                        }}>
                          {opt.is_correct && '✓'}
                        </button>
                      </div>
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--neutral-400)' }}>{String.fromCharCode(65 + i)}</span>
                          <input className="input" placeholder={`Option ${String.fromCharCode(65 + i)}...`} value={opt.option_text}
                            onChange={e => updateOptionText(i, e.target.value)} style={{ flex: 1 }} />
                        </div>
                        {/* Option image upload */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <label style={{ cursor: 'pointer' }}>
                            <input type="file" accept="image/*" onChange={e => handleOptionImageChange(i, e)} style={{ display: 'none' }} />
                            <span className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: '0.7rem' }}>
                              📷 {opt.option_image_preview || opt.existing_image ? 'Change' : 'Image'}
                            </span>
                          </label>
                          {(opt.option_image_preview || opt.existing_image) && (
                            <>
                              <img
                                src={opt.option_image_preview || getImageUrl(opt.existing_image)!}
                                alt={`Option ${i + 1}`}
                                style={{ width: '40px', height: '40px', borderRadius: '6px', objectFit: 'cover', border: '1px solid var(--surface-glass-border)' }}
                              />
                              <button className="btn btn-ghost" style={{ padding: '1px 4px', fontSize: '0.65rem' }}
                                onClick={() => {
                                  const newOpts = [...options];
                                  newOpts[i] = { ...newOpts[i], option_image: null, option_image_preview: null, existing_image: null };
                                  setOptions(newOpts);
                                }}>✕</button>
                            </>
                          )}
                        </div>
                      </div>
                      {/* Remove option */}
                      {options.length > 2 && (
                        <button className="btn btn-ghost" style={{ padding: '4px', fontSize: '0.7rem', opacity: 0.5 }}
                          onClick={() => removeOption(i)}>✕</button>
                      )}
                    </div>
                  ))}
                  <button className="btn btn-ghost btn-sm" onClick={addOption} style={{ alignSelf: 'flex-start', color: 'var(--primary-400)' }}>
                    + Add Option
                  </button>
                </div>
              </div>

              {/* Explanation */}
              <div className="input-group">
                <label>Explanation (optional)</label>
                <textarea className="input" placeholder="Explain why the correct answer is right..."
                  value={explanation} onChange={e => setExplanation(e.target.value)} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave}
                disabled={saving || !questionText.trim() || !options.some(o => o.option_text.trim())}>
                {saving ? (
                  <><span className="spinner" style={{ width: '16px', height: '16px' }} /> Saving...</>
                ) : editingQuestion ? 'Update Question' : 'Add Question'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Add Questions Modal */}
      {showBulkModal && (
        <div className="modal-overlay" onClick={() => setShowBulkModal(false)} style={{ zIndex: 200 }}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '750px', maxHeight: '92vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <h2>Add Multiple Questions</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowBulkModal(false)}>✕</button>
            </div>
            <div className="modal-body" style={{ gap: '0' }}>
              {bulkQuestions.map((bq, qi) => (
                <div key={qi} style={{
                  padding: '16px', borderRadius: '12px', marginBottom: '12px',
                  border: '1px solid var(--surface-glass-border)', background: 'rgba(15,23,42,0.3)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--primary-400)' }}>Question {qi + 1}</span>
                    {bulkQuestions.length > 1 && (
                      <button className="btn btn-ghost btn-sm" style={{ fontSize: '0.7rem', color: 'var(--error-400)' }} onClick={() => removeBulkQ(qi)}>✕ Remove</button>
                    )}
                  </div>

                  {/* Question text */}
                  <div className="input-group" style={{ marginBottom: '10px' }}>
                    <textarea className="input" placeholder="Enter question..." value={bq.question_text}
                      onChange={e => updateBulkQ(qi, 'question_text', e.target.value)} style={{ minHeight: '60px' }} />
                  </div>

                  {/* Question image */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                    <label style={{ cursor: 'pointer' }}>
                      <input type="file" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) updateBulkQImage(qi, f); }} style={{ display: 'none' }} />
                      <span className="btn btn-ghost btn-sm" style={{ fontSize: '0.75rem' }}>📷 {bq.question_image_preview ? 'Change' : 'Image'}</span>
                    </label>
                    {bq.question_image_preview && (
                      <img src={bq.question_image_preview} alt="" style={{ width: '36px', height: '36px', borderRadius: '6px', objectFit: 'cover' }} />
                    )}
                  </div>

                  {/* Options */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '10px' }}>
                    {bq.options.map((opt, oi) => (
                      <div key={oi} style={{
                        display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', borderRadius: '8px',
                        background: opt.is_correct ? 'rgba(34,197,94,0.06)' : 'transparent',
                        border: `1px solid ${opt.is_correct ? 'rgba(34,197,94,0.2)' : 'var(--surface-glass-border)'}`,
                      }}>
                        <button onClick={() => setBulkCorrect(qi, oi)} style={{
                          width: '18px', height: '18px', borderRadius: '50%', flexShrink: 0,
                          border: `2px solid ${opt.is_correct ? 'var(--success-400)' : 'var(--neutral-600)'}`,
                          background: opt.is_correct ? 'var(--success-400)' : 'transparent', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.55rem', color: 'white',
                        }}>{opt.is_correct && '✓'}</button>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--neutral-400)', width: '14px' }}>{String.fromCharCode(65 + oi)}</span>
                        <input className="input" placeholder={`Option ${String.fromCharCode(65 + oi)}`} value={opt.option_text}
                          onChange={e => updateBulkOption(qi, oi, e.target.value)} style={{ flex: 1, padding: '6px 10px', fontSize: '0.85rem' }} />
                        <label style={{ cursor: 'pointer', flexShrink: 0 }}>
                          <input type="file" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) updateBulkOptionImage(qi, oi, f); }} style={{ display: 'none' }} />
                          <span style={{ fontSize: '0.7rem', opacity: 0.6 }}>📷</span>
                        </label>
                        {opt.option_image_preview && (
                          <img src={opt.option_image_preview} alt="" style={{ width: '28px', height: '28px', borderRadius: '4px', objectFit: 'cover' }} />
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Explanation */}
                  <input className="input" placeholder="Explanation (optional)" value={bq.explanation}
                    onChange={e => updateBulkQ(qi, 'explanation', e.target.value)} style={{ fontSize: '0.85rem' }} />
                </div>
              ))}

              <button className="btn btn-ghost" onClick={addBulkQ} style={{ color: 'var(--primary-400)', alignSelf: 'flex-start' }}>
                + Add Another Question
              </button>
            </div>
            <div className="modal-footer">
              <span style={{ fontSize: '0.8rem', color: 'var(--neutral-500)', flex: 1 }}>
                {bulkQuestions.filter(q => q.question_text.trim()).length} question{bulkQuestions.filter(q => q.question_text.trim()).length !== 1 ? 's' : ''} ready
              </span>
              <button className="btn btn-ghost" onClick={() => setShowBulkModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleBulkSave}
                disabled={savingBulk || !bulkQuestions.some(q => q.question_text.trim() && q.options.some(o => o.option_text.trim()))}>
                {savingBulk ? (
                  <><span className="spinner" style={{ width: '16px', height: '16px' }} /> Saving...</>
                ) : `Save ${bulkQuestions.filter(q => q.question_text.trim()).length} Question${bulkQuestions.filter(q => q.question_text.trim()).length !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
