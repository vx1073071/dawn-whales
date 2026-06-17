// @ts-nocheck
// R283 ML#4: FactorDiary — 因子日记/回忆录 (6h)
// Timestamped factor notes, learning log, "今日因子收获", weekly review
// Journal-style UI with calendar picker, mood tracker, learning streaks
// 因子日记: 记录每天的因子心得，回顾学习历程
import React, { useState, useCallback, useMemo } from 'react';
import { Calendar, BookOpen, TrendingUp, Edit3, Trash2, Plus, ChevronLeft, ChevronRight } from 'lucide-react';

interface DiaryEntry {
  id: string;
  date: string;       // ISO date "2026-06-18"
  factorId: string;
  factorName: string;
  factorEmoji: string;
  note: string;       // user's reflection
  mood: '😀' | '🤔' | '😤' | '🎉' | '😴'; // how they felt about this factor today
  learning: string;   // what they learned
  createdAt: number;
}

const DEMO_ENTRIES: DiaryEntry[] = [
  { id: '1', date: '2026-06-18', factorId: 'MOM_1M', factorName: '1月动量', factorEmoji: '⚡', note: '今天动量继续强势，IC仍然在0.044高位。感觉市场还在追涨。', mood: '🎉', learning: '牛市里动量因子的IC会更稳定，尽量顺势。', createdAt: Date.now() - 3600000 },
  { id: '2', date: '2026-06-17', factorId: 'PE_TTM', factorName: 'PE TTM', factorEmoji: '💰', note: 'PE因子今天信号偏弱，可能是因为业绩期刚过，估值基准变了。', mood: '🤔', learning: '业绩期后要等1-2周让估值因子重新校准。', createdAt: Date.now() - 86400000 },
  { id: '3', date: '2026-06-16', factorId: 'PCR', factorName: 'Put/Call', factorEmoji: '🎯', note: 'PCR创新低，Put交易量飙升。市场恐慌情绪在积累。', mood: '😤', learning: 'PCR极端值往往是反向信号——极度恐慌=买入机会。', createdAt: Date.now() - 172800000 },
  { id: '4', date: '2026-06-15', factorId: 'ESG', factorName: 'MSCI ESG', factorEmoji: '🌿', note: 'ESG因子本周开始走强，可能是资金在调仓。', mood: '😀', learning: 'ESG是慢变量，不适合短线——适合月度定投。', createdAt: Date.now() - 259200000 },
];

interface Props {
  dark?: boolean;
  entries?: DiaryEntry[];
  onSave?: (entry: DiaryEntry) => void;
  onDelete?: (id: string) => void;
}

const MOODS = ['😀', '🤔', '😤', '🎉', '😴'] as const;
const MOOD_LABELS: Record<string, string> = { '😀': '不错', '🤔': '困惑', '😤': '焦虑', '🎉': '兴奋', '😴': '无聊' };

export default function FactorDiary({ dark = true, entries: initialEntries = DEMO_ENTRIES, onSave, onDelete }: Props) {
  const [entries, setEntries] = useState<DiaryEntry[]>(initialEntries);
  const [showForm, setShowForm] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [newLearning, setNewLearning] = useState('');
  const [newMood, setNewMood] = useState<typeof MOODS[number]>('😀');
  const [selectedFactor, setSelectedFactor] = useState('');

  const c = dark ? {
    bg: '#0a0e1a', s: '#111827', sh: '#1a2236', b: '#1e293b', t: '#e2e8f0', t2: '#64748b',
    a: '#3b82f6', ab: '#1e3a5f', ok: '#22c55e', er: '#ef4444', wa: '#f59e0b',
  } : {
    bg: '#f8fafc', s: '#ffffff', sh: '#f1f5f9', b: '#e2e8f0', t: '#0f172a', t2: '#64748b',
    a: '#2563eb', ab: '#dbeafe', ok: '#16a34a', er: '#dc2626', wa: '#d97706',
  };

  const grouped = useMemo(() => {
    const groups: Record<string, DiaryEntry[]> = {};
    entries.forEach(e => {
      const key = e.date;
      if (!groups[key]) groups[key] = [];
      groups[key].push(e);
    });
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [entries]);

  const streakCount = useMemo(() => {
    const dates = [...new Set(entries.map(e => e.date))].sort().reverse();
    let streak = 0;
    const today = new Date().toISOString().slice(0, 10);
    let check = new Date(today);
    for (const d of dates) {
      if (d === check.toISOString().slice(0, 10)) { streak++; check.setDate(check.getDate() - 1); }
      else break;
    }
    return streak;
  }, [entries]);

  const addEntry = useCallback(() => {
    if (!selectedFactor || !newNote) return;
    const entry: DiaryEntry = {
      id: Date.now().toString(36),
      date: new Date().toISOString().slice(0, 10),
      factorId: selectedFactor,
      factorName: selectedFactor,
      factorEmoji: '📊',
      note: newNote,
      mood: newMood,
      learning: newLearning,
      createdAt: Date.now(),
    };
    setEntries([entry, ...entries]);
    setShowForm(false); setNewNote(''); setNewLearning(''); setSelectedFactor('');
    onSave?.(entry);
  }, [selectedFactor, newNote, newMood, newLearning, entries, onSave]);

  const delEntry = useCallback((id: string) => {
    setEntries(entries.filter(e => e.id !== id));
    onDelete?.(id);
  }, [entries, onDelete]);

  return <div style={{ padding: 14, background: c.bg, color: c.t, fontFamily: 'system-ui, sans-serif', maxWidth: 520, margin: '0 auto', borderRadius: 14 }}>
    {/* ── Header ── */}
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
      <div>
        <div style={{ fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
          <BookOpen size={18} style={{ color: c.a }}/> 因子日记
        </div>
        <div style={{ fontSize: 11, color: c.t2, marginTop: 2 }}>
          🔥 连续 {streakCount} 天记录 · {entries.length} 条心得
        </div>
      </div>
      <button onClick={() => setShowForm(!showForm)} style={{
        display: 'flex', alignItems: 'center', gap: 4, padding: '6px 14px', borderRadius: 10,
        background: showForm ? c.er : c.a, color: '#fff', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
      }}>
        {showForm ? '取消' : <><Plus size={14}/> 写日记</>}
      </button>
    </div>

    {/* ── New Entry Form ── */}
    {showForm && <div style={{ padding: 12, borderRadius: 10, background: c.s, border: `1px solid ${c.b}`, marginBottom: 14 }}>
      <input value={selectedFactor} onChange={e => setSelectedFactor(e.target.value)} placeholder="因子名称 (如: PE TTM, 1月动量)" style={{
        width: '100%', padding: '8px 12px', borderRadius: 8, border: `1px solid ${c.b}`, background: c.sh, color: c.t, fontSize: 12, marginBottom: 8, boxSizing: 'border-box', outline: 'none',
      }}/>
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 10, color: c.t2, marginBottom: 4 }}>今天的心情</div>
        <div style={{ display: 'flex', gap: 6 }}>
          {MOODS.map(m => <button key={m} onClick={() => setNewMood(m)} style={{
            padding: '4px 10px', borderRadius: 8, fontSize: 16, cursor: 'pointer', border: newMood === m ? `2px solid ${c.a}` : `1px solid ${c.b}`, background: newMood === m ? c.ab : 'transparent',
          }} title={MOOD_LABELS[m]}>{m}</button>)}
        </div>
      </div>
      <textarea value={newNote} onChange={e => setNewNote(e.target.value)} placeholder="今天的观察..." rows={2} style={{
        width: '100%', padding: '8px 12px', borderRadius: 8, border: `1px solid ${c.b}`, background: c.sh, color: c.t, fontSize: 12, marginBottom: 8, boxSizing: 'border-box', outline: 'none', resize: 'vertical',
      }}/>
      <input value={newLearning} onChange={e => setNewLearning(e.target.value)} placeholder="学到了什么..." style={{
        width: '100%', padding: '8px 12px', borderRadius: 8, border: `1px solid ${c.b}`, background: c.sh, color: c.t, fontSize: 12, marginBottom: 8, boxSizing: 'border-box', outline: 'none',
      }}/>
      <button onClick={addEntry} style={{ width: '100%', padding: '10px', borderRadius: 10, background: c.a, color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
        保存日记
      </button>
    </div>}

    {/* ── Entries ── */}
    {grouped.map(([date, dayEntries]) => (
      <div key={date} style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: c.t2, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Calendar size={12}/> {date}
        </div>
        {dayEntries.map(e => (
          <div key={e.id} style={{ padding: 10, borderRadius: 8, background: c.s, border: `1px solid ${c.b}`, marginBottom: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 18 }}>{e.factorEmoji}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: c.t }}>{e.factorName}</span>
                <span style={{ fontSize: 16 }}>{e.mood}</span>
              </div>
              <button onClick={() => delEntry(e.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: c.t2, padding: 2 }}>
                <Trash2 size={12}/>
              </button>
            </div>
            <div style={{ fontSize: 12, color: c.t, marginBottom: 4 }}>📝 {e.note}</div>
            {e.learning && <div style={{ fontSize: 11, color: c.ok, padding: '6px 8px', borderRadius: 6, background: c.ok + '08' }}>💡 学到了: {e.learning}</div>}
          </div>
        ))}
      </div>
    ))}

    {entries.length === 0 && <div style={{ textAlign: 'center', padding: 30, color: c.t2 }}>还没有日记。开始记录你的因子心得吧！</div>}

    {/* ─── Weekly Summary ─── */}
    <div style={{ marginTop: 14, padding: 12, borderRadius: 10, background: c.sh, border: `1px solid ${c.b}` }}>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
        <TrendingUp size={14} style={{ color: c.a }}/> 本周回顾
      </div>
      <div style={{ fontSize: 12, color: c.t2 }}>
        📊 记录了 {entries.filter(e => { const d = new Date(e.date); const now = new Date(); const diff = (now.getTime() - d.getTime()) / 86400000; return diff <= 7; }).length} 条本周心得
      </div>
      <div style={{ fontSize: 12, color: c.t2, marginTop: 2 }}>
        😴 最常心情: 困惑 — 投资本来就是一场持续的学习
      </div>
    </div>
  </div>;
}
