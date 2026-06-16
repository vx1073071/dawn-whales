// @ts-nocheck
import React, { useState } from 'react';

/* ====== Types ====== */
interface FollowUpQuestion { id: string; question: string; options: { text: string; icon: string; impact: string }[]; context: string; whyAsking: string; }
interface UserProfile { riskTolerance: string; horizon: string; style: string; confidence: number; }

/* ====== Mock Data ====== */
const followUpScenarios: FollowUpQuestion[] = [
  {
    id: 'fq1', question: '如果明天你的账户突然亏了15%，你的第一反应是什么？', context: '策略选择', whyAsking: '我不是在考你 — 是在帮你找到你能睡得着觉的策略。激进派和保守派的策略完全不一样。',
    options: [
      { text: '立刻全部卖出', icon: '😱', impact: '说明你更适合低风险策略' },
      { text: '先看原因再决定', icon: '🤔', impact: '理性投资者，适合中等风险' },
      { text: '加仓抄底', icon: '🤑', impact: '激进风格，能承受高波动' },
      { text: '不确定', icon: '😐', impact: '你需要积累更多经验' }
    ]
  },
  {
    id: 'fq2', question: '你计划这笔投资持有多久？', context: '投资规划', whyAsking: '不同的持有期限适合完全不同的因子和策略。短期看动量，长期看基本面。',
    options: [
      { text: '几天内', icon: '⚡', impact: '短线交易，看日内/隔夜' },
      { text: '几周到几个月', icon: '📅', impact: '波段交易，趋势因子最合适' },
      { text: '半年到一年', icon: '🗓️', impact: '中期投资，可配置价值因子' },
      { text: '3年以上', icon: '🏔️', impact: '长线投资，看基本面+股息' }
    ]
  },
  {
    id: 'fq3', question: '你更喜欢哪种赚钱方式？', context: '交易风格', whyAsking: '每个人的节奏不一样。有人喜欢快进快出，有人喜欢买了放着。没有对错，只有适合。',
    options: [
      { text: '快进快出，赚了就跑', icon: '🚀', impact: '短线动量策略最适合你' },
      { text: '看准了重仓赌一把', icon: '🎯', impact: '集中投资，交易频率低' },
      { text: '慢慢来，稳稳赚', icon: '🐢', impact: '稳健配置，股息+指数' },
      { text: '不太确定，新手 ', icon: '🌱', impact: '新手引导模式，简单策略' }
    ]
  }
];

/* ====== Main Component ====== */

export default function AIFollowUp() {
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [showProfile, setShowProfile] = useState(false);
  const [thinking, setThinking] = useState(false);

  const question = followUpScenarios[currentQ];

  const handleAnswer = (text: string) => {
    setAnswers(prev => ({ ...prev, [question.id]: text }));
    setThinking(true);
    setTimeout(() => {
      setThinking(false);
      if (currentQ < followUpScenarios.length - 1) {
        setCurrentQ(prev => prev + 1);
      } else {
        setShowProfile(true);
      }
    }, 800);
  };

  const progressPct = ((currentQ + (Object.keys(answers).includes(question?.id || '') ? 1 : 0)) / followUpScenarios.length) * 100;

  if (showProfile) {
    return (
      <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900">
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
          <span className="text-6xl mb-4">🐋</span>
          <h2 className="text-xl font-bold text-gray-900 mb-2">鲸灵了解你了！</h2>
          <p className="text-sm text-gray-500 mb-6 text-center">根据你的回答，我看到一个{answers['fq1']?.includes('抄底') ? '愿意冒险' : answers['fq1']?.includes('卖出') ? '比较谨慎' : '理性'}{answers['fq2']?.includes('几天') ? '但有点着急' : '且有耐心'}的投资者</p>
          <div className="grid grid-cols-2 gap-3 w-full max-w-sm mb-6">
            {['🐋 低波稳健策略', '📋 布林带回归', '🛡️ 股息防御组合', '📊 因子分散配置'].map((s, i) => (
              <div key={i} className="p-3 rounded-xl border border-gray-200 bg-white text-center text-sm font-medium text-gray-700 hover:shadow-md cursor-pointer">{s}</div>
            ))}
          </div>
          <div className="flex gap-3">
            <button onClick={() => { setCurrentQ(0); setAnswers({}); setShowProfile(false); }} className="px-4 py-2 rounded-lg bg-gray-100 text-sm">重做</button>
            <button className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-bold hover:bg-blue-700">应用推荐</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-indigo-500 to-blue-600 text-white">
        <h2 className="text-lg font-bold">🤖 鲸灵想了解你</h2>
        <p className="text-xs text-white/80">回答3个问题，帮你找到最适合的策略</p>
      </div>

      {/* Progress */}
      <div className="px-4 py-2 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
          <span>第 {currentQ + 1}/{followUpScenarios.length} 问</span>
          <span>{Math.round(progressPct)}%</span>
        </div>
        <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-indigo-400 to-blue-500 rounded-full transition-all" style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      {/* Question */}
      <div className="flex-1 flex flex-col justify-center px-6 py-8">
        {thinking ? (
          <div className="text-center">
            <span className="text-4xl animate-bounce inline-block">🐋</span>
            <p className="text-sm text-gray-500 mt-3">分析中...</p>
          </div>
        ) : (
          <>
            {/* Context */}
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2 py-0.5 rounded text-xs bg-indigo-100 text-indigo-600">{question.context}</span>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-6 leading-snug">{question.question}</h3>
            <div className="space-y-2 mb-6">
              {question.options.map(opt => (
                <button key={opt.text} onClick={() => handleAnswer(opt.text)} className="w-full flex items-center gap-3 p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-indigo-300 hover:shadow-md transition-all text-left group">
                  <span className="text-2xl flex-shrink-0">{opt.icon}</span>
                  <div>
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{opt.text}</p>
                    <p className="text-xs text-gray-400 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">{opt.impact}</p>
                  </div>
                </button>
              ))}
            </div>
            {/* Why asking */}
            <div className="flex items-start gap-2 p-3 rounded-lg bg-indigo-50 dark:bg-indigo-900/10">
              <span className="text-xs">💡</span>
              <p className="text-xs text-indigo-600 dark:text-indigo-400 leading-relaxed">{question.whyAsking}</p>
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t bg-white dark:bg-gray-800 text-xs text-gray-400 flex items-center justify-between">
        <span>🤖 AI理解你的投资偏好</span>
        <span>免费 · 策略推荐</span>
      </div>
    </div>
  );
}
