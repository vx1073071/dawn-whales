# R236-QClaw#1: Social Features — Full Implementation Specification
## QUANT MOO v2.6.0 QUANTUM · R236 · 16h

> **Context**: R234-QClaw#2 delivered the conceptual design (3 features, 12KB). R236 delivers the full implementation-ready spec with all states, i18n, data models, and integration details.

---

## TABLE OF CONTENTS
1. Comments System (Section 2)
2. Creator Homepage (Section 3)
3. Follow Feed (Section 4)
4. Trust Badge System (Section 5)
5. Integration Spec (Section 6)
6. i18n Reference (Section 7)

---

## 2. COMMENTS SYSTEM — FULL SPEC

### 2.1 Component Tree
```
StrategyDetailPage
└── CommentSection
    ├── CommentStatsBar        ← (count, avg rating, distribution)
    ├── CommentSortSelector    ← (Newest / Most Helpful / Highest Rated)
    ├── CommentInput           ← (rating + text, purchase-gated)
    │   ├── StarRatingSelector
    │   └── TextArea + Submit
    ├── CommentList            ← (virtualized, paginated)
    │   └── CommentItem[]
    │       ├── Avatar + Name + Time + EditedFlag
    │       ├── StarRating (if rated)
    │       ├── Body (markdown-lite: bold, links, line breaks)
    │       ├── ActionBar (Like / Mark Helpful / Reply / Report / Edit / Delete)
    │       ├── CreatorBadge (gold pill, if author=creator)
    │       ├── VerifiedPurchaseBadge (green pill)
    │       └── ReplyThread (max depth 2, collapsed after 3 replies)
    │           └── ReplyItem[] (same as CommentItem, no further nesting)
    └── LoadMoreTrigger
```

### 2.2 All States Matrix

| State | Trigger | UI |
|-------|---------|-----|
| **Empty** | 0 comments | Illustration + "No comments yet. Share your experience!" + prominent star rating selector |
| **Loading** | API in flight | 3 skeleton comment cards (pulsing gray bars) |
| **Error** | Network/server error | Red banner: "Couldn't load comments. [Retry]" + cached comments below if available |
| **Offline** | No connection | "You're offline. Comments loaded from cache." |
| **Rate Limited** | >5/min or >30/hr | Toast: "Slow down! You can comment again in {n}s." + input disabled with countdown |
| **Not Purchased** | Non-buyer viewing | Input hidden. Lock icon + "Purchase this strategy to leave a comment" + [Buy Now] CTA |
| **Banned User** | 3+ strikes | Input replaced with: "Your commenting has been restricted. [Appeal]" |
| **Soft Deleted** | User/creator deletes | Body replaced with: "[This comment has been removed]" in gray italic |
| **Admin Deleted** | Moderation action | Body replaced with: "[Removed by moderator — {reason}]" in red italic |
| **Own Comment** | Current user = author | Blue left border accent. [Edit] [Delete] actions visible. |
| **Creator Reply** | Author = strategy creator | Gold "Creator" badge. Pinned to top if ≥5 helpful marks. |
| **Edited** | Comment edited | "edited" tag next to timestamp |
| **Reply Limit** | Thread ≥10 replies | "View all {n} replies →" expander link |

### 2.3 Rating Distribution Widget
```
┌────────────────────────────┐
│ ★★★★★  ████████████  48%  │
│ ★★★★   ██████░░░░░  28%  │
│ ★★★    ███░░░░░░░░  14%  │
│ ★★     █░░░░░░░░░░   6%  │
│ ★      ░░░░░░░░░░░   4%  │
│                             │
│ Average: 4.1 ★ (142 ratings)│
└────────────────────────────┘
```

### 2.4 CommentSortSelector Options
| Sort | Label | Algorithm |
|------|-------|-----------|
| Newest | "Newest First" | `createdAt DESC` |
| Helpful | "Most Helpful" | `reactions.helpful DESC, createdAt DESC` |
| Rated | "Highest Rated" | `rating DESC, createdAt DESC` |

Default: "Most Helpful" if comments ≥10, else "Newest First"

### 2.5 Moderation Flow
```
Comment Submitted
  → Profanity Filter (pre-submit, client-side)
  → Spam Detection: links + all-caps + repetition
  → If flagged: "Your comment is being reviewed." (queued, hidden from others, visible to author with "pending review" badge)
  → If clean: published immediately
  → Creator can reply/delete spam from own strategies
  → Users can report → Admin queue → review → dismiss/delete/warn
  → 3 warnings → 24h mute → 5 → permanent ban
```

### 2.6 Markdown-Lite Support
Rendered in comments: `**bold**`, `*italic*`, `[text](url)` → unfurl as link, line breaks → `<br>`. No HTML, no images, no code blocks.

---

## 3. CREATOR HOMEPAGE — FULL SPEC

### 3.1 Component Tree
```
CreatorHomepage
├── CoverPhoto (full-width, editable by owner, default gradient)
├── ProfileHeader
│   ├── Avatar (large circle, 120px)
│   ├── DisplayName + @handle
│   ├── LevelBadge (L1🥉/L2🥈/L3🥇 with tooltip showing level perks)
│   ├── FollowButton (primary CTA, 3 states)
│   └── ShareButton (copy link → "Link copied!")
├── TrustBar
│   └── TrustBadge[] (max 8, scrollable row, empty slots grayed out)
├── StatsRow
│   ├── StatCard("Strategies", count, icon)
│   ├── StatCard("Followers", count, icon)
│   ├── StatCard("Total Sales", count, icon)
│   ├── StatCard("Rating", avg, stars)
│   └── StatCard("Joined", date)
├── BioSection
│   └── Rich text bio (max 500 chars, rendered with markdown-lite)
├── FeaturedStrategies (carousel, max 3, auto-play 5s)
│   └── StrategyCard[] (compact: name + return + rating + price)
├── AllStrategies (grid, 3-col desktop/2-col tablet/1-col mobile)
│   ├── FilterBar (market, risk, sort, search)
│   ├── StrategyCard[] (full-size cards)
│   └── LoadMore / Empty state
├── SocialLinks (Twitter/Telegram/Discord icons)
└── ReportButton (flag icon, bottom of page)
```

### 3.2 FollowButton States
| State | Label | Color | Action |
|-------|-------|-------|--------|
| **Not Following** | "Follow" | Primary (blue) | Follow → optimistic UI update |
| **Following** | "Following ✓" | Secondary (gray) | On hover: "Unfollow?" (red) |
| **Own Profile** | "Edit Profile" | Secondary | → Settings page |

### 3.3 Empty States
| Section | Empty State |
|---------|-------------|
| No strategies | "This creator hasn't published any strategies yet." + (if own profile) "Upload your first →" |
| No bio | (if own) "Tell your story. [Add Bio]" / (if other) not shown |
| No social links | Row hidden entirely |
| No followers | "Be the first to follow this creator!" |

### 3.4 Responsive Layout
| Breakpoint | Layout |
|------------|--------|
| ≥1200px | Sidebar: stats + bio (left 300px), strategies: grid 3-col |
| 768-1199px | Sidebar: collapsed to top, strategies: grid 2-col |
| <768px | Single column, strategies: grid 1-col, carousel: 1 visible |

---

## 4. FOLLOW FEED — FULL SPEC

### 4.1 Component Tree
```
FollowFeed (in Dashboard or as standalone page)
├── FeedHeader
│   ├── Title: "Following"
│   ├── FilterTabs: [All] [Signals] [Strategies] [Milestones]
│   ├── UnreadBadge: "3 new" (dismissible)
│   └── RefreshButton (pull-to-refresh on mobile)
├── FeedList (infinite scroll, 10 items per page)
│   └── FeedItem[] (6 types, see below)
│       ├── CreatorAvatar + Name (small, linked)
│       ├── Timestamp (relative: "2h ago", "3d ago")
│       ├── FeedBody (varies by type)
│       └── FeedAction (varies by type)
├── EmptyFeedState
│   └── "Follow creators to fill your feed" + FollowSuggestions
└── FollowSuggestions
    └── CreatorCard[] (horizontal scroll, "Follow" button on each)
```

### 4.2 FeedItem Types — Full Layout Spec

**Type 1: New Strategy**
```
┌────────────────────────────────────────────┐
│ 👤 [CreatorName] published a new strategy   │
│ ┌────────────────────────────────────────┐ │
│ │ 📈 [StrategyName]                      │ │
│ │ [risklLevel badge] · [price] USDT      │ │
│ │ [oneLiner description]                 │ │
│ │ Match: 78% for you                     │ │
│ │ [View Strategy →]                      │ │
│ └────────────────────────────────────────┘ │
│ · 2 hours ago                              │
└────────────────────────────────────────────┘
```

**Type 2: Strategy Update**
```
┌────────────────────────────────────────────┐
│ 👤 [CreatorName] updated [StrategyName]     │
│ Changelog: "Adjusted stop-loss from 8% to  │
│ 10% and added RSI filter for entry."       │
│ · 5 hours ago     [View Changes →]         │
└────────────────────────────────────────────┘
```

**Type 3: Trade Signal (only if user subscribed)**
```
┌────────────────────────────────────────────┐
│ 👤 [CreatorName] · [StrategyName]           │
│ ┌────────────────────────────────────────┐ │
│ │ 🟢 BUY · BTC/USDT                      │ │
│ │ Entry: $62,450 · TP: $65,800           │ │
│ │ SL: $60,200 · Confidence: 82%          │ │
│ │ [View Signal →]                        │ │
│ └────────────────────────────────────────┘ │
│ · 15 min ago · 142 followers saw this      │
└────────────────────────────────────────────┘
```

**Type 4: Milestone**
```
┌────────────────────────────────────────────┐
│ 🎉 Milestone!                               │
│ [CreatorName]'s [StrategyName] reached      │
│ [milestoneText, e.g. "500 sales"]!          │
│ · 1 day ago                                │
└────────────────────────────────────────────┘
```

**Type 5: Level Up**
```
┌────────────────────────────────────────────┐
│ 🎊 Promotion!                               │
│ [CreatorName] advanced from 🥈 Advanced    │
│ to 🥇 Flagship Creator!                    │
│ Platform fee reduced from 20% → 10%        │
│ · 3 days ago                               │
└────────────────────────────────────────────┘
```

**Type 6: Creator Reply (to user's comment)**
```
┌────────────────────────────────────────────┐
│ 👤 [CreatorName] replied to your comment on │
│ [StrategyName]:                             │
│ "Thanks for the feedback! Check out my      │
│  latest update — I addressed that."         │
│ · 30 min ago     [View Reply →]            │
└────────────────────────────────────────────┘
```

### 4.3 Feed Push Logic
| Event | Push Type | Trigger |
|-------|-----------|---------|
| New strategy published | Push + Feed + Email(opt) | Creator publishes → all followers |
| Strategy updated | Feed only | Creator saves changes (debounced 1h) |
| Trade signal | Push + Feed | Signal engine emits → subscribers only |
| Milestone (100/500/1000 sales) | Feed only | Checked hourly |
| Level up | Push + Feed | Instant on level change |
| Creator reply | Push + Feed | Creator replies to user's comment |

### 4.4 Deduplication Rules
- Same strategy → show only most recent action within 24h
- Multiple signals from same strategy → group with "2 more signals" badge
- Milestones: only show first time a threshold is crossed

---

## 5. TRUST BADGE SYSTEM — FULL SPEC

### 5.1 Badge Catalog (8 badges)

| # | Badge | Icon | Criteria | Auto? | Display Rule |
|---|-------|------|----------|-------|-------------|
| 1 | **Verified Backtest** | 📊 | Backtest results uploaded AND system verified (30s simulation passes) | Auto | Always shown if earned |
| 2 | **Low Refund Rate** | 🛡️ | Refund rate <5% over lifetime, min 20 sales | Auto | Hidden if <20 sales |
| 3 | **High Rating** | ⭐ | Average rating ≥4.5, min 10 ratings | Auto | Hidden if <10 ratings |
| 4 | **Consistent** | 📅 | At least 1 sale in each of last 3 months | Auto | Checked monthly |
| 5 | **Whale** | 🐋 | Any single strategy earned ≥1000 USDT | Auto | Shown on that strategy + profile |
| 6 | **Fast Responder** | ⚡ | Average reply time <24h, ≥5 replies | Auto | Checked weekly |
| 7 | **Top Seller** | 🏆 | Top 10% of creators by revenue in their primary market | Auto | Updated weekly |
| 8 | **Editor's Pick** | 💎 | Manually awarded by QUANT MOO team | Manual | Permanent unless revoked |

### 5.2 Badge Computation Schedule
```
Hourly:   Nothing
Daily:    Verified Backtest, Fast Responder
Weekly:   Top Seller, Consistent
Monthly:  Low Refund Rate, High Rating, Whale
On-event: Level Up (instant), Editor's Pick (instant)
```

### 5.3 Badge Display Rules
- Maximum 8 badges displayed; if more, show first 5 + "+3 more" expander
- Empty badge slots shown as grayed-out circles with tooltip: "Earn this by [criteria]"
- Badges appear on: Creator Homepage, Strategy Detail (only strategy-relevant), Search Results (mini, 2 shown)
- Badge tooltip shows: badge name + criteria description + date earned

### 5.4 Trust Score (Composite)
```typescript
function computeTrustScore(creator: CreatorProfile): number {
  let score = 0;
  if (creator.badges.includes('verified_backtest')) score += 20;
  if (creator.badges.includes('low_refund')) score += 15;
  if (creator.badges.includes('high_rating')) score += 15;
  if (creator.badges.includes('consistent')) score += 10;
  if (creator.badges.includes('whale')) score += 10;
  if (creator.badges.includes('fast_responder')) score += 10;
  if (creator.badges.includes('top_seller')) score += 10;
  if (creator.badges.includes('editors_pick')) score += 10;
  // Cap at 100
  return Math.min(score, 100);
}
// Trust tier: 0-25 = New, 25-50 = Building, 50-75 = Trusted, 75-100 = Elite
```

---

## 6. INTEGRATION SPEC

### 6.1 IPC Channels (full detail)
```typescript
// ═══ Comments ═══
'comment:list'      // IN: {strategyId, sort, page, limit} → OUT: {comments: Comment[], total: number, hasMore: boolean}
'comment:create'    // IN: {strategyId, body, rating?} → OUT: {comment: Comment}
'comment:edit'      // IN: {commentId, body} → OUT: {comment: Comment, editedAt: number}
'comment:delete'    // IN: {commentId} → OUT: {deletedAt: number} (soft delete)
'comment:react'     // IN: {commentId, reaction: 'like'|'helpful'} → OUT: {reactions: ReactionCounts}
'comment:report'    // IN: {commentId, reason: string} → OUT: {reportedAt: number}
'comment:rate'      // IN: {strategyId, rating: 1-5, body?: string} → OUT: {comment: Comment}

// ═══ Creator ═══
'creator:profile'   // IN: {userId} → OUT: {profile: CreatorProfile}
'creator:follow'    // IN: {creatorId, action: 'follow'|'unfollow'} → OUT: {following: boolean, followerCount: number}
'creator:badges'    // IN: {userId} → OUT: {badges: TrustBadge[], trustScore: number}

// ═══ Feed ═══
'feed:list'         // IN: {filter?, page, limit} → OUT: {items: FeedItem[], hasMore: boolean, unreadCount: number}
'feed:suggestions'  // IN: {} → OUT: {creators: CreatorCard[]}
'feed:markRead'     // IN: {feedItemIds: string[]} → OUT: {success: boolean}
```

### 6.2 Store Design
```typescript
// src/stores/socialStore.ts (zustand)
interface SocialStore {
  // Comments
  commentsByStrategy: Map<string, Comment[]>;
  commentCounts: Map<string, number>;
  loadComments: (strategyId: string, sort?: string) => Promise<void>;
  addComment: (strategyId: string, body: string, rating?: number) => Promise<void>;
  deleteComment: (commentId: string) => Promise<void>;

  // Following
  following: Set<string>;
  followCreator: (creatorId: string) => Promise<void>;
  unfollowCreator: (creatorId: string) => Promise<void>;
  isFollowing: (creatorId: string) => boolean;

  // Feed
  feedItems: FeedItem[];
  feedUnread: number;
  feedFilter: string;
  loadFeed: (filter?: string) => Promise<void>;
  loadMore: () => Promise<void>;
  markRead: (itemIds: string[]) => void;

  // Trust
  trustScores: Map<string, number>;
  creatorBadges: Map<string, TrustBadge[]>;
  loadBadges: (creatorId: string) => Promise<void>;
}
```

### 6.3 Database Tables (SQLite)
```sql
-- Comments
CREATE TABLE strategy_comments (
  id TEXT PRIMARY KEY,
  strategy_id TEXT NOT NULL,
  author_id TEXT NOT NULL,
  parent_id TEXT,
  body TEXT NOT NULL,
  rating INTEGER CHECK(rating BETWEEN 1 AND 5),
  reactions_like INTEGER DEFAULT 0,
  reactions_helpful INTEGER DEFAULT 0,
  is_creator_reply INTEGER DEFAULT 0,
  is_edited INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER,
  deleted_at INTEGER,
  FOREIGN KEY(strategy_id) REFERENCES strategies(id),
  FOREIGN KEY(author_id) REFERENCES users(id),
  FOREIGN KEY(parent_id) REFERENCES strategy_comments(id)
);

-- Follows
CREATE TABLE user_follows (
  follower_id TEXT NOT NULL,
  creator_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY(follower_id, creator_id)
);

-- Feed
CREATE TABLE feed_events (
  id TEXT PRIMARY KEY,
  creator_id TEXT NOT NULL,
  event_type TEXT NOT NULL,  -- new_strategy, strategy_update, signal, milestone, level_up, reply
  entity_id TEXT,             -- strategy_id, comment_id, etc
  payload TEXT,               -- JSON blob with event-specific data
  created_at INTEGER NOT NULL,
  FOREIGN KEY(creator_id) REFERENCES users(id)
);

-- Badges
CREATE TABLE creator_badges (
  creator_id TEXT NOT NULL,
  badge_id TEXT NOT NULL,
  earned_at INTEGER NOT NULL,
  revoked_at INTEGER,
  PRIMARY KEY(creator_id, badge_id)
);
```

### 6.4 Integration Points
| System | Integration |
|--------|-------------|
| **Strategy Marketplace** | Comment count + avg rating on strategy cards |
| **Search** | Trust score boosts search ranking |
| **Notifications** | Feed items trigger push notifications |
| **Creator Studio** | Analytics page shows comment/follow metrics |
| **Admin Dashboard** | Report queue, badge management, moderation log |
| **User Profile** | Following count, trust tier shown on profile |

### 6.5 Performance Targets
| Metric | Target |
|--------|--------|
| Comments load (first page) | <300ms |
| Feed load (first page) | <400ms |
| Creator homepage render | <500ms |
| Comment post response | <200ms (optimistic UI) |
| Feed infinite scroll next page | <300ms |
| Trust badge computation | <100ms (pre-computed, cached) |

---

## 7. i18n COVERAGE

### 7.1 Comment System i18n

| Key | EN | Description |
|-----|-----|-------------|
| `social_comment_title` | "Comments" | Section header |
| `social_comment_empty` | "No comments yet. Be the first to share your experience!" | Empty state |
| `social_comment_empty_cta` | "Rate & Review" | Empty state CTA button |
| `social_comment_input_placeholder` | "Share your thoughts on this strategy..." | Input placeholder |
| `social_comment_rating_prompt` | "Rate this strategy" | Rating selector label |
| `social_comment_post` | "Post" | Submit button |
| `social_comment_login_required` | "Sign in to comment" | Unauthenticated user |
| `social_comment_purchase_required` | "Purchase this strategy to leave a comment" | Non-buyer |
| `social_comment_loading` | "Loading comments..." | Loading state |
| `social_comment_error` | "Failed to load comments" | Error state |
| `social_comment_error_retry` | "Retry" | Error CTA |
| `social_comment_offline` | "Showing cached comments" | Offline banner |
| `social_comment_rate_limited` | "Slow down! Try again in {seconds}s" | Rate limit toast |
| `social_comment_deleted` | "[This comment has been removed]" | Soft-deleted text |
| `social_comment_mod_removed` | "[Removed by moderator]" | Admin deleted text |
| `social_comment_edited` | "(edited)" | Edited tag |
| `social_comment_pending_review` | "Pending review" | Queued badge |
| `social_comment_creator_badge` | "Creator" | Creator badge label |
| `social_comment_verified_purchase` | "Verified Purchase" | Purchase badge label |
| `social_comment_btn_reply` | "Reply" | Reply button |
| `social_comment_btn_like` | "Like" | Like button (aria-label) |
| `social_comment_btn_helpful` | "Mark Helpful" | Helpful button |
| `social_comment_btn_report` | "Report" | Report button |
| `social_comment_btn_edit` | "Edit" | Edit button (own) |
| `social_comment_btn_delete` | "Delete" | Delete button (own) |
| `social_comment_report_reason` | "Why are you reporting this?" | Report modal title |
| `social_comment_report_spam` | "Spam" | Report reason |
| `social_comment_report_abuse` | "Harassment or abuse" | Report reason |
| `social_comment_report_misinfo` | "Misleading information" | Report reason |
| `social_comment_report_other` | "Other" | Report reason |
| `social_comment_report_thanks` | "Thanks for reporting. We'll review this." | Report confirmation |
| `social_comment_sort_newest` | "Newest" | Sort option |
| `social_comment_sort_helpful` | "Most Helpful" | Sort option |
| `social_comment_sort_rated` | "Highest Rated" | Sort option |
| `social_comment_view_replies` | "View {count} replies" | Thread expander |

### 7.2 Creator Homepage i18n

| Key | EN | Description |
|-----|-----|-------------|
| `social_creator_follow` | "Follow" | Follow button (unfollowed) |
| `social_creator_following` | "Following" | Follow button (followed) |
| `social_creator_unfollow_hover` | "Unfollow?" | Hover state |
| `social_creator_followers` | "{count} followers" | Follower count |
| `social_creator_strategies` | "{count} strategies" | Strategy count |
| `social_creator_sales` | "{count} sales" | Sales count |
| `social_creator_joined` | "Joined {date}" | Join date |
| `social_creator_rating` | "{rating} ★" | Rating display |
| `social_creator_share` | "Share Profile" | Share button |
| `social_creator_share_copied` | "Link copied!" | Share confirmation |
| `social_creator_featured` | "Featured Strategies" | Featured section header |
| `social_creator_all` | "All Strategies" | All strategies header |
| `social_creator_bio_empty_own` | "Tell your trading story. [Add Bio]" | Empty bio (own) |
| `social_creator_no_strategies` | "No strategies published yet" | Empty strategies |
| `social_creator_report` | "Report Profile" | Report button |
| `social_creator_filter_market` | "Market" | Filter label |
| `social_creator_filter_risk` | "Risk Level" | Filter label |
| `social_creator_filter_sort` | "Sort by" | Filter label |

### 7.3 Follow Feed i18n

| Key | EN | Description |
|-----|-----|-------------|
| `social_feed_title` | "Following" | Feed header |
| `social_feed_tab_all` | "All" | Filter tab |
| `social_feed_tab_signals` | "Signals" | Filter tab |
| `social_feed_tab_strategies` | "Strategies" | Filter tab |
| `social_feed_tab_milestones` | "Milestones" | Filter tab |
| `social_feed_new` | "{count} new" | Unread badge |
| `social_feed_empty` | "Follow creators to fill your feed" | Empty state |
| `social_feed_empty_cta` | "Discover Creators" | Empty CTA |
| `social_feed_suggestions` | "Suggested for you" | Suggestions header |
| `social_feed_error` | "Couldn't load feed" | Error state |
| `social_feed_published` | "published a new strategy" | Feed: new strategy prefix |
| `social_feed_updated` | "updated" | Feed: strategy update prefix |
| `social_feed_milestone` | "Milestone!" | Feed: milestone prefix |
| `social_feed_levelup` | "Promotion!" | Feed: level up prefix |
| `social_feed_reply_to_you` | "replied to your comment on" | Feed: reply prefix |
| `social_feed_view_signal` | "View Signal" | Feed: signal CTA |
| `social_feed_view_strategy` | "View Strategy" | Feed: strategy CTA |
| `social_feed_view_changes` | "View Changes" | Feed: update CTA |
| `social_feed_view_reply` | "View Reply" | Feed: reply CTA |
| `social_feed_followers_saw` | "{count} followers saw this" | Signal reach |
| `social_feed_confidence` | "{pct}% confidence" | Signal confidence |
| `social_feed_fee_reduced` | "Platform fee reduced from {old}% to {new}%" | Level up detail |

### 7.4 Trust Badge i18n

| Key | EN | Description |
|-----|-----|-------------|
| `badge_verified_backtest` | "Verified Backtest" | Badge name |
| `badge_verified_backtest_desc` | "Backtest results verified by QUANT MOO" | Badge tooltip |
| `badge_low_refund` | "Low Refund Rate" | Badge name |
| `badge_low_refund_desc` | "Refund rate under 5%" | Badge tooltip |
| `badge_high_rating` | "High Rating" | Badge name |
| `badge_high_rating_desc` | "Average rating 4.5★ or above" | Badge tooltip |
| `badge_consistent` | "Consistent" | Badge name |
| `badge_consistent_desc` | "Monthly sales for 3+ months" | Badge tooltip |
| `badge_whale` | "Whale" | Badge name |
| `badge_whale_desc` | "Single strategy earned 1,000+ USDT" | Badge tooltip |
| `badge_fast_responder` | "Fast Responder" | Badge name |
| `badge_fast_responder_desc` | "Average reply time under 24 hours" | Badge tooltip |
| `badge_top_seller` | "Top Seller" | Badge name |
| `badge_top_seller_desc` | "Top 10% by revenue in market" | Badge tooltip |
| `badge_editors_pick` | "Editor's Pick" | Badge name |
| `badge_editors_pick_desc` | "Curated by QUANT MOO team" | Badge tooltip |
| `badge_empty_slot` | "Earn this badge by: {requirement}" | Empty slot tooltip |
| `badge_earned_date` | "Earned {date}" | Badge detail |
| `trust_score_new` | "New" | Trust tier 0-25 |
| `trust_score_building` | "Building Trust" | Trust tier 25-50 |
| `trust_score_trusted` | "Trusted" | Trust tier 50-75 |
| `trust_score_elite` | "Elite" | Trust tier 75-100 |
