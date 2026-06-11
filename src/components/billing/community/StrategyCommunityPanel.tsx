/**
 * StrategyCommunityPanel — ML-72-01 [P0]
 * R72: v1.8.0-alpha — Strategy detail community: comments, likes, follow, share
 *
 * Features:
 * - Nested comments (multi-level replies) with expand/collapse
 * - Like/unlike comments with count
 * - Follow/unfollow creator button
 * - Signal share (Twitter/Telegram/copy link)
 * - Comment input with submit
 */

import { useState, useCallback } from 'react';
import { useTranslation } from "react-i18next";
import i18n from '../../../i18n';

// ── Types ───────────────────────────────────────────────────────────────

export interface Comment {
  id: string;
  author: string;
  avatar: string;
  content: string;
  time: string;
  likes: number;
  liked: boolean;
  replies: Comment[];
  level: number;
}

export interface StrategyCommunityPanelProps {
  strategyId?: string;
  strategyName?: string;
  creatorName?: string;
  creatorAvatar?: string;
  isFollowing?: boolean;
  followerCount?: number;
  comments?: Comment[];
  onFollow?: () => void;
  onComment?: (content: string, parentId?: string) => void;
  onLike?: (commentId: string) => void;
  onShare?: (platform: 'twitter' | 'telegram' | 'copy') => void;
  className?: string;
}

// ── Mock ────────────────────────────────────────────────────────────────

const mockComments: Comment[] = [
  { id: 'c1', author: 'TraderJoe', avatar: '🐂', content: i18n.t('StrategyCommunityPanel.k1'), time: i18n.t('StrategyCommunityPanel.k2'), likes: 24, liked: true, replies: [
    { id: 'c1r1', author: 'QuantEdge Pro', avatar: '🦊', content: i18n.t('StrategyCommunityPanel.k3'), time: i18n.t('StrategyCommunityPanel.k4'), likes: 8, liked: false, replies: [], level: 1 },
  ], level: 0 },
  { id: 'c2', author: 'CryptoWhale', avatar: '🐋', content: i18n.t('StrategyCommunityPanel.k5'), time: i18n.t('StrategyCommunityPanel.k6'), likes: 15, liked: false, replies: [], level: 0 },
  { id: 'c3', author: 'NewTrader88', avatar: '🐣', content: i18n.t('StrategyCommunityPanel.k7'), time: i18n.t('StrategyCommunityPanel.k8'), likes: 3, liked: false, replies: [
    { id: 'c3r1', author: 'QuantEdge Pro', avatar: '🦊', content: i18n.t('StrategyCommunityPanel.k9'), time: i18n.t('StrategyCommunityPanel.k10'), likes: 5, liked: true, replies: [], level: 1 },
    { id: 'c3r2', author: 'TraderJoe', avatar: '🐂', content: i18n.t('StrategyCommunityPanel.k11'), time: i18n.t('StrategyCommunityPanel.k12'), likes: 7, liked: false, replies: [], level: 1 },
  ], level: 0 },
];

// ── Comment Thread ──────────────────────────────────────────────────────

function CommentThread({ comment, onReply, onLike, depth = 0 }: {
  comment: Comment; onReply: (id: string) => void; onLike: (id: string) => void; depth: number;
}) {
  const maxDepth = 3;
  return (
    <div style={{ marginLeft: depth > 0 ? 20 : 0, borderLeft: depth > 0 ? '1px solid rgba(255,255,255,0.06)' : 'none', paddingLeft: depth > 0 ? 12 : 0 }}>
      <div style={{ padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <span style={{ fontSize: 20 }}>{comment.avatar}</span>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#cbd5e1' }}>{comment.author}</span>
              <span style={{ fontSize: 10, color: '#64748b' }}>{comment.time}</span>
            </div>
            <p style={{ fontSize: 13, color: '#94a3b8', margin: '4px 0', lineHeight: 1.6 }}>{comment.content}</p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => onLike(comment.id)}
                style={{ fontSize: 11, background: 'none', border: 'none', cursor: 'pointer', color: comment.liked ? '#ef4444' : '#64748b' }}>
                {comment.liked ? '❤️' : '🤍'} {comment.likes}
              </button>
              {depth < maxDepth && (
                <button onClick={() => onReply(comment.id)}
                  style={{ fontSize: 11, background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                  💬 回复
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
      {comment.replies.map(r => (
        <CommentThread key={r.id} comment={r} onReply={onReply} onLike={onLike} depth={depth + 1} />
      ))}
    </div>
  );
}

// ── Share Menu ──────────────────────────────────────────────────────────

function ShareMenu({ onShare }: { onShare: (p: 'twitter' | 'telegram' | 'copy') => void }) {
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <button onClick={() => onShare('twitter')}
        style={{ padding: '6px 12px', fontSize: 11, fontWeight: 600, background: '#1DA1F2', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
        🐦 Twitter
      </button>
      <button onClick={() => onShare('telegram')}
        style={{ padding: '6px 12px', fontSize: 11, fontWeight: 600, background: '#0088cc', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
        📨 Telegram
      </button>
      <button onClick={() => onShare('copy')}
        style={{ padding: '6px 12px', fontSize: 11, fontWeight: 600, background: 'rgba(255,255,255,0.06)', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, cursor: 'pointer' }}>
        📋 复制链接
      </button>
    </div>
  );
}

// ── Main ────────────────────────────────────────────────────────────────

export default function StrategyCommunityPanel({
  strategyId: _sid,
  strategyName: _sname,
  creatorName = 'QuantEdge Pro',
  creatorAvatar = '🦊',
  isFollowing: propFollow = false,
  followerCount = 2847,
  comments: propComments,
  onFollow,
  onComment,
  onLike,
  onShare,
  className = '',
}: StrategyCommunityPanelProps) {
  const { t } = useTranslation();

  const [isFollowing, setIsFollowing] = useState(propFollow);
  const [comments, setComments] = useState(propComments ?? mockComments);
  const [newComment, setNewComment] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [shared, setShared] = useState('');

  const handleFollow = useCallback(() => {
    setIsFollowing(!isFollowing);
    onFollow?.();
  }, [isFollowing, onFollow]);

  const handleComment = useCallback(() => {
    if (!newComment.trim()) return;
    const c: Comment = {
      id: `c-new-${Date.now()}`,
      author: 'You', avatar: '👤', content: newComment,
      time: i18n.t('StrategyCommunityPanel.k13'), likes: 0, liked: false,
      replies: [], level: replyTo ? 1 : 0,
    };
    if (replyTo) {
      setComments(prev => prev.map(cm => cm.id === replyTo ? { ...cm, replies: [...cm.replies, c] } : cm));
    } else {
      setComments(prev => [c, ...prev]);
    }
    onComment?.(newComment, replyTo ?? undefined);
    setNewComment('');
    setReplyTo(null);
  }, [newComment, replyTo, onComment]);

  const handleLike = useCallback((id: string) => {
    setComments(prev => {
      const update = (list: Comment[]): Comment[] => list.map(c => ({
        ...c, liked: c.id === id ? !c.liked : c.liked, likes: c.id === id ? (c.liked ? c.likes - 1 : c.likes + 1) : c.likes,
        replies: update(c.replies),
      }));
      return update(prev);
    });
    onLike?.(id);
  }, [onLike]);

  const handleShare = useCallback((p: 'twitter' | 'telegram' | 'copy') => {
    setShared(p === 'copy' ? i18n.t('StrategyCommunityPanel.k14') : `已分享到${p === 'twitter' ? 'Twitter' : 'Telegram'}`);
    setTimeout(() => setShared(''), 2000);
    onShare?.(p);
  }, [onShare]);

  return (
    <div className={`h-full flex flex-col bg-[#0D0D14] text-white ${className}`}>
      {/* Header with creator + follow */}
      <div className="p-5 border-b border-white/5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <span style={{ fontSize: 28 }}>{creatorAvatar}</span>
            <div>
              <div className="text-sm font-semibold text-gray-200">{creatorName}</div>
              <div className="text-[10px] text-gray-600">{followerCount.toLocaleString()} 粉丝</div>
            </div>
          </div>
          <button onClick={handleFollow}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors ${isFollowing ? 'bg-white/[0.06] text-gray-400 border border-white/10' : 'bg-[#3b82f6] text-white'}`}>
            {isFollowing ? i18n.t('StrategyCommunityPanel.k15') : i18n.t('StrategyCommunityPanel.k16')}
          </button>
        </div>
        <ShareMenu onShare={handleShare} />
        {shared && <div className="mt-2 text-[11px] text-green-400">{shared}</div>}
      </div>

      {/* Comments */}
      <div className="flex-1 overflow-y-auto p-5">
        <h3 className="text-gray-400 font-semibold text-xs mb-3">💬 评论 ({comments.length})</h3>
        <div className="space-y-0">
          {comments.map(c => (
            <CommentThread key={c.id} comment={c} onReply={setReplyTo} onLike={handleLike} depth={0} />
          ))}
        </div>
      </div>

      {/* Comment input */}
      <div className="p-4 border-t border-white/5">
        {replyTo && (
          <div className="flex items-center gap-2 mb-2 text-[10px] text-gray-500">
            <span>回复中...</span>
            <button onClick={() => setReplyTo(null)} className="text-gray-600 hover:text-gray-400">{t("components.cancel")}</button>
          </div>
        )}
        <div className="flex gap-2">
          <input value={newComment} onChange={e => setNewComment(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleComment()}
            placeholder="写下你的评论..."
            className="flex-1 px-3 py-2 bg-white/[0.04] border border-white/10 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#3b82f6]/50" />
          <button onClick={handleComment}
            className="px-4 py-2 rounded-lg bg-[#3b82f6] text-white text-sm font-semibold">
            发送
          </button>
        </div>
      </div>
    </div>
  );
}
