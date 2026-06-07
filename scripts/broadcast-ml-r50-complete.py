import json, uuid
from datetime import datetime, timezone, timedelta
now = datetime.now(timezone(timedelta(hours=8))).isoformat()

c = """[ML] R50 3/3 COMPLETE (v1.0.0 GA Final Sprint)

=== ML-50-01 [P0]: UI Animations & A11y (276L) ===
- 7 keyframe presets (fadeInUp, scaleIn, slideDown...)
- Dark mode color tokens (surface/border/text/semantic)
- StaggerList: staggered entrance animation (IntersectionObserver)
- PageTransition: cross-page fade wrapper
- SkipLink: keyboard accessibility (tab-to-content)
- VisuallyHidden + LiveRegion: screen reader utilities
- ProgressRing: SVG radial progress indicator
- AnimatedNumber: ease-out number counter
- src/components/ui/UIAnimations.tsx

=== ML-50-02 [P0]: v1.0.0 Release Build (230L) ===
- Pre-flight checks (node version, package version, icons)
- Vite build + electron-builder (win/mac/linux)
- SHA256 hash generation for each artifact
- Auto-update feed URL verification
- Artifact size limit check (200MB)
- Build summary with per-platform reporting
- npm release:check script added
- scripts/v1-release-build.ts

=== ML-50-03 [P1]: v1.0.0 Launch Page (219L) ===
- Hero banner with v1.0.0 badge + gradient background
- 5 key stats bar (3468 tests, 241 engines, 11 rounds...)
- 6 What's New feature cards
- 3-platform install guide (Win/Mac/Linux step-by-step)
- Upgrade guide (auto/manual/from v0.x) with migration notice
- CTA: Download + Star buttons
- Disclaimer footer
- src/components/release/LaunchPageV1.tsx

=== Global Status ===
- tsc: 0 errors
- build: 0 errors
- Total: 725L new code
- Commit: 1da7db55 (pushed)

=== R50 ML 验收 ===
- UI 动画系统: 7 presets + StaggerList + PageTransition
- A11y: SkipLink + VisuallyHidden + LiveRegion
- 发布构建: pre-flight + SHA256 + auto-update check
- v1.0.0 Launch Page: hero + stats + features + install + upgrade
- Version: v1.0.0 GA ready!

ML R50 ALL COMPLETE!"""

msg = {
    'msgId': str(uuid.uuid4()),
    'from': 'ML(EasyClaw)',
    'to': 'ALL(bridge)',
    'type': 'ML_R50_COMPLETE',
    'title': '[ML] R50 3/3 COMPLETE — UIAnimations + v1-release-build + LaunchPageV1',
    'round': 50,
    'content': c,
    'timestamp': now,
    'metrics': {
        'tsc': '0 errors',
        'build': '0 errors',
        'total': '725L',
        'commit': '1da7db55'
    }
}

path = r'C:\Users\vx107\.easyclaw\workspace\chat-bridge\messages.jsonl'
with open(path, 'a', encoding='utf-8') as f:
    f.write(json.dumps(msg, ensure_ascii=False) + '\n')

print('ML R50 COMPLETE broadcast sent')
