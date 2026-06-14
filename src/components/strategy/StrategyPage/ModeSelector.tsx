/**
 * R161 ML: ModeSelector — Strategy creation mode picker
 * 3 entries: AI (1U per use), Template (free), Form/Manual (free)
 * Displays pricing badge on AI card.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';

export type CreateMode = 'ai' | 'template' | 'form';

interface Props {
  onSelect: (mode: CreateMode) => void;
}

const modes: Array<{ id: CreateMode; icon: string; titleKey: string; descKey: string; price?: string; priceKey?: string }> = [
  {
    id: 'ai',
    icon: '🤖',
    titleKey: 'ModeSelector.aiTitle',
    descKey: 'ModeSelector.aiDesc',
    price: '1 USDT',
    priceKey: 'ModeSelector.aiPrice',
  },
  {
    id: 'template',
    icon: '📋',
    titleKey: 'ModeSelector.templateTitle',
    descKey: 'ModeSelector.templateDesc',
    price: 'FREE',
    priceKey: 'ModeSelector.free',
  },
  {
    id: 'form',
    icon: '⚙️',
    titleKey: 'ModeSelector.formTitle',
    descKey: 'ModeSelector.formDesc',
    price: 'FREE',
    priceKey: 'ModeSelector.free',
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
          <button
            key={m.id}
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

            {/* Arrow */}
            <div className="mt-3 flex items-center gap-1 text-[10px] text-gray-600 group-hover:text-[#C9A046] transition-colors">
              <span>{t('ModeSelector.getStarted', '开始创建')}</span>
              <span className="group-hover:translate-x-0.5 transition-transform">→</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default ModeSelector;
