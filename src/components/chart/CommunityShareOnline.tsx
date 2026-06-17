import { useState } from 'react';

// ── Community Share Online ── ML#7 R271 (3h)
// Full community sharing integration: post, feed, reactions, leaderboard

interface CommunityPost {
  id: string;
  author: { name: string; level: string; avatar: string };
  title: string;
  symbol: string;
  type: 'analysis' | 'strategy' | 'drawing' | 'signal';
  content: string;
  likes: number;
  comments: number;
  shares: number;
  time: string;
  tags: string[];
  isLiked?: boolean;
  isSaved?: boolean;
}

const CommunityShareOnline = () => {
  const [activeTab, setActiveTab] = useState<'feed' | 'trending' | 'following' | 'leaderboard'>('feed');
  const [showComposer, setShowComposer] = useState(false);
  const [newPost, setNewPost] = useState({ title: '', content: '', tags: '', type: 'analysis' as CommunityPost['type'] });

  const posts: CommunityPost[] = [
    {
      id: 'p1', author: { name: 'TraderWhale', level: 'L3', avatar: 'T' },
      title: 'AAPL 突破三角形，目标160', symbol: 'AAPL', type: 'analysis',
      content: '看图AAPL在上升三角形底部获得支撑，MACD金叉确认。目标160，止损146。',
      likes: 234, comments: 45, shares: 18, time: '10分钟前',
      tags: ['AAPL', '三角形', 'MACD'], isLiked: true,
    },
    {
      id: 'p2', author: { name: 'QuantMaster', level: 'L2', avatar: 'Q' },
      title: 'TSLA 布林带挤压即将爆发', symbol: 'TSLA', type: 'signal',
      content: '布林带宽度收缩到近30天最低，Squeeze动量即将触发。方向不预判，突破跟随。',
      likes: 189, comments: 32, shares: 12, time: '1小时前',
      tags: ['TSLA', '布林带', 'Squeeze'],
    },
    {
      id: 'p3', author: { name: 'ChinaBull', level: 'L3', avatar: 'C' },
      title: '贵州茅台 筹码集中度持续上升', symbol: '600519', type: 'analysis',
      content: '茅台筹码集中度从55%上升至65%，主力控盘度明显提高。北向资金连续5日净买入。',
      likes: 456, comments: 89, shares: 34, time: '2小时前',
      tags: ['茅台', '筹码', '北向'], isSaved: true,
    },
  ];

  const leaderboard = [
    { rank: 1, name: 'TraderWhale', accuracy: '78.3%', signals: 156, followers: 2340, level: 'L3' },
    { rank: 2, name: 'ChinaBull', accuracy: '76.1%', signals: 98, followers: 1890, level: 'L3' },
    { rank: 3, name: 'QuantMaster', accuracy: '74.5%', signals: 210, followers: 1650, level: 'L2' },
    { rank: 4, name: 'FlowGuru', accuracy: '72.8%', signals: 67, followers: 980, level: 'L2' },
    { rank: 5, name: 'TechAnalyst', accuracy: '70.2%', signals: 134, followers: 720, level: 'L1' },
  ];

  return (
    <div className="community-share-online" style={{ padding: 12, fontFamily: 'system-ui', fontSize: 12, maxWidth: 520 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontWeight: 700, fontSize: 14 }}>👥 社区</span>
        <button onClick={() => setShowComposer(!showComposer)} style={{
          padding: '4px 14px', borderRadius: 16, border: 'none',
          background: '#3b82f6', color: 'white', fontWeight: 600, fontSize: 11, cursor: 'pointer',
        }}>
          {showComposer ? '✕ 取消' : '✏️ 发帖'}
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 10, borderBottom: '2px solid #e5e7eb' }}>
        {[
          { key: 'feed' as const, label: '📰 最新' },
          { key: 'trending' as const, label: '🔥 热门' },
          { key: 'following' as const, label: '👤 关注' },
          { key: 'leaderboard' as const, label: '🏆 排行' },
        ].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
            padding: '6px 12px', border: 'none', background: 'transparent',
            borderBottom: activeTab === tab.key ? '2px solid #3b82f6' : '2px solid transparent',
            marginBottom: -2, color: activeTab === tab.key ? '#3b82f6' : '#64748b',
            fontWeight: activeTab === tab.key ? 600 : 400, fontSize: 11, cursor: 'pointer',
          }}>{tab.label}</button>
        ))}
      </div>

      {/* Composer */}
      {showComposer && (
        <div style={{ padding: 10, borderRadius: 8, background: '#f8fafc', marginBottom: 10, border: '1px solid #e5e7eb' }}>
          <input type="text" placeholder="标题..." value={newPost.title}
            onChange={e => setNewPost({ ...newPost, title: e.target.value })}
            style={{ width: '100%', padding: '6px 8px', borderRadius: 4, border: '1px solid #d1d5db', fontSize: 11, marginBottom: 6, boxSizing: 'border-box' }} />
          <textarea placeholder="分享你的分析..." value={newPost.content}
            onChange={e => setNewPost({ ...newPost, content: e.target.value })} rows={3}
            style={{ width: '100%', padding: '6px 8px', borderRadius: 4, border: '1px solid #d1d5db', fontSize: 11, marginBottom: 6, resize: 'vertical', boxSizing: 'border-box' }} />
          <div style={{ display: 'flex', gap: 6 }}>
            <input type="text" placeholder="标签 (逗号分隔)" value={newPost.tags}
              onChange={e => setNewPost({ ...newPost, tags: e.target.value })}
              style={{ flex: 1, padding: '4px 8px', borderRadius: 4, border: '1px solid #d1d5db', fontSize: 10 }} />
            <select value={newPost.type}
              onChange={e => setNewPost({ ...newPost, type: e.target.value as CommunityPost['type'] })}
              style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #d1d5db', fontSize: 10 }}>
              <option value="analysis">📊 分析</option>
              <option value="strategy">⚙️ 策略</option>
              <option value="drawing">✏️ 画线</option>
              <option value="signal">🔔 信号</option>
            </select>
            <button style={{ padding: '4px 16px', borderRadius: 4, border: 'none', background: '#22c55e', color: 'white', fontWeight: 600, fontSize: 11, cursor: 'pointer' }}>
              📤 发布
            </button>
          </div>
        </div>
      )}

      {/* Feed */}
      {activeTab !== 'leaderboard' && posts.map(post => (
        <div key={post.id} style={{
          padding: 10, borderRadius: 8, marginBottom: 8,
          border: '1px solid #e5e7eb', background: 'white',
        }}>
          {/* Author */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{
                width: 24, height: 24, borderRadius: '50%', background: '#3b82f6',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'white', fontSize: 11, fontWeight: 600,
              }}>{post.author.avatar}</div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600 }}>
                  {post.author.name}
                  <span style={{
                    fontSize: 8, marginLeft: 4, padding: '0 4px', borderRadius: 4,
                    background: post.author.level === 'L3' ? '#fef3c7' : '#f1f5f9',
                    color: post.author.level === 'L3' ? '#f59e0b' : '#64748b',
                  }}>{post.author.level}</span>
                </div>
                <div style={{ fontSize: 9, color: '#94a3b8' }}>{post.time}</div>
              </div>
            </div>
            <span style={{
              fontSize: 8, padding: '1px 6px', borderRadius: 8,
              background: '#f1f5f9', color: '#64748b',
            }}>
              {post.type === 'analysis' ? '📊 分析' : post.type === 'strategy' ? '⚙️ 策略' :
               post.type === 'drawing' ? '✏️ 画线' : '🔔 信号'}
            </span>
          </div>

          {/* Content */}
          <div style={{ fontWeight: 600, fontSize: 11, marginBottom: 4 }}>
            {post.symbol && <span style={{ color: '#3b82f6', marginRight: 4 }}>{post.symbol}</span>}
            {post.title}
          </div>
          <div style={{ fontSize: 10, color: '#64748b', lineHeight: 1.5, marginBottom: 6 }}>
            {post.content}
          </div>

          {/* Tags */}
          <div style={{ display: 'flex', gap: 3, marginBottom: 6 }}>
            {post.tags.map((tag, i) => (
              <span key={i} style={{ fontSize: 8, padding: '0 5px', borderRadius: 8, background: '#eff6ff', color: '#3b82f6' }}>{tag}</span>
            ))}
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 14, fontSize: 10, color: '#94a3b8' }}>
            <span style={{ cursor: 'pointer', color: post.isLiked ? '#ef4444' : '#94a3b8' }}>
              {post.isLiked ? '❤️' : '🤍'} {post.likes}
            </span>
            <span style={{ cursor: 'pointer' }}>💬 {post.comments}</span>
            <span style={{ cursor: 'pointer' }}>🔄 {post.shares}</span>
            <span style={{ cursor: 'pointer', color: post.isSaved ? '#f59e0b' : '#94a3b8', marginLeft: 'auto' }}>
              {post.isSaved ? '📌 已收藏' : '📌 收藏'}
            </span>
          </div>
        </div>
      ))}

      {/* Leaderboard */}
      {activeTab === 'leaderboard' && (
        <div>
          {leaderboard.map((u, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
              borderRadius: 6, marginBottom: 4,
              background: i < 3 ? '#fefce8' : 'white', border: '1px solid #e5e7eb',
            }}>
              <span style={{ fontSize: 16, fontWeight: 700, minWidth: 24, color: i < 3 ? '#f59e0b' : '#94a3b8' }}>
                {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : u.rank}
              </span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 11 }}>
                  {u.name} <span style={{ fontSize: 8, background: '#f1f5f9', padding: '0 4px', borderRadius: 4, color: '#64748b' }}>{u.level}</span>
                </div>
                <div style={{ fontSize: 9, color: '#94a3b8' }}>
                  准确率 {u.accuracy} · {u.signals}个信号 · {u.followers}粉丝
                </div>
              </div>
              <button style={{
                padding: '3px 10px', borderRadius: 12, border: '1px solid #3b82f6',
                background: 'white', color: '#3b82f6', fontSize: 9, cursor: 'pointer',
              }}>关注</button>
            </div>
          ))}
        </div>
      )}

      {/* Stats */}
      <div style={{
        marginTop: 10, padding: 8, borderRadius: 6, background: '#f8fafc',
        display: 'flex', justifyContent: 'space-around', textAlign: 'center', fontSize: 9,
      }}>
        <div><div style={{ fontWeight: 700, fontSize: 14, color: '#3b82f6' }}>{posts.length}</div><div style={{ color: '#94a3b8' }}>帖子</div></div>
        <div><div style={{ fontWeight: 700, fontSize: 14, color: '#ef4444' }}>{posts.reduce((s, p) => s + p.likes, 0)}</div><div style={{ color: '#94a3b8' }}>赞</div></div>
        <div><div style={{ fontWeight: 700, fontSize: 14 }}>0</div><div style={{ color: '#94a3b8' }}>粉丝</div></div>
        <div><div style={{ fontWeight: 700, fontSize: 14, color: '#f59e0b' }}>L1</div><div style={{ color: '#94a3b8' }}>等级</div></div>
      </div>
    </div>
  );
};

export default CommunityShareOnline;
