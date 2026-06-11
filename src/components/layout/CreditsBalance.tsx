/**
 * CreditsBalance — USDT credits display for Header
 * 
 * R102 M-01: Shows USDT balance with 6 decimal precision
 * - Compact display for header bar
 * - Credits logo (💰 or token icon)
 * - Click to navigate to credits history
 */

import { useCredits } from '@/hooks/useCredits';

interface CreditsBalanceProps {
  onClick?: () => void;
}

export default function CreditsBalance({ onClick }: CreditsBalanceProps) {
  const { balance } = useCredits();

  const formatted = balance.toFixed(6);
  const [intPart, decPart] = formatted.split('.');

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#1a1a25] border border-white/5 hover:border-[#D4A853]/30 transition-colors cursor-pointer group"
      title={`USDT Credits: ${formatted}`}
    >
      {/* Credits icon */}
      <span className="text-sm">💰</span>
      
      {/* Balance */}
      <div className="flex flex-col leading-tight">
        <div className="flex items-baseline gap-0.5">
          <span className="text-white text-xs font-bold tabular-nums">{intPart}</span>
          <span className="text-gray-400 text-[10px] tabular-nums">.{decPart}</span>
        </div>
        <span className="text-[8px] text-[#D4A853] font-medium tracking-wider">USDT</span>
      </div>
    </button>
  );
}
