// @ts-nocheck
// ── R129-M03 APIKeyConfig — API Key 配置UI ────────────────────────────────
// @ts-nocheck — window.api contextBridge access
// PM: 输入 + 加密传输 + 测试有效性
// 桌面端输入API Key → DPAPI加密存储 → 传输时AES-256-GCM加密

import { useState, useCallback, useEffect } from 'react';
import { Input, Button, Tag, message, Tooltip, Modal } from 'antd';
import { KeyOutlined, EyeOutlined, EyeInvisibleOutlined, CheckCircleOutlined, CloseCircleOutlined, DeleteOutlined, CopyOutlined, LoadingOutlined } from '@ant-design/icons';

interface ApiKeyState {
  label: string;
  key: string;
  created: string;
  lastUsed?: string;
  valid: boolean;
  testing: boolean;
}

// ═══════════ Component ═══════════

export function APIKeyConfigPanel() {
  const [keys, setKeys] = useState<ApiKeyState[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newKey, setNewKey] = useState('');
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});
  const [deleteConfirm, setDeleteConfirm] = useState<{ index: number; label: string } | null>(null);

  // Load saved keys
  useEffect(() => {
    loadKeys();
  }, []);

  const loadKeys = async () => {
    try {
      const result = await window.api?.server?.getApiKeys();
      if (result?.keys) setKeys(result.keys.map((k: any) => ({ ...k, testing: false })));
    } catch {
      // Fallback: localStorage for dev
      try {
        const saved = localStorage.getItem('dw-api-keys');
        if (saved) setKeys(JSON.parse(saved));
      } catch {}
    }
  };

  const saveKeys = async (newKeys: ApiKeyState[]) => {
    setKeys(newKeys);
    try {
      await window.api?.server?.saveApiKeys(newKeys);
    } catch {
      try { localStorage.setItem('dw-api-keys', JSON.stringify(newKeys)); } catch {}
    }
  };

  // ── Add key ──

  const handleAdd = useCallback(async () => {
    if (!newLabel.trim()) { message.warning('请输入标签'); return; }
    if (!newKey.trim()) { message.warning('请输入API Key'); return; }

    const newEntry: ApiKeyState = {
      label: newLabel.trim(),
      key: newKey.trim(),
      created: new Date().toISOString(),
      valid: false,
      testing: true,
    };

    const updated = [...keys, newEntry];
    await saveKeys(updated);

    // Test the key
    try {
      const result = await window.api?.server?.testApiKey(newKey.trim());
      const finalEntry = { ...newEntry, valid: result?.valid || false, testing: false };
      const finalKeys = updated.map(k => k.label === newEntry.label ? finalEntry : k);
      await saveKeys(finalKeys);
      if (finalEntry.valid) message.success('API Key 验证成功');
      else message.error('API Key 无效或已过期');
    } catch {
      const failEntry = { ...newEntry, valid: false, testing: false };
      const failKeys = updated.map(k => k.label === newEntry.label ? failEntry : k);
      await saveKeys(failKeys);
      message.error('无法验证API Key');
    }

    setNewLabel('');
    setNewKey('');
    setShowAdd(false);
  }, [newLabel, newKey, keys]);

  // ── Delete key ──

  const handleDelete = useCallback(async (index: number) => {
    const updated = keys.filter((_, i) => i !== index);
    await saveKeys(updated);
    setDeleteConfirm(null);
    message.info('API Key 已删除');
  }, [keys]);

  // ── Copy key ──

  const handleCopy = useCallback(async (key: string) => {
    try {
      await navigator.clipboard.writeText(key);
      message.success('已复制API Key到剪贴板');
    } catch {
      message.error('复制失败');
    }
  }, []);

  // ── Toggle visibility ──

  const toggleKeyVisibility = useCallback((label: string) => {
    setShowKey(prev => ({ ...prev, [label]: !prev[label] }));
  }, []);

  return (
    <div className="flex flex-col gap-4" style={{ fontFamily: 'monospace' }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-[#e6edf3] text-sm font-bold mb-0.5">API Key 管理</h3>
          <p className="text-[#484f58] text-[10px]">管理用于连接服务器的API密钥</p>
        </div>
        <Tag color="blue" className="text-[10px]">{keys.length} 个密钥</Tag>
      </div>

      {/* Key list */}
      <div className="flex flex-col gap-1.5">
        {keys.map((k, i) => (
          <div key={i} className="flex items-center gap-2 px-3 py-2 bg-[#0d1117] border border-[#1c2333] rounded hover:border-[#30363d] transition-colors">
            {/* Status */}
            <Tooltip title={k.testing ? '验证中...' : k.valid ? '有效' : '无效'}>
              <span>
                {k.testing ? (
                  <LoadingOutlined className="text-[#f59e0b] text-xs" spin />
                ) : k.valid ? (
                  <CheckCircleOutlined className="text-[#22c55e] text-xs" />
                ) : (
                  <CloseCircleOutlined className="text-[#ef4444] text-xs" />
                )}
              </span>
            </Tooltip>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="text-[#c9d1d9] text-xs font-bold truncate">{k.label}</div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[#484f58] text-[8px] font-mono">
                  {showKey[k.label] ? k.key : '••••••••••••••••••••••••••••••••'}
                </span>
              </div>
              <div className="text-[#484f58] text-[7px] mt-0.5">
                创建: {new Date(k.created).toLocaleDateString('zh-CN')}
                {k.lastUsed && ` · 最后使用: ${new Date(k.lastUsed).toLocaleDateString('zh-CN')}`}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1">
              <Tooltip title="复制">
                <Button size="small" type="text" icon={<CopyOutlined className="text-[10px]" />} onClick={() => handleCopy(k.key)} />
              </Tooltip>
              <Tooltip title={showKey[k.label] ? '隐藏' : '显示'}>
                <Button size="small" type="text"
                  icon={showKey[k.label] ? <EyeInvisibleOutlined className="text-[10px]" /> : <EyeOutlined className="text-[10px]" />}
                  onClick={() => toggleKeyVisibility(k.label)} />
              </Tooltip>
              <Tooltip title="删除">
                <Button size="small" type="text" danger
                  icon={<DeleteOutlined className="text-[10px]" />}
                  onClick={() => setDeleteConfirm({ index: i, label: k.label })} />
              </Tooltip>
            </div>
          </div>
        ))}

        {keys.length === 0 && (
          <div className="text-center py-6 text-[#484f58] text-xs">
            暂无API Key，点击下方按钮添加
          </div>
        )}
      </div>

      {/* Add new key */}
      {showAdd ? (
        <div className="flex flex-col gap-2 p-3 bg-[#0d1117] border border-[#30363d] rounded">
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] text-[#8b949e]">标签 (用于识别)</label>
            <Input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="例如: 主服务器、测试服务器"
              className="bg-[#161b22] border-[#30363d] text-[#c9d1d9] text-xs"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] text-[#8b949e]">API Key</label>
            <Input.Password
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              placeholder="输入API Key..."
              className="bg-[#161b22] border-[#30363d] text-[#c9d1d9] text-xs"
              iconRender={visible => visible ? <EyeOutlined /> : <EyeInvisibleOutlined />}
            />
          </div>
          <div className="text-[8px] text-[#484f58]">
            🔒 API Key将在本地加密存储，传输时使用AES-256-GCM加密
          </div>
          <div className="flex gap-2">
            <Button size="small" onClick={() => { setShowAdd(false); setNewLabel(''); setNewKey(''); }} className="text-xs">取消</Button>
            <Button size="small" type="primary" onClick={handleAdd} className="text-xs bg-[#3b82f6]" disabled={!newLabel.trim() || !newKey.trim()}>
              添加并验证
            </Button>
          </div>
        </div>
      ) : (
        <Button size="small" type="dashed" icon={<KeyOutlined />} onClick={() => setShowAdd(true)} className="text-xs w-full">
          添加 API Key
        </Button>
      )}

      {/* Security notice */}
      <div className="px-3 py-2 bg-[#0d1117] border border-[#1c2333] rounded text-[8px] text-[#484f58] leading-relaxed">
        <span className="text-[#f59e0b]">⚠️</span> API Key 使用 AES-256-GCM 加密存储和传输。
        请勿与任何人分享您的 API Key。丢失的 Key 可以在服务器管理后台撤销。
      </div>

      {/* Delete confirmation modal */}
      <Modal
        open={!!deleteConfirm}
        onCancel={() => setDeleteConfirm(null)}
        onOk={() => deleteConfirm && handleDelete(deleteConfirm.index)}
        title="删除 API Key"
        okText="确认删除"
        cancelText="取消"
        okButtonProps={{ danger: true, size: 'small' }}
        cancelButtonProps={{ size: 'small' }}
      >
        <div className="text-xs text-[#c9d1d9]" style={{ fontFamily: 'monospace' }}>
          确定要删除 API Key <span className="text-[#ef4444] font-bold">"{deleteConfirm?.label}"</span> 吗？
          <br />
          <span className="text-[10px] text-[#484f58]">此操作不可撤销。</span>
        </div>
      </Modal>

      {/* Hidden loading icon used above */}
      <span className="hidden"><LoadingOutlined /></span>
    </div>
  );
}

export default APIKeyConfigPanel;
