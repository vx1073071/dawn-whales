import { useState } from 'react';

// ── Community Share UI ── ML#7 R267 (2h)
// Share analysis, drawings, and strategies to the community

interface ShareItem {
  id: string;
  type: 'analysis' | 'drawing' | 'strategy' | 'screenshot';
  title: string;
  symbol: string;
  preview: string;
  likes: number;
  comments: number;
  sharedAt: string;
  author: string;
  tags: string[];
}

interface CommunitySharePanelProps {
  items: ShareItem[];
  onShare: (item: ShareItem) => void;
}

const CommunitySharePanel = ({ items, onShare }: CommunitySharePanelProps) => {
  const [newPost, setNewPost] = useState({ title: '', content: '', tags: '', visibility: 'public' as const });
  const [showComposer, setShowComposer] = useState(false);

  const shareTypes = [
    { key: 'analysis' as const, icon: '📊', label: '分析报告' },
    { key: 'drawing' as const, icon: '✏️', label: '画线' },
    { key: 'strategy' as const, icon: '⚙️', label: '策略' },
    { key: 'screenshot' as const, icon: '📸', label: '截图' },
  ];

  return (
    <div className="community-share" style={{ padding: 12, fontFamily: 'system-ui', fontSize: 12, maxWidth: 460 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontWeight: 700, fontSize: 14 }}>👥 社区分享</span>
        <button onClick={() => setShowComposer(!showComposer)} style={{
          padding: '4px 12px', borderRadius: 16, border: 'none',
          background: '#3b82f6', color: 'white', fontWeight: 600, fontSize: 11, cursor: 'pointer',
        }}>
          {showComposer ? '✕ 取消' : '✏️ 发布'}
        </button>
      </div>

      {/* Composer */}
      {showComposer && (
        <div style={{
          padding: 12, borderRadius: 8, marginBottom: 10,
          background: '#f8fafc', border: '1px solid #e5e7eb',
        }}>
          <input
            type="text"
            placeholder="标题（如：AAPL头肩顶形态分析）"
            value={newPost.title}
            onChange={e => setNewPost({ ...newPost, title: e.target.value })}
            style={{
              width: '100%', padding: '8px', borderRadius: 6, border: '1px solid #d1d5db',
              fontSize: 12, marginBottom: 8, boxSizing: 'border-box',
            }}
          />
          <textarea
            placeholder="分享你的分析思路...（支持Markdown）"
            value={newPost.content}
            onChange={e => setNewPost({ ...newPost, content: e.target.value })}
            rows={4}
            style={{
              width: '100%', padding: '8px', borderRadius: 6, border: '1px solid #d1d5db',
              fontSize: 11, marginBottom: 8, resize: 'vertical', boxSizing: 'border-box',
            }}
          />
          <div style={{ display: 'flex', gap: 6, marginBottom: 8, alignItems: 'center' }}>
            <input
              type="text"
              placeholder="标签（逗号分隔）"
              value={newPost.tags}
              onChange={e => setNewPost({ ...newPost, tags: e.target.value })}
              style={{
                flex: 1, padding: '6px 8px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 10,
              }}
            />
            <select
              value={newPost.visibility}
              onChange={e => setNewPost({ ...newPost, visibility: e.target.value as typeof newPost.visibility })}
              style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 10 }}
            >
              <option value="public">🌍 公开</option>
              <option value="followers">👥 粉丝可见</option>
              <option value="private">🔒 仅自己</option>
            </select>
          </div>
          <button style={{
            width: '100%', padding: '8px 0', borderRadius: 6, border: 'none',
            background: '#3b82f6', color: 'white', fontWeight: 600, fontSize: 12, cursor: 'pointer',
          }}>
            📤 发布到社区
          </button>
        </div>
      )}

      {/* Quick Share Types */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 10, flexWrap: 'wrap' }}>
        {shareTypes.map(st => (
          <button key={st.key} onClick={() => { setShowComposer(true); }} style={{
            padding: '4px 10px', borderRadius: 16, border: '1px solid #e5e7eb',
            background: 'white', fontSize: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
          }}>
            {st.icon} {st.label}
          </button>
        ))}
      </div>

      {/* Shared Items Feed */}
      {items.length > 0 ? (
        items.map(item => (
          <div key={item.id} style={{
            padding: 10, borderRadius: 8, marginBottom: 8,
            border: '1px solid #e5e7eb', background: 'white',
          }}>
            {/* Author row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{
                  width: 24, height: 24, borderRadius: '50%', background: '#3b82f6',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'white', fontSize: 12, fontWeight: 600,
                }}>
                  {item.author[0]}
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600 }}>{item.author}</div>
                  <div style={{ fontSize: 9, color: '#94a3b8' }}>{item.sharedAt}</div>
                </div>
              </div>
              <span style={{
                fontSize: 9, padding: '1px 6px', borderRadius: 10,
                background: '#f1f5f9', color: '#64748b',
              }}>
                {shareTypes.find(s => s.key === item.type)?.icon} {shareTypes.find(s => s.key === item.type)?.label}
              </span>
            </div>

            {/* Title */}
            <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 4 }}>
              {item.symbol && <span style={{ color: '#3b82f6', marginRight: 6 }}>{item.symbol}</span>}
              {item.title}
            </div>

            {/* Preview */}
            <div style={{ fontSize: 10, color: '#64748b', lineHeight: 1.5, marginBottom: 6 }}>
              {item.preview}
            </div>

            {/* Tags */}
            {item.tags.length > 0 && (
              <div style={{ display: 'flex', gap: 3, marginBottom: 6, flexWrap: 'wrap' }}>
                {item.tags.map((tag, i) => (
                  <span key={i} style={{
                    padding: '1px 6px', borderRadius: 10, fontSize: 9,
                    background: '#eff6ff', color: '#3b82f6',
                  }}>{tag}</span>
                ))}
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: 12, fontSize: 10, color: '#94a3b8' }}>
              <button onClick={() => onShare(item)} style={{
                border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 10, color: '#64748b',
              }}>
                ❤️ {item.likes}
              </button>
              <button style={{
                border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 10, color: '#64748b',
              }}>
                💬 {item.comments}
              </button>
              <button style={{
                border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 10, color: '#64748b',
              }}>
                🔗 分享
              </button>
              <button style={{
                border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 10, color: '#64748b',
              }}>
                📌 收藏
              </button>
            </div>
          </div>
        ))
      ) : (
        <div style={{ padding: 30, textAlign: 'center' }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>👥</div>
          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>还没有分享内容</div>
          <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 10 }}>分享你的分析给社区，建立你的专业声誉</div>
          <button onClick={() => setShowComposer(true)} style={{
            padding: '6px 16px', borderRadius: 6, border: '1px solid #3b82f6',
            background: 'white', color: '#3b82f6', fontWeight: 600, fontSize: 11, cursor: 'pointer',
          }}>
            ✏️ 发布第一篇分析
          </button>
        </div>
      )}

      {/* Community Stats */}
      <div style={{
        marginTop: 10, padding: 8, borderRadius: 6, background: '#f8fafc',
        display: 'flex', justifyContent: 'space-around', textAlign: 'center', fontSize: 10,
      }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#3b82f6' }}>{items.length}</div>
          <div style={{ color: '#94a3b8' }}>分享</div>
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#16a34a' }}>
            {items.reduce((s, i) => s + i.likes, 0)}
          </div>
          <div style={{ color: '#94a3b8' }}>获赞</div>
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>0</div>
          <div style={{ color: '#94a3b8' }}>粉丝</div>
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>L1</div>
          <div style={{ color: '#94a3b8' }}>等级</div>
        </div>
      </div>
    </div>
  );
};

export default CommunitySharePanel;
