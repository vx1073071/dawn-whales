import { useEffect, useRef } from 'react';
import { SHORTCUT_MAP } from '@/hooks/useKeyboardShortcuts';

interface KeyboardShortcutsPanelProps {
  open: boolean;
  onClose: () => void;
}

export default function KeyboardShortcutsPanel({ open, onClose }: KeyboardShortcutsPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (open && panelRef.current) {
      panelRef.current.focus();
    }
  }, [open]);

  if (!open) return null;

  const groups = [
    {
      title: '全局导航',
      items: [
        { key: 'Ctrl+B', desc: SHORTCUT_MAP['Ctrl+B'] },
        { key: 'Ctrl+N', desc: SHORTCUT_MAP['Ctrl+N'] },
        { key: 'Ctrl+K', desc: '打开快捷键面板' },
        { key: 'Esc', desc: SHORTCUT_MAP['Esc'] },
      ],
    },
    {
      title: '页面切换（数字键）',
      items: [
        { key: '1', desc: SHORTCUT_MAP['1'] },
        { key: '2', desc: SHORTCUT_MAP['2'] },
        { key: '3', desc: SHORTCUT_MAP['3'] },
        { key: '4', desc: SHORTCUT_MAP['4'] },
        { key: '5', desc: SHORTCUT_MAP['5'] },
        { key: '6', desc: SHORTCUT_MAP['6'] },
        { key: '7', desc: SHORTCUT_MAP['7'] },
        { key: '8', desc: SHORTCUT_MAP['8'] },
        { key: '9', desc: SHORTCUT_MAP['9'] },
      ],
    },
  ];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        ref={panelRef}
        tabIndex={-1}
        className="relative bg-[#12121a] border border-white/10 rounded-xl w-full max-w-lg mx-4 shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
          <h2 className="text-white font-bold text-base">⌨️ 快捷键指南</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-300 text-sm px-2 py-1 rounded hover:bg-white/5 transition-colors"
          >
            Esc 关闭
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-5 max-h-[70vh] overflow-y-auto">
          {groups.map((group) => (
            <div key={group.title}>
              <h3 className="text-[#D4A853] text-xs font-medium uppercase tracking-wider mb-2.5">
                {group.title}
              </h3>
              <div className="space-y-1.5">
                {group.items.map((item) => (
                  <div
                    key={item.key}
                    className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/[0.02] hover:bg-white/[0.04] transition-colors"
                  >
                    <span className="text-gray-300 text-sm">{item.desc}</span>
                    <kbd className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded bg-[#1a1a25] border border-white/10 text-[11px] text-gray-400 font-mono">
                      {item.key.split('+').map((k, i) => (
                        <span key={i}>
                          {i > 0 && <span className="text-gray-600 mx-0.5">+</span>}
                          {k}
                        </span>
                      ))}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Tip */}
          <div className="text-[10px] text-gray-600 text-center pt-2">
            提示：在输入框/文本域中输入时快捷键不会触发
          </div>
        </div>
      </div>
    </div>
  );
}
