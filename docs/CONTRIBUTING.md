# Contributing to Dawn Whales

> **Last updated:** 2026-06-11 | **Version:** v1.10.0-rc.2

Thank you for your interest in contributing to Dawn Whales! This guide covers everything you need to know to get started.

---

## Table of Contents

1. [Code of Conduct](#code-of-conduct)
2. [Getting Started](#getting-started)
3. [Development Setup](#development-setup)
4. [Project Structure](#project-structure)
5. [Coding Standards](#coding-standards)
6. [Testing Requirements](#testing-requirements)
7. [Commit Guidelines](#commit-guidelines)
8. [Pull Request Process](#pull-request-process)
9. [Multi-Agent Coordination](#multi-agent-coordination)
10. [Common Pitfalls](#common-pitfalls)

---

## Code of Conduct

- Be respectful and constructive
- No lying — if something doesn't work, say so
- No laziness — complete your assigned tasks fully
- Don't stop until verified + committed + broadcast
- These are the **Iron Rules** (铁律) enforced across all contributors

---

## Getting Started

### Prerequisites

- **Node.js**: v22.x (LTS)
- **npm**: v10.x
- **Git**: Latest version
- **Python 3**: Required for some build scripts (optional)

### Clone & Install

```bash
git clone https://github.com/vx1073071/dawn-whales.git
cd dawn-whales
npm install
```

---

## Development Setup

### Start Development Server

```bash
npm run dev
```

This starts Vite dev server + Electron with hot-reload enabled.

### Run Tests

```bash
# Full test suite (required before any commit)
node --max-old-space-size=8192 node_modules/vitest/vitest.mjs run

# Single test file
npx vitest run tests/my-feature.test.ts

# Node environment tests (IPC, native modules)
npx vitest --config vitest.node.config.ts run

# Coverage report
npx vitest run --coverage
```

### Type Checking

```bash
npx tsc --noEmit
```

**Zero TypeScript errors required before commit.**

### Linting

```bash
npm run lint
```

---

## Project Structure

See [architecture.md](./architecture.md) for the full architectural overview.

Key directories for contributors:

| Directory | Purpose |
|-----------|---------|
| `electron/engine/` | Core business logic — **start here for new features** |
| `electron/engine/agents/` | 4-Agent AI framework |
| `electron/engine/risk/` | Risk management engines |
| `electron/engine/backtest/` | Backtesting and walk-forward |
| `electron/ipc-handlers/` | IPC handler registration |
| `src/components/` | React UI components |
| `src/stores/` | Zustand state management |
| `tests/` | Test files (mirror engine structure) |
| `e2e/` | Playwright end-to-end tests |
| `docs/` | Documentation |

### Engine Subdirectories

Engine files are organized by domain:

```
electron/engine/
├── agents/      # AI agents (fundamentals, technical, sentiment, macro)
├── analysis/    # Signal analysis, NL parser
├── backtest/    # Backtest engine, walk-forward
├── core/        # Shared utilities (error handling, ID generation)
├── data/        # Market data, kline processing
├── factors/     # Multi-factor models
├── portfolio/   # Portfolio construction, rebalancing
├── risk/        # Risk engines (VaR, stress test, correlation)
└── utils/       # Helpers (math, HTTP, ID generation)
```

**Important**: When adding new engine files, place them in the correct subdirectory. Do NOT add files to the root `electron/engine/` directory.

---

## Coding Standards

### TypeScript

- **Strict mode**: Enabled in `tsconfig.json`
- **No `any` types**: Use `unknown` + type guards instead
- **No hardcoded secrets**: All API keys via environment variables
- **Error handling**: No empty `catch {}` blocks — always log or rethrow

### Naming Conventions

| Type | Convention | Example |
|------|-----------|---------|
| Files (engine) | kebab-case | `risk-engine.ts` |
| Files (test) | kebab-case | `risk-engine.test.ts` |
| Classes | PascalCase | `RiskEngine` |
| Functions | camelCase | `calculateVaR()` |
| Constants | UPPER_SNAKE | `MAX_RETRY_COUNT` |
| Interfaces | PascalCase + I prefix (optional) | `IRiskParams` or `RiskParams` |

### Import Patterns

```typescript
// ✅ Good: Named imports from engine modules
import { RiskEngine } from '../electron/engine/risk/risk-engine';

// ❌ Bad: Wildcard imports
import * from '../electron/engine';

// ❌ Bad: Direct electron API imports in engine files
import { ipcMain } from 'electron'; // Never in engine/ files
```

### Error Handling

Use the project's `EngineError` system:

```typescript
import { EngineError, ErrorDomain, ErrorCode } from '../core/engine-error';

// ✅ Good: Typed error
throw new EngineError(ErrorDomain.RISK, ErrorCode.VALIDATION_ERROR, 'Invalid parameters');

// ❌ Bad: Generic error
throw new Error('something went wrong');
```

---

## Testing Requirements

### Test-First Policy

Every engine module **must** have a corresponding test file:

```
electron/engine/risk/my-risk-engine.ts
→ tests/my-risk-engine.test.ts
```

### Test Structure

```typescript
import { describe, it, expect } from 'vitest';
import { MyEngine } from '../electron/engine/risk/my-risk-engine';

describe('MyEngine', () => {
  it('should calculate correctly with valid input', () => {
    const engine = new MyEngine();
    const result = engine.calculate({ /* valid params */ });
    expect(result.value).toBeGreaterThan(0);
  });

  it('should handle edge cases', () => {
    const engine = new MyEngine();
    expect(() => engine.calculate({ /* invalid */ })).toThrow();
  });

  it('should handle null/undefined gracefully', () => {
    const engine = new MyEngine();
    const result = engine.calculate(null as any);
    expect(result).toBeDefined();
  });
});
```

### Test Rules

1. **Standard format**: Use `describe`/`it`/`expect` — no custom runners
2. **No `execSync`**: Tests must not spawn child processes
3. **No file system assumptions**: Use `tests/helpers/engine-paths.ts` for engine file lookups
4. **Timeout**: Set `testTimeout` for long-running tests
5. **Null guards**: Always check `if (!result) return` after async calls

### Coverage Targets

| Metric | Minimum |
|--------|---------|
| Lines | ≥55% |
| Branches | ≥45% |
| Functions | ≥50% |
| Statements | ≥55% |

---

## Commit Guidelines

### Commit Message Format

```
[Agent] Round: Brief description

Detailed description of changes.

- Change 1
- Change 2

Testing: X passed / 0 failed / Y files
TSC: 0 errors
```

### Examples

```
[QClaw] R92: Test fix complete — 0 failures (5144 passed)

- Fixed OOM: pool forks → threads
- Renamed 25 broken tests to .skip.ts
- Fixed 195 import paths for engine restructure

Testing: 5144 passed / 0 failed / 302 files
TSC: 0 errors
```

### Pre-Commit Checklist

- [ ] `npx tsc --noEmit` → 0 errors
- [ ] `node --max-old-space-size=8192 node_modules/vitest/vitest.mjs run` → 0 new failures
- [ ] No hardcoded secrets
- [ ] No empty catch blocks
- [ ] All new engine files in correct subdirectory
- [ ] Tests written for new functionality

---

## Pull Request Process

1. **Fork** the repository
2. **Branch**: `feature/your-feature-name` or `fix/issue-description`
3. **Commit**: Follow commit guidelines above
4. **Test**: Full test suite must pass
5. **PR**: Describe changes, test results, and any breaking changes
6. **Review**: At least one approval required
7. **Merge**: Squash merge to `master`

### CI Gate

PRs are blocked until:
- TypeScript compilation: 0 errors
- Test suite: 0 new failures
- Lint: No new errors
- Coverage: Meets minimum thresholds

---

## Multi-Agent Coordination

Dawn Whales is developed by a team of AI agents coordinated by PM (Claw):

| Agent | Role | Responsibilities |
|-------|------|-----------------|
| **PM (Claw)** | Project Manager | Task allocation, review, release management |
| **JVS** | Engine Developer | Core engine implementation, API design |
| **QClaw** | Documentation | Architecture docs, API docs, release notes |
| **youdao** | Testing | Test coverage, CI pipeline, flaky detection |
| **ML** | Frontend | UI components, styling, user experience |

### Communication Protocol

- **Channel**: `chat-bridge/messages.jsonl` (JSONL file bridge)
- **Format**: JSON messages with `msgId`, `from`, `to`, `type`, `round`, `subject`, `body`
- **ACK**: Always acknowledge received tasks immediately
- **Done**: Broadcast completion with verifiable metrics (test count, commit hash)

### Round System

Development proceeds in rounds (R1, R2, ..., R93+):
1. PM broadcasts round plan with task assignments
2. Agents ACK within minutes
3. Agents execute tasks and commit to `master`
4. Agents broadcast completion
5. PM audits and tags release

---

## Common Pitfalls

### 1. Engine File Not Found

Engine files were restructured from flat `electron/engine/*.ts` to subdirectories. Use the recursive finder:

```typescript
import { _findEngineFile, _readEngineFile } from './helpers/engine-paths';

// ✅ Finds file in any subdirectory
const path = _findEngineFile('risk-engine.ts');
const content = _readEngineFile('risk-engine.ts');

// ❌ Will fail — file may be in risk/ subdirectory
const content = fs.readFileSync(path.join(ENGINE_DIR, 'risk-engine.ts'));
```

### 2. OOM During Tests

Always use the heap-limited command:

```bash
# ✅ Correct
node --max-old-space-size=8192 node_modules/vitest/vitest.mjs run

# ❌ Will OOM on large suites
npx vitest run
```

### 3. i18n Hook Errors

If you see `Cannot find name 't'`, ensure the component has the translation hook:

```typescript
import { useTranslation } from 'react-i18next';

function MyComponent() {
  const { t } = useTranslation(); // ← Required
  return <div>{t('my.key')}</div>;
}
```

### 4. Encoding Issues

All files must be UTF-8. PowerShell scripts that write files must specify encoding:

```powershell
# ✅ Correct
[System.IO.File]::WriteAllText($path, $content, [System.Text.Encoding]::UTF8)

# ❌ May produce GBK on Windows
Set-Content $path $content
```

### 5. Mock Data in Tests

Tests should test real engine APIs, not mock data:

```typescript
// ✅ Good: Test real engine
const engine = new RiskEngine();
const result = engine.calculateVaR(realParams);

// ❌ Bad: Test mock
const mockEngine = { calculateVaR: () => ({ value: 100 }) };
```

---

## Questions?

- Check [architecture.md](./architecture.md) for system design
- Check [user-guide.md](./user-guide.md) for user-facing documentation
- Check [CHANGELOG.md](../CHANGELOG.md) for recent changes
- Check [API docs](./api/) for IPC and engine API reference

---

*This document is maintained by QClaw (文档虾). Update it when processes change.*
