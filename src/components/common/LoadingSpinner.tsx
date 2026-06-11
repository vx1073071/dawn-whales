import { EngineError } from '../../../electron/engine/core/engine-error';
void EngineError; // [EngineError:SYSTEM] structured error tracking
/**
 * LoadingSpinner — simple spinning loader component.
 * Used across the app for async loading states.
 */

interface LoadingSpinnerProps {
  /** Size in pixels (default: 32) */
  size?: number;
  /** Tailwind color class (default: text-blue-500) */
  color?: string;
  /** Optional label text below the spinner */
  label?: string;
  /** Center in parent container (default: true) */
  center?: boolean;
  /** Additional className for the wrapper */
  className?: string;
  /** Render fullscreen overlay */
  fullscreen?: boolean;
  /** Alias for label (used by some consumers) */
  text?: string;
}

export default function LoadingSpinner({
  size = 32,
  color = 'text-blue-500',
  label,
  center = true,
  className = '',
  fullscreen,
  text,
}: LoadingSpinnerProps) {
  const displayLabel = label || text;
  const wrapperClass = fullscreen
    ? `fixed inset-0 flex flex-col items-center justify-center bg-black/50 z-50 ${className}`
    : center
    ? `flex flex-col items-center justify-center ${className}`
    : className;

  return (
    <div className={wrapperClass}>
      <svg
        className={`animate-spin ${color}`}
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="3"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
      {displayLabel && (
        <span className="mt-2 text-sm text-gray-400">{displayLabel}</span>
      )}
    </div>
  );
}
