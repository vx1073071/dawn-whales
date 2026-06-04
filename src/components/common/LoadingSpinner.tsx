;

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  fullscreen?: boolean;
  inline?: boolean;
  text?: string;
}

export default function LoadingSpinner({ size = 'md', fullscreen = false, inline = false, text }: LoadingSpinnerProps) {
  const sizeMap = { sm: 'w-4 h-4 border-2', md: 'w-8 h-8 border-[3px]', lg: 'w-12 h-12 border-4' };

  const spinner = (
    <div className={`${sizeMap[size]} border-white/10 border-t-[#C9A046] rounded-full animate-spin`} />
  );

  if (fullscreen) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[200px] gap-3">
        {spinner}
        {text && <span className="text-sm text-gray-400">{text}</span>}
      </div>
    );
  }

  if (inline) {
    return (
      <span className="inline-flex items-center gap-2">
        {spinner}
        {text && <span className="text-sm text-gray-400">{text}</span>}
      </span>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-8 gap-2">
      {spinner}
      {text && <span className="text-sm text-gray-400">{text}</span>}
    </div>
  );
}

export function PageLoading() {
  return (
    <div className="flex items-center justify-center h-full">
      <LoadingSpinner size="lg" text="加载中..." />
    </div>
  );
}
