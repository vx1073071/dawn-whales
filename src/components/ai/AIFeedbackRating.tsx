/**
* AIFeedbackRating — ML R183 P2-03 [P0] 点赞/踩反馈闭环
* Thumbs up/down on each AI response with optional reason.
* Feeds back into user trust score and AI preference learning.
*/

import { useState, useCallback } from 'react';

// ── Types ───────────────────────────────────────────────────────────────

export type FeedbackRating = 'up' | 'down' | null;

interface FeedbackReason {
  rating: FeedbackRating;
  reason: string;
  timestamp: string;
}

interface AIFeedbackRatingProps {
  /** Current rating */
  rating: FeedbackRating;
  /** Called when rating changes */
  onRate: (rating: FeedbackRating, reason?: string) => void;
  /** Whether to show detailed reason picker */
  showReasons?: boolean;
  /** Compact mode for inline use */
  compact?: boolean;
  className?: string;
}

// ── Predefined reasons ─────────────────────────────────────────────────

const UP_REASONS = [
  '分析准确',
  '建议有用',
  '解释清晰',
  '数据充分',
  '节省时间',
];

const DOWN_REASONS = [
  '分析不准确',
  '建议不可行',
  '解释不清楚',
  '数据不够',
  '太贵了',
  '不是我想要的',
];

// ── Component ───────────────────────────────────────────────────────────

export default function AIFeedbackRating({
  rating,
  onRate,
  showReasons = true,
  compact = false,
  className = '',
}: AIFeedbackRatingProps) {
  const [showReasonPicker, setShowReasonPicker] = useState(false);
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [submitted, setSubmitted] = useState(false);

  const handleRate = useCallback(
    (r: FeedbackRating) => {
      if (r === rating) {
        // Toggle off
        onRate(null);
        setSubmitted(false);
        return;
      }

      onRate(r);
      if (r === 'up') {
        // Quick positive — no reason needed
        setSubmitted(true);
        setTimeout(() => setSubmitted(false), 3000);
      } else if (r === 'down' && showReasons) {
        setShowReasonPicker(true);
      } else {
        setSubmitted(true);
        setTimeout(() => setSubmitted(false), 3000);
      }
    },
    [rating, onRate, showReasons]
  );

  const handleReasonSubmit = useCallback(
    (reason: string) => {
      setSelectedReason(reason);
      setShowReasonPicker(false);
      setSubmitted(true);
      onRate('down', reason);
      setTimeout(() => setSubmitted(false), 5000);
    },
    [onRate]
  );

  if (submitted && !compact) {
    return (
      <div className={`flex items-center gap-2 text-xs text-green-400 bg-green-500/5 border border-green-500/10 rounded p-2 ${className}`}>
        <span>✅</span>
        <span>感谢反馈！我们会持续改进</span>
      </div>
    );
  }

  if (compact) {
    return (
      <div className={`inline-flex items-center gap-0.5 ${className}`}>
        <button
          onClick={() => handleRate('up')}
          className={`p-1 rounded transition-colors ${
            rating === 'up' ? 'text-green-400 bg-green-500/10' : 'text-gray-600 hover:text-green-400'
          }`}
          title="有用"
        >
          👍
        </button>
        <button
          onClick={() => handleRate('down')}
          className={`p-1 rounded transition-colors ${
            rating === 'down' ? 'text-red-400 bg-red-500/10' : 'text-gray-600 hover:text-red-400'
          }`}
          title="没用"
        >
          👎
        </button>
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-gray-500">这个回答对你有帮助吗？</span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => handleRate('up')}
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-all ${
              rating === 'up'
                ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                : 'bg-white/5 text-gray-500 hover:text-green-400 border border-transparent'
            }`}
          >
            👍 有用
          </button>
          <button
            onClick={() => handleRate('down')}
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-all ${
              rating === 'down'
                ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                : 'bg-white/5 text-gray-500 hover:text-red-400 border border-transparent'
            }`}
          >
            👎 没用
          </button>
        </div>
      </div>

      {/* Reason picker for thumbs down */}
      {showReasonPicker && (
        <div className="bg-[#1A1A24] border border-white/10 rounded-lg p-3 space-y-2">
          <div className="text-[10px] text-gray-400">请告诉我们哪里可以改进：</div>
          <div className="flex flex-wrap gap-1.5">
            {DOWN_REASONS.map((reason) => (
              <button
                key={reason}
                onClick={() => handleReasonSubmit(reason)}
                className={`px-2 py-1 rounded text-[10px] transition-all ${
                  selectedReason === reason
                    ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                    : 'bg-white/5 text-gray-400 hover:text-gray-300 border border-transparent'
                }`}
              >
                {reason}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowReasonPicker(false)}
            className="text-[9px] text-gray-600 hover:text-gray-400"
          >
            跳过
          </button>
        </div>
      )}

      {/* Feedback stats (after some ratings) */}
      {submitted && selectedReason && (
        <div className="text-[9px] text-gray-500">
          已记录: "{selectedReason}" — 我们会优化相关算法
        </div>
      )}
    </div>
  );
}
