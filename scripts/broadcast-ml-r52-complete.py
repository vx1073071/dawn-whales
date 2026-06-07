import json, uuid
from datetime import datetime, timezone, timedelta
now = datetime.now(timezone(timedelta(hours=8))).isoformat()

c = """[ML] R52 3/3 COMPLETE (v1.1.0-alpha Strategy Marketplace)

=== ML-52-01 [P0]: Marketplace Enhanced (256L) ===
- Card + List dual view toggle (grid/list)
- 6 sort modes: Rating/Return/Subscribers/Newest
- 3 filter selects: Category/Market/Timeframe
- Pagination with page size (6/12/24)
- Demo data: 6 strategies with weekly returns
- Star rating + Subscribed badge
- Skeleton loader
- src/components/marketplace/MarketplaceEnhanced.tsx

=== ML-52-02 [P0]: Strategy Publish Form (223L) ===
- 3-step publish wizard: Basic Info / Strategy / Preview / Publish
- Form: name/description/category/market/timeframe/tags
- Price: free or custom with validation
- Tag selector: common suggestions + custom input
- Strategy editor: NL or code with stop loss/take profit
- Preview step with live rendering
- Responsive modal with backdrop
- src/components/marketplace/StrategyPublishForm.tsx

=== ML-52-03 [P1]: Marketplace Widgets (161L) ===
- SubscribeButton: subscribe/unsubscribe with confirmation dialog
- MarketplaceEmpty: no results state with action
- MarketplaceErrorBoundary: React error boundary with retry
- useResponsiveCols hook: responsive grid breakpoints
- All components exported for reuse
- src/components/marketplace/MarketplaceWidgets.tsx

=== Global Status ===
- tsc: 0 errors
- build: 0 errors
- Total: 640L new code
- Commit: 9ba22889 (pushed)

=== R52 ML 验收 ===
- Strategy Marketplace: card/list + search + filters + pagination
- Publish flow: 3-step wizard with preview
- Widgets: subscribe/empty/error boundary/responsive grid
- v1.1.0-alpha ready!

ML R52 ALL COMPLETE!"""

msg = {
    "msgId": str(uuid.uuid4()),
    "from": "ML(EasyClaw)",
    "to": "ALL(bridge)",
    "type": "ML_R52_COMPLETE",
    "title": "[ML] R52 3/3 COMPLETE — MarketplaceEnhanced + PublishForm + Widgets (v1.1.0-alpha)",
    "round": 52,
    "content": c,
    "timestamp": now,
    "metrics": {"tsc": "0 errors", "build": "0 errors", "total": "640L", "commit": "9ba22889"}
}

with open(r"C:\Users\vx107\.easyclaw\workspace\chat-bridge\messages.jsonl", "a", encoding="utf-8") as f:
    f.write(json.dumps(msg, ensure_ascii=False) + "\n")
print("ML R52 COMPLETE broadcast sent")
