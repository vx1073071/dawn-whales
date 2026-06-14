/**
* ConfidenceVisualizer — ML R182 P1-02 [P0] 置信度可视化
* Replaces bare numbers with color-coded stars + confidence levels.
* IC/IR/Sharpe → visual encoding: color bands + star ratings + confidence bars
*/

// ── Types ───────────────────────────────────────────────────────────────

export type ConfidenceLevel = 'high' | 'medium' | 'low' | 'none';

interface ConfidenceConfig {
  level: ConfidenceLevel;
  stars: number; // 1-5
  label: string;
  color: string;
  bg: string;
  border: string;
  textColor: string;
}

const CONFIDENCE_CONFIGS: Record<ConfidenceLevel, ConfidenceConfig> = {
  high: {
    level: 'high',
    stars: 5,
    label: '高置信',
    color: '#16a34a',
    bg: 'bg-green-500/10',
    border: 'border-green-500/20',
    textColor: 'text-green-400',
  },
  medium: {
    level: 'medium',
    stars: 3,
    label: '中置信',
    color: '#ca8a04',
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/20',
    textColor: 'text-yellow-400',
  },
  low: {
    level: 'low',
    stars: 1,
    label: '低置信',
    color: '#dc2626',
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
    textColor: 'text-red-400',
  },
  none: {
    level: 'none',
    stars: 0,
    label: '无数据',
    color: '#6b7280',
    bg: 'bg-gray-500/10',
    border: 'border-gray-500/20',
    textColor: 'text-gray-500',
  },
};

// ── Confidence calculation ──────────────────────────────────────────────

/**
 * Score IC into confidence level based on industry standards:
 * IC >= 0.05 → high (strong predictive power)
 * IC >= 0.03 → medium (moderate)
 * IC < 0.03  → low (weak)
 * Additionally penalized by high std error or small sample
 */
export function icConfidence(ic: number, stdError = 0.01, sampleSize = 252): ConfidenceLevel {
  const absIC = Math.abs(ic);
  const cv = absIC > 0 ? stdError / absIC : 999; // coefficient of variation

  // High uncertainty → downgrade
  if (cv > 0.5 || sampleSize < 100) return 'low';
  if (cv > 0.3) {
    if (absIC >= 0.05) return 'medium';
    return 'low';
  }

  if (absIC >= 0.05) return 'high';
  if (absIC >= 0.03) return 'medium';
  return 'low';
}

export function irConfidence(ir: number): ConfidenceLevel {
  if (ir >= 0.7) return 'high';
  if (ir >= 0.5) return 'medium';
  return 'low';
}

export function sharpeConfidence(sharpe: number): ConfidenceLevel {
  if (sharpe >= 1.5) return 'high';
  if (sharpe >= 0.8) return 'medium';
  return 'low';
}

// ── Star rating component ───────────────────────────────────────────────

interface StarRatingProps {
  confidence: ConfidenceLevel;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

export function StarRating({
  confidence,
  size = 'sm',
  showLabel = true,
  className = '',
}: StarRatingProps) {
  const cfg = CONFIDENCE_CONFIGS[confidence];
  const sizeClass = size === 'sm' ? 'text-[10px]' : size === 'md' ? 'text-xs' : 'text-sm';

  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      <span className={sizeClass}>
        {Array.from({ length: 5 }).map((_, i) => (
          <span
            key={i}
            className={i < cfg.stars ? cfg.textColor : 'text-gray-700'}
          >
            ★
          </span>
        ))}
      </span>
      {showLabel && (
        <span className={`text-[9px] font-medium ${cfg.textColor}`}>
          {cfg.label}
        </span>
      )}
    </span>
  );
}

// ── Confidence badge component ──────────────────────────────────────────

interface ConfidenceBadgeProps {
  confidence: ConfidenceLevel;
  label?: string;
  compact?: boolean;
  className?: string;
}

export function ConfidenceBadge({
  confidence,
  label,
  compact = false,
  className = '',
}: ConfidenceBadgeProps) {
  const cfg = CONFIDENCE_CONFIGS[confidence];

  if (compact) {
    return (
      <span
        className={`inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] font-medium ${cfg.bg} ${cfg.border} ${cfg.textColor} ${className}`}
      >
        <span>{cfg.stars >= 5 ? '🟢' : cfg.stars >= 3 ? '🟡' : cfg.stars >= 1 ? '🔴' : '⚪'}</span>
        {label || cfg.label}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium border ${cfg.bg} ${cfg.border} ${cfg.textColor} ${className}`}
    >
      <StarRating confidence={confidence} size="sm" showLabel={false} />
      <span>{label || cfg.label}</span>
    </span>
  );
}

// ── IC color-coded display ─────────────────────────────────────────────

interface ICColorDisplayProps {
  ic: number;
  stdError?: number;
  sampleSize?: number;
  showStars?: boolean;
  className?: string;
}

export function ICColorDisplay({
  ic,
  stdError = 0.01,
  sampleSize = 252,
  showStars = true,
  className = '',
}: ICColorDisplayProps) {
  const confidence = icConfidence(ic, stdError, sampleSize);
  const cfg = CONFIDENCE_CONFIGS[confidence];

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      {/* Color-coded IC bar */}
      <div className="relative w-16 h-5 bg-white/[0.03] rounded overflow-hidden">
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/10" />
        <div
          className="absolute top-0 bottom-0 rounded transition-all"
          style={{
            left: ic >= 0 ? '50%' : `${50 - Math.min(Math.abs(ic) / 0.08 * 50, 50)}%`,
            width: `${Math.min(Math.abs(ic) / 0.08 * 50, 50)}%`,
            backgroundColor: cfg.color,
            opacity: 0.7,
          }}
        />
        <span className="absolute inset-0 flex items-center justify-center text-[9px] font-mono font-bold text-white drop-shadow">
          {ic >= 0 ? '+' : ''}{ic.toFixed(3)}
        </span>
      </div>
      {showStars && <StarRating confidence={confidence} size="sm" showLabel={false} />}
    </div>
  );
}

// ── Normalized IR bar ──────────────────────────────────────────────────

interface IRColorDisplayProps {
  ir: number;
  showStars?: boolean;
  className?: string;
}

export function IRColorDisplay({ ir, showStars = true, className = '' }: IRColorDisplayProps) {
  const confidence = irConfidence(ir);
  const cfg = CONFIDENCE_CONFIGS[confidence];

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <div className="w-12 bg-white/5 rounded-full h-1.5">
        <div
          className="h-1.5 rounded-full transition-all"
          style={{ width: `${Math.min(ir / 1.5 * 100, 100)}%`, backgroundColor: cfg.color }}
        />
      </div>
      <span className={`text-[10px] font-mono font-medium ${cfg.textColor}`}>
        {ir.toFixed(2)}
      </span>
      {showStars && <StarRating confidence={confidence} size="sm" showLabel={false} />}
    </div>
  );
}

export { CONFIDENCE_CONFIGS };
export default ConfidenceBadge;
