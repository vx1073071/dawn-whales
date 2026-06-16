// @ts-nocheck
import React, { useState } from 'react';

/* ====== Entry Config ====== */
interface EntryDef {
  id: string; emoji: string; title: string; desc: string;
  stats: { label: string; value: string }[];
  gradient: string; isNew: boolean;
}

const entries: EntryDef[] = [
  {
    id: 'dashboard', emoji: '🏠', title: '今日驾驶舱', desc: '3秒看全局：AI建议 + 指数 + 警报 + 自选股',
    stats: [{ label: '指数覆盖', value: '4' }, { label: '推送源', value: '40+' }, { label: 'AI建议', value: '每日' }],
    gradient: 'from-indigo-500 to-blue-600', isNew: true
  },
  {
    id: 'hub', emoji: '🧭', title: '统一枢纽', desc: '市场·因子·策略·AI 一站式深度学习',
    stats: [{ label: '因子', value: '320+' }, { label: '模板', value: '22' }, { label: 'AI功能', value: '10' }],
    gradient: 'from-purple-500 to-pink-600', isNew: false
  },
  {
    id: 'news', emoji: '📰', title: '自选股新闻', desc: '持仓相关AI摘要 + 智能推送 + 情绪分析',
    stats: [{ label: '新闻源', value: '40+' }, { label: 'AI摘要', value: '免费' }, { label: '推送', value: '实时' }],
    gradient: 'from-amber-500 to-orange-600', isNew: true
  }
];

const shortcuts = [
  { icon: '🔔', label: '突发推送', color: 'bg-red-500' },
  { icon: '🤖', label: '问AI', color: 'bg-indigo-500' },
  { icon: '🔍', label: '选股器', color: 'bg-purple-500' },
  { icon: '📋', label: '策略市场', color: 'bg-amber-500' },
  { icon: '📊', label: '回测', color: 'bg-green-500' },
  { icon: '⚙️', label: '设置', color: 'bg-gray-500' }
];

/* ====== Main Component ====== */

export default function HomeEntryPage() {
  const [activeFilter, setActiveFilter] = useState('ALL');

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-900 to-gray-900">
      <div className="max-w-2xl mx-auto px-5 py-8">
        {/* Logo + Status */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-xl shadow-blue-500/20 mb-3">
            <span className="text-3xl">🐋</span>
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">QUANT MOO</h1>
          <p className="text-sm text-gray-400">AI量化交易平台 · v2.7.0</p>
          <div className="flex items-center justify-center gap-3 mt-3 text-xs text-gray-500">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400" /> 5/5数据源在线</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400" /> USDT已连接</span>
          </div>
        </div>

        {/* 3 Main Entries */}
        <div className="space-y-3 mb-8">
          {entries.map(entry => (
            <div key={entry.id} className={`rounded-2xl bg-gradient-to-br ${entry.gradient} p-0.5 shadow-xl hover:scale-[1.01] transition-transform`}>
              <div className="bg-gray-900/95 backdrop-blur-sm rounded-2xl p-5">
                <div className="flex items-start gap-4">
                  <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${entry.gradient} flex items-center justify-center text-2xl flex-shrink-0 shadow-lg`}>
                    {entry.emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-lg font-bold text-white">{entry.title}</h3>
                      {entry.isNew && <span className="px-1.5 py-0.5 rounded-full text-xs bg-blue-500/30 text-blue-300 font-bold">NEW</span>}
                    </div>
                    <p className="text-sm text-gray-400 mb-3">{entry.desc}</p>
                    <div className="flex gap-3">
                      {entry.stats.map(s => (
                        <div key={s.label} className="text-center">
                          <p className="text-sm font-bold text-white">{s.value}</p>
                          <p className="text-xs text-gray-500">{s.label}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Quick Shortcuts */}
        <div className="mb-6">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">快捷入口</h3>
          <div className="grid grid-cols-6 gap-2">
            {shortcuts.map(s => (
              <div key={s.label} className="flex flex-col items-center gap-1 text-center cursor-pointer group">
                <div className={`w-10 h-10 rounded-xl ${s.color} flex items-center justify-center text-lg group-hover:scale-110 transition-transform shadow-lg`}>
                  {s.icon}
                </div>
                <span className="text-xs text-gray-500 group-hover:text-gray-300 transition-colors">{s.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Stats Footer */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { value: '320+', label: '因子' },
            { value: '22', label: '策略模板' },
            { value: '40+', label: '新闻源' },
            { value: '🔥', label: 'P2收费' }
          ].map(s => (
            <div key={s.label} className="text-center p-2 rounded-xl bg-white/5 border border-white/10">
              <p className="text-base font-bold text-white">{s.value}</p>
              <p className="text-xs text-gray-500">{s.label}</p>
            </div>
          ))}
        </div>

        <p className="text-center text-xs text-gray-600 mt-6">
          84个组件 → 3大入口简化 · 从功能堆砌到智能引导
        </p>
      </div>
    </div>
  );
}
