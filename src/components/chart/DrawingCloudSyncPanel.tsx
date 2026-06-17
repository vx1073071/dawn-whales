import { useState, useCallback } from 'react';

// ── Drawing Cloud Sync UI ── ML#6 R267 (4h)
// Sync drawings across devices, collaboration features

interface CloudDrawing {
  id: string;
  name: string;
  symbol: string;
  type: string;
  lines: number;
  updatedAt: string;
  isShared: boolean;
  syncedDevices: number;
  size: string;
}

interface DrawingCloudSyncProps {
  drawings: CloudDrawing[];
  isLoggedIn: boolean;
}

const DrawingCloudSyncPanel = ({ drawings, isLoggedIn }: DrawingCloudSyncProps) => {
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle');
  const [selectedDrawings, setSelectedDrawings] = useState<Set<string>>(new Set());
  const [showShare, setShowShare] = useState(false);
  const [shareTarget, setShareTarget] = useState('');

  const triggerSync = useCallback(() => {
    if (!isLoggedIn) return;
    setSyncing(true);
    setSyncStatus('syncing');
    setTimeout(() => {
      setSyncing(false);
      setSyncStatus('synced');
      setTimeout(() => setSyncStatus('idle'), 2000);
    }, 1500);
  }, [isLoggedIn]);

  const toggleSelect = (id: string) => {
    const next = new Set(selectedDrawings);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedDrawings(next);
  };

  const selectAll = () => {
    if (selectedDrawings.size === drawings.length) setSelectedDrawings(new Set());
    else setSelectedDrawings(new Set(drawings.map(d => d.id)));
  };

  return (
    <div className="drawing-cloud-sync" style={{ padding: 12, fontFamily: 'system-ui', fontSize: 12, maxWidth: 440 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontWeight: 700, fontSize: 14 }}>☁️ 画线云同步</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            fontSize: 9, padding: '1px 6px', borderRadius: 10,
            background: syncStatus === 'synced' ? '#dcfce7' : syncStatus === 'syncing' ? '#fef9c3' : '#f1f5f9',
            color: syncStatus === 'synced' ? '#16a34a' : syncStatus === 'syncing' ? '#ca8a04' : '#64748b',
          }}>
            {syncStatus === 'syncing' ? '⏳ 同步中' : syncStatus === 'synced' ? '✅ 已同步' : syncStatus === 'error' ? '❌ 失败' : '💤 待机'}
          </span>
        </div>
      </div>

      {/* Login Prompt */}
      {!isLoggedIn && (
        <div style={{
          padding: 16, borderRadius: 8, textAlign: 'center',
          background: '#f0f9ff', border: '1px solid #bae6fd', marginBottom: 10,
        }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>☁️</div>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>登录后启云同步</div>
          <div style={{ fontSize: 10, color: '#64748b', marginBottom: 10, lineHeight: 1.5 }}>
            画线自动同步到云端 · 多设备无缝切换 · 与团队共享画线 · 历史版本管理
          </div>
          <button style={{
            padding: '6px 20px', borderRadius: 6, border: 'none',
            background: '#3b82f6', color: 'white', fontWeight: 600, cursor: 'pointer',
          }}>
            🔑 登录/注册
          </button>
        </div>
      )}

      {/* Sync Controls */}
      {isLoggedIn && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          <button
            onClick={triggerSync}
            disabled={syncing}
            style={{
              flex: 1, padding: '6px 0', borderRadius: 6, border: 'none',
              background: syncing ? '#93c5fd' : '#3b82f6', color: 'white',
              fontWeight: 600, fontSize: 11, cursor: syncing ? 'default' : 'pointer',
            }}
          >
            {syncing ? '⏳ 同步中...' : '🔄 立即同步'}
          </button>
          <button onClick={selectAll} style={{
            padding: '6px 12px', borderRadius: 6, border: '1px solid #d1d5db',
            background: 'white', fontSize: 11, cursor: 'pointer',
          }}>
            {selectedDrawings.size === drawings.length ? '取消全选' : '全选'}
          </button>
          <button onClick={() => setShowShare(!showShare)} style={{
            padding: '6px 12px', borderRadius: 6, border: '1px solid #d1d5db',
            background: 'white', fontSize: 11, cursor: 'pointer',
          }}>
            📤
          </button>
        </div>
      )}

      {/* Drawings List */}
      {isLoggedIn && drawings.length > 0 && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#94a3b8', marginBottom: 4 }}>
            <span>{drawings.length} 个画线文件</span>
            <span>最后更新</span>
          </div>

          {drawings.map(d => (
            <div key={d.id} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px',
              borderRadius: 6, marginBottom: 3,
              background: selectedDrawings.has(d.id) ? '#eff6ff' : 'white',
              border: `1px solid ${selectedDrawings.has(d.id) ? '#3b82f6' : '#e5e7eb'}`,
            }}>
              {/* Checkbox */}
              <input
                type="checkbox"
                checked={selectedDrawings.has(d.id)}
                onChange={() => toggleSelect(d.id)}
                style={{ cursor: 'pointer' }}
              />

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {d.name}
                </div>
                <div style={{ fontSize: 9, color: '#94a3b8' }}>
                  {d.symbol} · {d.type} · {d.lines}条线 · {d.size}
                </div>
              </div>

              {/* Status icons */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {d.isShared && <span title="已分享" style={{ fontSize: 12 }}>🔗</span>}
                {d.syncedDevices > 1 && (
                  <span title={`${d.syncedDevices}设备`} style={{ fontSize: 10, color: '#64748b' }}>
                    🖥×{d.syncedDevices}
                  </span>
                )}
                <span style={{ fontSize: 9, color: '#94a3b8' }}>{d.updatedAt}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Share Panel */}
      {showShare && isLoggedIn && (
        <div style={{
          marginTop: 8, padding: 10, borderRadius: 8,
          background: '#f8fafc', border: '1px solid #e5e7eb',
        }}>
          <div style={{ fontWeight: 600, fontSize: 11, marginBottom: 6 }}>📤 分享画线</div>
          <div style={{ fontSize: 10, color: '#64748b', marginBottom: 6 }}>
            已选 {selectedDrawings.size} 个文件
          </div>

          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            <input
              type="text"
              placeholder="用户名或邮箱"
              value={shareTarget}
              onChange={e => setShareTarget(e.target.value)}
              style={{ flex: 1, padding: '6px 8px', borderRadius: 4, border: '1px solid #d1d5db', fontSize: 11 }}
            />
          </div>

          <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
            <label style={{ fontSize: 10, color: '#64748b', display: 'flex', alignItems: 'center', gap: 3 }}>
              <input type="radio" name="permission" defaultChecked /> 只读
            </label>
            <label style={{ fontSize: 10, color: '#64748b', display: 'flex', alignItems: 'center', gap: 3 }}>
              <input type="radio" name="permission" /> 可编辑
            </label>
            <label style={{ fontSize: 10, color: '#64748b', display: 'flex', alignItems: 'center', gap: 3 }}>
              <input type="radio" name="permission" /> 复制
            </label>
          </div>

          <button style={{
            width: '100%', padding: '6px 0', borderRadius: 6, border: 'none',
            background: '#3b82f6', color: 'white', fontWeight: 600, fontSize: 11, cursor: 'pointer',
          }}>
            📤 发送分享链接
          </button>
        </div>
      )}

      {/* Sync Settings */}
      {isLoggedIn && (
        <div style={{ marginTop: 10, padding: 8, background: '#f8fafc', borderRadius: 6, fontSize: 10 }}>
          <div style={{ fontWeight: 600, marginBottom: 6, color: '#64748b' }}>⚙️ 同步设置</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', color: '#64748b' }}>
              <input type="checkbox" defaultChecked /> 自动同步（每30分钟）
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', color: '#64748b' }}>
              <input type="checkbox" defaultChecked /> 仅WiFi下同步
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', color: '#64748b' }}>
              <input type="checkbox" /> 同步到社区（公开画线）
            </label>
          </div>
          <div style={{ marginTop: 8, fontSize: 9, color: '#94a3b8', display: 'flex', justifyContent: 'space-between' }}>
            <span>已用空间: 2.3 MB / 100 MB</span>
            <span>版本: {drawings.length} 备份</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default DrawingCloudSyncPanel;
