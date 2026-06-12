// ── R121 #43 IndicatorTemplates — 用户保存/加载常用指标组合 ────────────

import { useState, useCallback } from 'react';

export interface IndicatorTemplate {
  name: string;
  ids: string[];
}

const STORAGE_KEY = 'dw_indicator_templates';

function loadTemplates(): IndicatorTemplate[] {
  try { const raw = localStorage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) : []; }
  catch { return []; }
}

function saveTemplates(templates: IndicatorTemplate[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(templates)); } catch {}
}

/** @returns [templates list, save function, delete function, load function] */
export function useIndicatorTemplates() {
  const [templates, setTemplates] = useState<IndicatorTemplate[]>(loadTemplates);

  const saveTemplate = useCallback((name: string, ids: string[]) => {
    const updated = [...templates.filter(t => t.name !== name), { name, ids }];
    setTemplates(updated);
    saveTemplates(updated);
  }, [templates]);

  const deleteTemplate = useCallback((index: number) => {
    const updated = templates.filter((_, i) => i !== index);
    setTemplates(updated);
    saveTemplates(updated);
  }, [templates]);

  return { templates, saveTemplate, deleteTemplate } as const;
}

/** Inline template UI for IndicatorPanel */
export function IndicatorTemplatesUI({
  activeIds, onToggle,
}: {
  activeIds: string[];
  onToggle: (id: string) => void;
}) {
  const { templates, saveTemplate, deleteTemplate } = useIndicatorTemplates();
  const [saveName, setSaveName] = useState('');
  const [showSave, setShowSave] = useState(false);

  const applyTemplate = useCallback((ids: string[]) => {
    for (const id of ids) { if (!activeIds.includes(id)) onToggle(id); }
    for (const id of activeIds) { if (!ids.includes(id)) onToggle(id); }
  }, [activeIds, onToggle]);

  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center justify-between">
        <span className="text-[8px] text-[#484f58] font-mono">我的模板</span>
        <button onClick={() => setShowSave(!showSave)}
          className="text-[8px] text-[#3b82f6] hover:underline font-mono"
          disabled={activeIds.length === 0}>
          + 保存
        </button>
      </div>

      {showSave && (
        <div className="flex gap-1">
          <input value={saveName} onChange={e => setSaveName(e.target.value)} placeholder="模板名称"
            className="flex-1 bg-[#0d1117] border border-[#30363d] rounded px-1.5 py-0.5 text-[9px] text-[#c9d1d9] font-mono" />
          <button onClick={() => { saveTemplate(saveName.trim(), activeIds); setSaveName(''); setShowSave(false); }}
            disabled={!saveName.trim()}
            className="px-1.5 py-0.5 text-[8px] bg-[#3b82f620] text-[#3b82f6] rounded font-mono disabled:text-[#484f58]">保存</button>
        </div>
      )}

      {/* R125: 拖拽排序 + 预览 */}
      <div className="flex flex-col gap-0.5 max-h-32 overflow-y-auto">
        {templates.map((t, i) => (
          <div key={i}
            className="flex items-center gap-1 group px-1 py-0.5 rounded hover:bg-[#161b22] transition-colors cursor-grab active:cursor-grabbing"
            draggable
          >
            {/* Drag handle */}
            <span className="text-[6px] text-[#30363d] cursor-grab select-none">⠿</span>

            {/* Apply button */}
            <button onClick={() => applyTemplate(t.ids)}
              className="flex-1 text-left px-1.5 py-0.5 text-[8px] bg-[#0d1117] text-[#8b949e] rounded hover:bg-[#1c2333] hover:text-[#c9d1d9] font-mono truncate transition-colors"
              title={`点击应用: ${t.ids.join(', ')}`}>
              {t.name}
            </button>

            {/* Preview tooltip — shows indicator IDs on hover */}
            <span
              className="text-[7px] text-[#484f58] truncate max-w-[100px] hidden group-hover:inline"
              title={t.ids.join(', ')}
            >
              {t.ids.slice(0, 3).join(',')}{t.ids.length > 3 ? ` +${t.ids.length - 3}` : ''}
            </span>

            {/* Delete */}
            <button onClick={(e) => { e.stopPropagation(); deleteTemplate(i); }}
              className="text-[7px] text-[#484f58] hover:text-[#ef4444] opacity-0 group-hover:opacity-100 transition-opacity">
              ×
            </button>
          </div>
        ))}
        {templates.length === 0 && (
          <div className="text-[8px] text-center py-2 text-[#30363d]">暂无保存的模板</div>
        )}
      </div>
    </div>
  );
}
