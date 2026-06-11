<!-- META
version: 1.12.0
last_updated: 2026-06-12
round: R92
owner: QClaw
purpose: (auto-generated, needs review)
-->

# R92 Exclude Tracking — Issue Numbers

## Remaining 3 Excludes (Target: ≤3 per PM R92)

### R92-EXC-01: q35-trading-components.test.tsx
- **Reason**: Requires `@testing-library/react` which is not installed
- **Fix plan**: Install `@testing-library/react` as devDependency (JVS task)
- **Owner**: JVS (dependency management)
- **Estimated fix**: R93

### R92-EXC-02: benchmark-engines.test.ts
- **Reason**: Heavy CPU benchmark that hangs vitest runner (10+ min)
- **Fix plan**: Move to `vitest.node.config.ts` with `testTimeout: 120000` or run separately via `node` scripts
- **Owner**: JVS (test infrastructure)
- **Estimated fix**: R93

### R92-EXC-03: ws-backfill.test.ts
- **Reason**: Requires live WebSocket server (integration test)
- **Fix plan**: Add mock WS server or move to E2E test suite
- **Owner**: JVS (infrastructure)
- **Estimated fix**: R93

## Previously Excluded (Now Re-enabled by youdao R92)

18 meta-tests that QClaw excluded due to `execSync` recursive spawn:
- q51-01, q51-02, q52, q55, q60-03 through q66-03, q67-01, q67-02, q68-03, q69-01, q71-01, q71-02, q75-03
- **Fix**: These tests have been re-enabled. Any failures will be addressed individually.

## Test Results Progress

| State | Pass | Fail | Skip | Excludes |
|-------|------|------|------|----------|
| R91 baseline | 5096 | 461 | 16 | 19 |
| After randomUUID fix | 5261 | 296 | 16 | 21 (QClaw added) |
| After exclude cleanup | TBD | TBD | TBD | 3 |
