<!-- META
version: 1.12.0
last_updated: 2026-06-12
round: R26
owner: QClaw
purpose: (auto-generated, needs review)
-->

# TradingEasy v0.6.0 Installer Verification Checklist

**Date**: 2026-06-06
**Tester**: ML (EasyClaw)
**Build**: `release/TradingEasy Setup 0.6.0.exe` (113 MB, 07:04 GMT+8)

---

## Pre-Install Verification

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 1 | `npm run build` | ✅ | 3 bundles, 0 errors |
| 2 | `tsc --noEmit` | ✅ | 0 errors |
| 3 | `npm test` | ✅ | 129/129 passed (6 files) |
| 4 | `.exe` file exists | ✅ | 113,078,550 bytes |
| 5 | `build/icon.png` | ✅ | 1,024×1,024, 591 KB |
| 6 | `icons/icon.png` | ✅ | 256×256, 71 KB |
| 7 | `icons/icon.ico` | ✅ | 108 KB (multi-size 16–256) |
| 8 | `icons/tray-icon.png` | ✅ | 16×16, 768 B |
| 9 | `electron/main.ts` uses tray-icon.png | ✅ | Line references confirmed |
| 10 | `electron/main.ts` window icon uses icons/icon.png | ✅ | Line references confirmed |
| 11 | `package.json` build.win.icon = build/icon.png | ✅ | Confirmed |
| 12 | `package.json` version = "0.6.0" | ✅ | Confirmed |
| 13 | `CHANGELOG.md` updated through R25 | ✅ | Confirmed |

---

## Install Flow (Manual)

| # | Step | Expected | Actual |
|---|------|----------|--------|
| 1 | Run `TradingEasy Setup 0.6.0.exe` | Installer launches | ☐ |
| 2 | Custom install location | User picks directory | ☐ |
| 3 | Installation completes | No errors | ☐ |
| 4 | Desktop shortcut created | Shortcut with logo icon | ☐ |
| 5 | Start menu entry created | TradingEasy appears | ☐ |

---

## First Launch

| # | Step | Expected | Actual |
|---|------|----------|--------|
| 6 | Launch app | Window opens 1,400×900 | ☐ |
| 7 | Window title | "TradingEasy · 道鲸" | ☐ |
| 8 | Window icon (title bar) | DW logo (gold → dark gradient) | ☐ |
| 9 | Taskbar icon | DW logo (not generic electron icon) | ☐ |
| 10 | System tray icon | DW logo 16×16 (not diamond shape) | ☐ |
| 11 | Tray right-click menu | Show/Main, Emergency Stop, Quit | ☐ |
| 12 | Tray double-click | Shows main window | ☐ |
| 13 | Tray tooltip | "TradingEasy · 道鲸" | ☐ |
| 14 | Splash/preload screen | Dark background (#0d1117), no white flash | ☐ |

---

## Page Checks

| # | Page | Expected |
|---|------|----------|
| 15 | Dashboard | Loads with real-time WS quotes |
| 16 | Market | Search → add stocks → K-line chart |
| 17 | Strategy | NL + template form + backtest pipeline |
| 18 | Trade Dashboard | Real IPC data (not mock) |
| 19 | Trade Execution | Order placement pipeline |
| 20 | Trade History | Order list + cancel |
| 21 | Portfolio | Real positions + asset allocation bar |
| 22 | Risk Dashboard | 7 risk checks + emergency stop |
| 23 | Alert Center | Alert list + acknowledgment |
| 24 | Settings | OpenD config + risk config + system info |
| 25 | Onboarding | 3-step guide (first launch only) |

---

## Icons Summary

| Icon Location | File | Size | Source |
|--------------|------|------|--------|
| Window title bar | `icons/icon.png` | 256×256 | Logo resized |
| Taskbar | `icons/icon.ico` | 16–256 multi | Logo multi-size |
| System tray | `icons/tray-icon.png` | 16×16 | Logo 16×16 |
| Desktop shortcut | `icons/icon.ico` | 16–256 | Auto by electron-builder |
| App installer | `build/icon.png` | 1,024×1,024 | Logo source |

---

## Known Limitations

- Moomoo adapter is **mock mode** only (real TCP in R26 JVS task)
- No auto-update notification until next release
- Tray "Emergency Stop" requires live strategy running to be meaningful
- BrokerSelector UI component not yet built (R26 JVS task)
- Cross-broker account aggregation not yet implemented (R26 JVS task)

---

## Sign-off

- [ ] Install flow verified
- [ ] All icons correct (no generic electron defaults)
- [ ] No crash on launch
- [ ] All 11 pages load
- [ ] Tray works (context menu + double-click + tooltip)

**Signature**: ML (EasyClaw)
**Date**: 2026-06-06
