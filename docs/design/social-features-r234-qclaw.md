# R234-QClaw#2: Social Features Design
## QUANT MOO v2.6.0 QUANTUM

---

## 1. OVERVIEW

### 1.1 Purpose
Transform QUANT MOO from a tool-based marketplace into a social trading community. Three core social features allow creators and followers to interact, building trust and retention.

### 1.2 Features
| Feature | Priority | Target |
|---------|----------|--------|
| Strategy Comments | P0 | Every strategy detail page |
| Creator Homepage | P0 | Public profile for each creator |
| Follow Feed (CopyTrade Dynamics) | P1 | Activity timeline of followed creators |

### 1.3 Design Goals
- **Trust First**: Comments build social proof for strategies
- **Creator Branding**: Homepage turns creators into influencers
- **Engagement Loop**: Follow Feed keeps users returning daily
- **Revenue Driver**: Social engagement leads to more sales

---

## 2. FEATURE 1: STRATEGY COMMENTS

### 2.1 Architecture
```
CommentSection
├── CommentHeader (count + sort)
├── CommentList
│   ├── CommentItem (avatar + name + time + body + reactions)
│   │   └── ReplyThread (nested replies, max depth 2)
│   └── LoadMore
├── CommentInput (text + submit)
└── CommentModeration (creator view: reply/delete/report)
```

### 2.2 Data Model
```typescript
interface StrategyComment {
  id: string;
  strategyId: string;
  authorId: string;
  authorName: string;
  authorAvatar: string;
  body: string;           // max 500 chars
  rating?: number;        // 1-5 stars, optional
  parentId?: string;      // null = top-level, string = reply
  reactions: { like: number; helpful: number };
  isCreatorReply: boolean;
  isEdited: boolean;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;     // soft delete
}
```

### 2.3 States & Edge Cases
| State | Behavior |
|-------|----------|
| **Empty** | "No comments yet. Be the first to share your experience!" (+ rating prompt) |
| **Loading** | Skeleton: 3 comment placeholders |
| **Error** | "Failed to load comments. Tap to retry." |
| **Own comment** | Blue accent border, "edit" and "delete" actions |
| **Creator reply** | Gold badge "Creator" next to name |
| **Deleted comment** | "[This comment has been deleted]" in gray italic |
| **Rate limited** | "You're commenting too fast. Wait {x}s." |
| **Unverified purchase** | "Only buyers can comment." (hide input, show lock icon) |

### 2.4 Moderation Rules
1. **Auto-filter**: Profanity, spam links, all-caps (>50%)
2. **Creator powers**: Reply to any comment, delete own replies, report spam
3. **User powers**: Edit own comments (5 min window), delete own comments, report
4. **Admin review**: Reported comments go to admin queue
5. **Verified Purchase badge**: Only shown if user bought the strategy

### 2.5 UI Layout
```
┌─────────────────────────────────────────┐
│ 💬 Comments (24)  [Newest ▼] [Rating ▼] │
├─────────────────────────────────────────┤
│ 👤 Alex_Trader · 2 days ago    ⭐⭐⭐⭐  │
│ Great strategy! Made 15% in 2 weeks.    │
│ 👍 12  💡 3    [Reply] [Report]         │
│                                          │
│   └─ 👤 Creator (You) · 1 day ago       │
│      Thanks Alex! Glad it's working.    │
│      👍 5                               │
├─────────────────────────────────────────┤
│ 👤 CryptoDegen · 3 days ago    ⭐       │
│ Not working for me, down 5%...          │
│ 👍 2  💡 1    [Reply] [Report]         │
│                                          │
│   └─ 👤 Creator (You) · 3 days ago      │
│      Sorry to hear that. Check           │
│      the stop loss settings. DM me!     │
│      👍 8                               │
├─────────────────────────────────────────┤
│ ─── Load more comments (22 remaining) ── │
├─────────────────────────────────────────┤
│ ⭐ Rate this strategy: ☆☆☆☆☆           │
│ [Write a comment...              ] [Post]│
└─────────────────────────────────────────┘
```

### 2.6 Rating Integration
- Rating is optional but encouraged ("Rate this strategy to help other traders")
- 5-star quick-select, then optional comment
- Average rating shown on strategy card and detail page
- Rating breakdown chart on strategy detail: ★★★★★ 45% | ★★★★ 32% | ★★★ 15% | ★★ 5% | ★ 3%

---

## 3. FEATURE 2: CREATOR HOMEPAGE

### 3.1 Architecture
```
CreatorHomepage
├── HeroBanner (cover photo + avatar + name + level badge)
├── TrustBar (verified badges row)
├── StatsRow (strategies/followers/total sales/rating)
├── BioSection (creator story, editable rich text)
├── FeaturedStrategies (top 3, carousel)
├── AllStrategies (grid, filterable)
├── RecentActivity (timeline of trades/updates)
└── FollowButton (prominent CTA)
```

### 3.2 Data Model
```typescript
interface CreatorProfile {
  userId: string;
  displayName: string;
  avatar: string;
  coverPhoto: string;
  bio: string;            // max 500 chars, rich text
  level: 'L1' | 'L2' | 'L3';
  badges: TrustBadge[];
  stats: {
    strategies: number;
    followers: number;
    totalSales: number;
    avgRating: number;
    joinedDate: number;
  };
  socialLinks: {
    twitter?: string;
    telegram?: string;
    discord?: string;
  };
}
```

### 3.3 States
| State | Behavior |
|-------|----------|
| **Normal** | Full profile with all sections |
| **Own profile** | Edit buttons on all sections, private stats visible |
| **Not following** | "Follow" button primary, "X followers" below |
| **Following** | "Following ✓" button secondary, unfollow on hover |
| **New creator (L1)** | TrustBar shows "New Creator" tag, badge slots grayed out |
| **Empty strategies** | "This creator hasn't published any strategies yet" |

### 3.4 UI Layout
```
┌──────────────────────────────────────────────┐
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │ Cover
│       ┌────┐                                 │
│       │ AV │  CreatorName  🥇 Flagship      │
│       └────┘  @handle                        │
│                                              │
│  [📊 Verified] [🛡️ LowRefund] [⭐ 4.8★]    │ TrustBar
│                                              │
│  12 Strategies · 2.4K Followers              │ Stats
│  3,450 Sales · Joined Mar 2026               │
│                                              │
│  ── About ──                                 │
│  "I've been trading crypto since 2017. My    │ Bio
│   strategies focus on mean reversion in BTC  │
│   and ETH pairs with strict risk management."│
│                                              │
│  ── Featured Strategies ──                   │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐       │
│  │ BTC Mean │ │ ETH Grid│ │ Alt     │       │
│  │ Reversion│ │ Trading │ │ Momentum│       │
│  │ ⭐4.8 1.2K│ │ ⭐4.6 890│ │ ⭐4.3 360│     │
│  └─────────┘ └─────────┘ └─────────┘       │
│  ←                                        → │
│                                              │
│  ── All Strategies (12) ──                  │
│  [Grid of strategy cards, 3-col]            │
│                                              │
│       [ Follow (+2.4K) ]                    │
└──────────────────────────────────────────────┘
```

### 3.5 TrustBar Badges (8 types)
| Badge | Icon | Requirement |
|-------|------|-------------|
| Verified Backtest | 📊 | Backtest results verified by system |
| Low Refund Rate | 🛡️ | Refund rate < 5% |
| High Rating | ⭐ | Average rating ≥ 4.5 |
| Consistent | 📅 | Sales every month for 3+ months |
| Whale | 🐋 | Single strategy revenue ≥ 1000 USDT |
| Fast Responder | ⚡ | Average reply time < 24h |
| Top Seller | 🏆 | Top 10% by revenue in category |
| Editor's Pick | 💎 | Curated by QUANT MOO team |

---

## 4. FEATURE 3: FOLLOW FEED (CopyTrade Dynamics)

### 4.1 Architecture
```
FollowFeed
├── FeedHeader (title + filter)
├── FeedList (infinite scroll)
│   └── FeedItem (one of 6 types)
└── FollowSuggestions (who to follow, carousel)
```

### 4.2 Feed Item Types
```typescript
type FeedItem =
  | { kind: 'new_strategy'; strategy: Strategy; creator: Creator; timestamp: number }
  | { kind: 'strategy_update'; strategy: Strategy; changelog: string; timestamp: number }
  | { kind: 'trade_signal'; strategy: Strategy; signal: Signal; timestamp: number }
  | { kind: 'milestone'; creator: Creator; milestone: string; timestamp: number }
  | { kind: 'level_up'; creator: Creator; from: Level; to: Level; timestamp: number }
  | { kind: 'reply'; creator: Creator; comment: Comment; strategy: Strategy; timestamp: number }
```

### 4.3 Feed Item Layouts

**New Strategy:**
```
👤 CreatorName published a new strategy
┌──────────────────────────────────────┐
│ 📈 BTC Mean Reversion                │
│ Medium Risk · 9.9 USDT               │
│ "Profitable mean reversion on BTC..."│
│ [View Strategy →]                    │
└──────────────────────────────────────┘
· 2 hours ago
```

**Trade Signal:**
```
👤 CreatorName's ETH Grid Trading just triggered
┌──────────────────────────────────────┐
│ 🟢 BUY Signal · ETH/USDT             │
│ Entry: $3,245 · TP: $3,450           │
│ Confidence: 85%                      │
│ [View Signal →]                      │
└──────────────────────────────────────┘
· 15 minutes ago
```

**Milestone:**
```
🎉 Milestone!
👤 CreatorName's BTC Mean Reversion reached 500 sales!
· 1 day ago
```

**Level Up:**
```
🎊 Creator Promotion!
👤 CreatorName advanced from 🥈 Advanced to 🥇 Flagship Creator!
· 3 days ago
```

### 4.4 Feed Filtering
- **All** (default): Everything from followed creators
- **Signals Only**: Trade signals only
- **Strategies**: New/updated strategies only
- **Milestones**: Celebrations and level-ups

### 4.5 States
| State | Behavior |
|-------|----------|
| **Not following anyone** | "Follow creators to see their activity here" + FollowSuggestions carousel |
| **No recent activity** | "No activity from your followed creators in the last 7 days" |
| **Loading** | Skeleton: 5 feed item placeholders |
| **Error** | "Failed to load feed. Pull to refresh." |
| **New items** | "3 new updates" banner at top |

### 4.6 FollowSuggestions
- Algorithm: Top creators in user's preferred markets, sorted by engagement
- Carousel: 5-10 creators with mini cards (avatar + name + level + top strategy)
- "Follow" button on each card
- Refreshed daily

---

## 5. IPC CHANNELS

```typescript
// Comments
'comment:list'      // Get comments for a strategy (paginated)
'comment:create'    // Post a comment
'comment:edit'      // Edit own comment (5 min window)
'comment:delete'    // Soft-delete own comment
'comment:react'     // Like/helpful reaction toggle
'comment:report'    // Report a comment

// Creator Homepage
'creator:profile'   // Get creator profile by ID
'creator:follow'    // Follow/unfollow a creator
'creator:badges'    // Get badges for a creator

// Follow Feed
'feed:list'         // Get feed items (paginated, filtered)
'feed:suggestions'  // Get follow suggestions
```

---

## 6. IMPLEMENTATION FILE MAP

```typescript
// Comments
src/components/social/CommentSection.tsx
src/components/social/CommentItem.tsx
src/components/social/CommentInput.tsx
src/components/social/StarRating.tsx

// Creator Homepage
src/pages/creator/CreatorHomepage.tsx
src/components/social/CreatorHeroBanner.tsx
src/components/social/TrustBar.tsx
src/components/social/FeaturedStrategies.tsx

// Follow Feed
src/pages/Feed.tsx (or tab in Dashboard)
src/components/social/FeedItem.tsx
src/components/social/FollowSuggestions.tsx

// Stores
src/stores/socialStore.ts (zustand: feed + following list)

// IPC (electron)
electron/ipc/social-ipc.ts
```

---

## 7. MODERATION & SAFETY

| Rule | Implementation |
|------|---------------|
| Profanity filter | Pre-submit check with word list |
| Spam detection | Rate limit: 5 comments/min, 30/hour |
| Link filter | No links in first comment from a user |
| Report queue | Admin dashboard: /admin/reports |
| Ban system | 3 strikes → 24h mute, 5 strikes → permanent ban |
| Content deletion | Soft delete (preserve DB record, hide from UI) |

---

## 8. ENGAGEMENT METRICS

| Metric | Target |
|--------|--------|
| Comment rate | >15% of buyers leave comments |
| Reply rate (creator) | >60% of comments get creator reply |
| Follow rate | >10% of users follow at least 1 creator |
| Feed DAU | >30% of active users check feed daily |
| Follow→Purchase conversion | >5% of followers buy a strategy within 30 days |
