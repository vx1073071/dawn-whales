// @ts-nocheck
import React from 'react';

/* ====== Types ====== */
interface EntryCard {
  id: string; emoji: string; title: string; desc: string;
  module: 'unified-hub' | 'watchlist-news' | 'daily-dashboard' | 'factor-hub' | 'template-hub' | 'ai-hub';
  isNew: boolean; isPaid: boolean; badge?: string;
  gradient: string;
}

/* ====== Config ====== */
const entries: EntryCard[] = [
  { id: 'dashboard', emoji: '🏠', title: '今日驾驶舱', desc: '3秒看全局，指数+警报+AI建议', module: 'daily-dashboard', isNew: true, isPaid: false, badge: '新', gradient: 'from-indigo-500 to-blue-600' },
  { id: 'hub', emoji: '🧭', title: '统一枢纽', desc: '市场·因子·策略·AI 一站式', module: 'unified-hub', isNew: false, isPaid: false, gradient: 'from-purple-500 to-pink-600' },
  { id: 'watchlist', emoji: '📰', title: '自选股新闻', desc: '持仓相关AI智能摘要', module: 'watchlist-news', isNew: true, isPaid: false, badge: 'AI', gradient: 'from-amber-500 to-orange-600' }
];

/* ====== Main Component ====== */

export default function AppEntryPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-6">
      <div className="max-w-lg w-full">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-2xl shadow-blue-500/30 mb-4">
            <span className="text-4xl">🐋</span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-1">QUANT MOO</h1>
          <p className="text-sm text-gray-400">AI 量化交易平台 v2.7.0</p>
          <div className="flex items-center justify-center gap-2 mt-3">
            <span className="w-2 h-2 rounded-full bg-green-400"/>
            <span className="text-xs text-gray-500">5/5 数据源在线 · USDT 钱包已连接</span>
          </div>
        </div>

        {/* Entry Cards */}
        <div className="space-y-3">
          {entries.map(entry => (
            <div key={entry.id} className={`relative rounded-xl bg-gradient-to-br ${entry.gradient} p-0.5 shadow-lg hover:scale-[1.02] transition-transform cursor-pointer`}>
              <div className="bg-gray-900/90 backdrop-blur rounded-xl p-4">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${entry.gradient} flex items-center justify-center text-2xl flex-shrink-0`}>
                    {entry.emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-base font-bold text-white">{entry.title}</h3>
                      {entry.isNew && <span className="px-1.5 py-0.5 rounded text-xs bg-blue-500/30 text-blue-300 font-bold">{entry.badge || 'NEW'}</span>}
                      {entry.isPaid && <span className="text-xs text-amber-400">💰</span>}
                    </div>
                    <p className="text-sm text-gray-400">{entry.desc}</p>
                  </div>
                  <span className="text-gray-500 text-lg">→</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mt-8">
          {[
            { value: '504', label: '组件' },
            { value: '22', label: '策略模板' },
            { value: '40+', label: '因子可用' }
          ].map(stat => (
            <div key={stat.label} className="text-center p-3 rounded-xl bg-white/5 border border-white/10">
              <p className="text-xl font-bold text-white">{stat.value}</p>
              <p className="text-xs text-gray-500">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-600 mt-8">
          选择入口开始 → 3大入口简化你的交易决策
        </p>
      </div>
    </div>
  );
}
