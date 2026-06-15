// ── R192 ML P8-02: FactorFriendCircle — 社交证明+因子评分 ──────────
// Community ratings, expert endorsements, user reviews, factor badges
// Social proof: stars, review count, top reviewer avatars
// 🔒 premium — 2U/unlock for expert commentary
// Accepts R190 FactorFriendCircle design spec

import React, { useState } from 'react';
import { Tooltip, Rate, Tag, Progress } from 'antd';

// ── Types ───────────────────────────────────────────────────────────
interface UserReview {
  userId: string;
  username: string;
  avatar: string;
  rating: number; // 1-5
  comment: string;
  date: string;
  expertVerified?: boolean;
}

interface ExpertEndorsement {
  expertId: string;
  name: string;
  title: string;
  avatar: string;
  comment: string;
  institution: string;
}

interface FactorScore {
  dimension: string;
  score: number; // 0-100
  label: string;
}

interface FactorFriendCircleProps {
  factorId: string;
  factorName: string;
  demoReviews?: UserReview[];
  demoEndorsements?: ExpertEndorsement[];
  demoScores?: FactorScore[];
}

// ── Demo Data Generators ────────────────────────────────────────────
const demoAvatars = [
  '🎓', '💼', '📊', '🐋', '🦅', '🦊', '🐂', '🐻', '🦉', '🏦',
];

function generateDemoReviews(factorId: string): UserReview[] {
  const seed = factorId.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const random = (i: number) => {
    const x = Math.sin(seed * (i + 1) * 2.17) * 10000;
    return x - Math.floor(x);
  };

  const reviews: UserReview[] = [];
  for (let i = 0; i < 8; i++) {
    const rating = Math.round(3 + random(i) * 2);
    reviews.push({
      userId: `user-${seed}-${i}`,
      username: [
        'AlphaHunter', 'QuantWhale', 'ValueSeeker', 'MomentumRider',
        'RiskManager', 'FactorFan', 'DataMiner', 'TrendSpy',
      ][i],
      avatar: demoAvatars[i % demoAvatars.length],
      rating,
      comment: [
        'Consistent alpha in HK market. Best value factor I\'ve used.',
        'IC dropped recently but still decent. Watch crowding.',
        'Solid factor but needs sector neutralization for US stocks.',
        'Good for screening, not great for timing. Pair with momentum.',
        'Academic pedigree checked out. Fama-French consistent.',
        'Works best in low-vol regimes. Underperforms in crises.',
        'Simple but effective. Doesn\'t overfit like the AI ones.',
        'Backtest looks great but live performance is ~30% lower.',
      ][i],
      date: new Date(Date.now() - random(i) * 90 * 86400000).toISOString().split('T')[0],
      expertVerified: random(i) > 0.7,
    });
  }
  return reviews;
}

function generateDemoEndorsements(factorId: string): ExpertEndorsement[] {
  return [
    {
      expertId: 'exp-001',
      name: 'Dr. Zhang Wei',
      title: 'Head of Quant Research',
      institution: 'E Fund',
      avatar: '🎓',
      comment: 'This factor shows strong cross-sectional predictive power in A/H share markets. The sector-neutral version improves IR by ~15%. Recommended as a core satellite holding.',
    },
    {
      expertId: 'exp-002',
      name: 'Prof. Chen Li',
      title: 'Finance Chair',
      institution: 'HKU',
      avatar: '📊',
      comment: 'Empirically consistent with the low-risk anomaly literature. Rolling IC is stable at 2.8% over 5 years. Caveat: crowding risk above 80th percentile.',
    },
    {
      expertId: 'exp-003',
      name: 'Marcus Lee CFA',
      title: 'PM, Multi-Factor Fund',
      institution: 'BlackRock',
      avatar: '🐋',
      comment: 'We use a variant in our APAC multi-factor strategy. The factor works best combined with quality filters (ROIC > 15%, debt/equity < 2x).',
    },
  ];
}

function generateDemoScores(factorId: string): FactorScore[] {
  const seed = factorId.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const rand = (i: number) => {
    const x = Math.sin(seed * (i + 5) * 1.73) * 10000;
    return x - Math.floor(x);
  };

  return [
    { dimension: 'IC Stability', score: Math.round(60 + rand(0) * 35), label: 'Consistency of predictive power' },
    { dimension: 'Capacity', score: Math.round(50 + rand(1) * 40), label: 'How much AUM the factor can support' },
    { dimension: 'Simplicity', score: Math.round(40 + rand(2) * 50), label: 'Ease of understanding & implementation' },
    { dimension: 'Crisis Resilience', score: Math.round(30 + rand(3) * 50), label: 'Performance in drawdowns' },
    { dimension: 'Crowding Level', score: Math.round(20 + rand(4) * 60), label: 'Lower = less crowded (better)' },
    { dimension: 'Academic Support', score: Math.round(50 + rand(5) * 40), label: 'Published research backing' },
  ];
}

// ── Component ────────────────────────────────────────────────────────
const FactorFriendCircle: React.FC<FactorFriendCircleProps> = ({
  factorId,
  factorName,
  demoReviews,
  demoEndorsements,
  demoScores,
}) => {
  const [showExpertPanel, setShowExpertPanel] = useState(false);
  const [showAllReviews, setShowAllReviews] = useState(false);

  const reviews = demoReviews || generateDemoReviews(factorId);
  const endorsements = demoEndorsements || generateDemoEndorsements(factorId);
  const scores = demoScores || generateDemoScores(factorId);

  const avgRating =
    reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
  const verifiedCount = reviews.filter((r) => r.expertVerified).length;
  const visibleReviews = showAllReviews ? reviews : reviews.slice(0, 3);

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <span style={styles.icon}>🤝</span>
        <span style={styles.title}>Factor Friend Circle</span>
        <span style={styles.subtitle}>{factorName} — Community Trust</span>
      </div>

      {/* Rating Summary */}
      <div style={styles.ratingSummary}>
        <div style={styles.ratingScore}>
          <span style={styles.ratingNumber}>{avgRating.toFixed(1)}</span>
          <Rate disabled allowHalf value={avgRating} style={{ fontSize: 14 }} />
          <span style={styles.reviewCount}>({reviews.length} reviews)</span>
        </div>
        <div style={styles.verifiedRow}>
          {verifiedCount > 0 && (
            <Tag color="gold" style={styles.verifiedTag}>
              ✅ {verifiedCount} expert verified
            </Tag>
          )}
        </div>
      </div>

      {/* Factor Score Radar */}
      <div style={styles.scoreSection}>
        <div style={styles.scoreTitle}>Community Scores</div>
        <div style={styles.scoreGrid}>
          {scores.map((s) => (
            <div key={s.dimension} style={styles.scoreItem}>
              <div style={styles.scoreLabel}>
                <span>{s.dimension}</span>
                <span style={styles.scoreValue}>{s.score}</span>
              </div>
              <Tooltip title={s.label}>
                <div style={styles.scoreBarBg}>
                  <div
                    style={{
                      ...styles.scoreBarFill,
                      width: `${s.score}%`,
                      background:
                        s.score >= 80
                          ? 'linear-gradient(90deg, #66bd63, #1a9850)'
                          : s.score >= 60
                            ? 'linear-gradient(90deg, #d4a853, #66bd63)'
                            : s.score >= 40
                              ? 'linear-gradient(90deg, #fdae61, #d4a853)'
                              : 'linear-gradient(90deg, #d73027, #fdae61)',
                    }}
                  />
                </div>
              </Tooltip>
            </div>
          ))}
        </div>
      </div>

      {/* User Reviews */}
      <div style={styles.reviewsSection}>
        <div style={styles.reviewsHeader}>
          <span style={styles.scoreTitle}>Recent Reviews</span>
          {reviews.length > 3 && (
            <button
              style={styles.showMoreBtn}
              onClick={() => setShowAllReviews(!showAllReviews)}
            >
              {showAllReviews ? 'Show less ▲' : `Show all ${reviews.length} ▼`}
            </button>
          )}
        </div>
        {visibleReviews.map((review) => (
          <div key={review.userId} style={styles.reviewCard}>
            <div style={styles.reviewMeta}>
              <span style={styles.reviewAvatar}>{review.avatar}</span>
              <div style={styles.reviewUser}>
                <span style={styles.reviewUsername}>
                  {review.username}
                  {review.expertVerified && (
                    <Tag color="gold" style={{ fontSize: 10, marginLeft: 4, lineHeight: '16px', padding: '0 4px' }}>
                      PRO
                    </Tag>
                  )}
                </span>
                <Rate disabled value={review.rating} style={{ fontSize: 12 }} />
              </div>
              <span style={styles.reviewDate}>{review.date}</span>
            </div>
            <p style={styles.reviewComment}>{review.comment}</p>
          </div>
        ))}
      </div>

      {/* Expert Endorsements — premium gated */}
      {showExpertPanel ? (
        <div style={styles.expertSection}>
          <div style={styles.scoreTitle}>🔬 Expert Endorsements</div>
          {endorsements.map((exp) => (
            <div key={exp.expertId} style={styles.expertCard}>
              <div style={styles.expertMeta}>
                <span style={styles.expertAvatar}>{exp.avatar}</span>
                <div>
                  <div style={styles.expertName}>{exp.name}</div>
                  <div style={styles.expertTitle}>
                    {exp.title}, {exp.institution}
                  </div>
                </div>
              </div>
              <p style={styles.expertComment}>"{exp.comment}"</p>
            </div>
          ))}
        </div>
      ) : (
        <div style={styles.expertGate}>
          <div style={styles.gateBlur}>
            <p style={styles.gateHint}>
              Premium expert analysis from institutional quants
            </p>
          </div>
          <button
            style={styles.gateBtn}
            onClick={() => setShowExpertPanel(true)}
          >
            🔓 Unlock Expert Panel — 2 USDT
          </button>
        </div>
      )}
    </div>
  );
};

// ── Styles ───────────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  container: {
    background: '#1a1a2e',
    borderRadius: 12,
    padding: 20,
    border: '1px solid #2a2a4a',
    fontFamily: "'Inter', -apple-system, sans-serif",
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
    flexWrap: 'wrap',
  },
  icon: {
    fontSize: 20,
  },
  title: {
    fontSize: 16,
    fontWeight: 700,
    color: '#e0e0e0',
  },
  subtitle: {
    fontSize: 12,
    color: '#888',
    marginLeft: 'auto',
  },
  ratingSummary: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    padding: '10px 14px',
    background: '#0f0f1e',
    borderRadius: 8,
    flexWrap: 'wrap',
    gap: 8,
  },
  ratingScore: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  ratingNumber: {
    fontSize: 28,
    fontWeight: 800,
    color: '#d4a853',
    fontFamily: 'monospace',
  },
  reviewCount: {
    fontSize: 12,
    color: '#888',
  },
  verifiedRow: {
    display: 'flex',
    gap: 6,
  },
  verifiedTag: {
    fontSize: 11,
  },
  scoreSection: {
    marginBottom: 14,
  },
  scoreTitle: {
    fontSize: 13,
    fontWeight: 600,
    color: '#ccc',
    marginBottom: 10,
  },
  scoreGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  scoreItem: {},
  scoreLabel: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 11,
    color: '#aaa',
    marginBottom: 3,
  },
  scoreValue: {
    color: '#d4a853',
    fontWeight: 700,
    fontFamily: 'monospace',
  },
  scoreBarBg: {
    height: 6,
    background: '#2a2a4a',
    borderRadius: 3,
    overflow: 'hidden',
  },
  scoreBarFill: {
    height: '100%',
    borderRadius: 3,
    transition: 'width 0.6s ease',
  },
  reviewsSection: {
    marginBottom: 14,
  },
  reviewsHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  showMoreBtn: {
    background: 'none',
    border: 'none',
    color: '#d4a853',
    fontSize: 12,
    cursor: 'pointer',
    padding: 0,
  },
  reviewCard: {
    padding: '10px 12px',
    background: '#0f0f1e',
    borderRadius: 8,
    marginBottom: 6,
  },
  reviewMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  reviewAvatar: {
    fontSize: 20,
  },
  reviewUser: {
    flex: 1,
  },
  reviewUsername: {
    fontSize: 12,
    fontWeight: 600,
    color: '#ccc',
    display: 'flex',
    alignItems: 'center',
  },
  reviewDate: {
    fontSize: 10,
    color: '#666',
  },
  reviewComment: {
    fontSize: 12,
    color: '#aaa',
    margin: 0,
    lineHeight: 1.5,
    fontStyle: 'italic',
  },
  expertGate: {
    position: 'relative',
    padding: '16px 0',
  },
  gateBlur: {
    filter: 'blur(3px)',
    opacity: 0.4,
    pointerEvents: 'none',
  },
  gateHint: {
    color: '#888',
    fontSize: 13,
    textAlign: 'center',
    margin: 0,
  },
  gateBtn: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    padding: '10px 24px',
    borderRadius: 8,
    border: 'none',
    background: 'linear-gradient(135deg, #d4a853, #b8942e)',
    color: '#1a1a2e',
    fontWeight: 700,
    fontSize: 13,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  expertSection: {
    padding: '12px 0',
  },
  expertCard: {
    padding: '12px',
    background: '#0f0f1e',
    borderRadius: 8,
    marginBottom: 8,
    borderLeft: '3px solid #d4a853',
  },
  expertMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },
  expertAvatar: {
    fontSize: 24,
  },
  expertName: {
    fontSize: 13,
    fontWeight: 700,
    color: '#e0e0e0',
  },
  expertTitle: {
    fontSize: 11,
    color: '#888',
  },
  expertComment: {
    fontSize: 12,
    color: '#bbb',
    margin: 0,
    lineHeight: 1.6,
  },
};

export { FactorFriendCircle };
export { generateDemoReviews, generateDemoEndorsements, generateDemoScores };
export type { FactorFriendCircleProps, UserReview, ExpertEndorsement, FactorScore };
