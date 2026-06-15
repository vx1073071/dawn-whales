/**
 * R161 ML: ModeSelector — Strategy creation mode picker
 * 3 entries: AI (1U per use), Template (free), Form/Manual (free)
 * Displays pricing badge on AI card.
 * R218 ML#3: Added difficulty stars (1-5) + template preview tooltip
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Tooltip } from 'antd';
import { StarFilled, StarOutlined } from '@ant-design/icons';

export type CreateMode = 'ai' | 'template' | 'form';

interface Props {
  onSelect: (mode: CreateMode) => void;
}

const modes: Array<{
  id: CreateMode;
  icon: string;
  titleKey: string;
  descKey: string;
  price?: string;
  priceKey?: string;
  difficulty: number; // 1-5 stars
  sampleTplName?: string;
  sampleTplDesc?: string;
}> = [
  {
    id: 'ai',
    icon: '🤖',
    titleKey: 'ModeSelector.aiTitle',
    descKey: 'ModeSelector.aiDesc',
    price: '1 USDT',
    priceKey: 'ModeSelector.aiPrice',
    difficulty: 2, // AI 简单
    sampleTplName: 'AI 智能生成',
    sampleTplDesc: '自然语言描述 → AI 1分钟生成策略代码和参数',
  },
  {
    id: 'template',
    icon: '📋',
    titleKey: 'ModeSelector.templateTitle',
    descKey: 'ModeSelector.templateDesc',
    price: 'FREE',
    difficulty: 3, // 模板中等
    sampleTplName: '88 核心策略',
    sampleTplDesc: '财报猎人 / 港股高息 / BTC趋势 等',
  },
  {
    id: 'form',
    icon: '⚙️',
    titleKey: 'ModeSelector.formTitle',
    descKey: 'ModeSelector.formDesc',
    price: 'FREE',
    priceKey: 'ModeSelector.free',
    difficulty: 5, // 手动最复杂
    sampleTplName: '从零构建',
    sampleTplDesc: '自定义因子、权重、止损、仓位 全手动',
  },
];

export const ModeSelector: React.FC<Props> = ({ onSelect }) => {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-white mb-1">{t('ModeSelector.heading', '选择创建方式')}</h2>
      <p className="text-sm text-gray-400 mb-6">{t('ModeSelector.subheading', '三种方式创建你的量化策略')}</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {modes.map((m) => (
          <Tooltip
            key={m.id}
            title={
              <div>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>📌 样例: {m.sampleTplName}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)' }}>{m.sampleTplDesc}</div>
              </div>
            }
            placement="top"
          >
            <button
              onClick={() => onSelect(m.id)}
              className="group relative bg-[#1a1a25] border border-white/5 rounded-xl p-5 text-left hover:border-[#C9A046]/40 hover:bg-[#1a1a28] transition-all duration-200 hover:shadow-lg hover:shadow-[#C9A046]/5"
            >
              {/* Price badge */}
              <div className={`absolute top-3 right-3 px-2 py-0.5 rounded text-[10px] font-bold ${
                m.price === 'FREE'
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                  : 'bg-[#C9A046]/15 text-[#C9A046] border border-[#C9A046]/20'
              }`}>
                {m.price === 'FREE' ? t(m.priceKey!, '免费') : m.price}
              </div>

              {/* Icon */}
              <div className="text-3xl mb-3 group-hover:scale-110 transition-transform">
                {m.icon}
              </div>

              {/* Title */}
              <h3 className="text-sm font-semibold text-white mb-1.5">
                {t(m.titleKey)}
              </h3>

              {/* Description */}
              <p className="text-xs text-gray-500 leading-relaxed">
                {t(m.descKey)}
              </p>

              {/* R218 ML#3: Difficulty stars (1-5) */}
              <div className="mt-3 flex items-center gap-2">
                <span className="text-[10px] text-gray-500">难度</span>
                <div className="flex">
                  {Array.from({ length: 5 }, (_, i) => (
                    i < m.difficulty
                      ? <StarFilled key={i} style={{ fontSize: 11, color: '#C9A046' }} />
                      : <StarOutlined key={i} style={{ fontSize: 11, color: '#3f3f46' }} />
                  ))}
                </div>
                <span className="text-[10px] text-gray-600">({m.difficulty}/5)</span>
              </div>

              {/* Arrow */}
              <div className="mt-3 flex items-center gap-1 text-[10px] text-gray-600 group-hover:text-[#C9A046] transition-colors">
                <span>{t('ModeSelector.getStarted', '开始创建')}</span>
                <span className="group-hover:translate-x-0.5 transition-transform">→</span>
              </div>
            </button>
          </Tooltip>
        ))}
      </div>
    </div>
  );
};

export default ModeSelector;
