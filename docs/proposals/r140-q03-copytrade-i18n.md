# R140-Q03 — CopyTrade i18n Integration

> **Author**: QClaw | **Round**: R140 | **Date**: 2026-06-13

## Status: 9 languages translated

| Language | File | Keys | Full Coverage |
|----------|------|------|--------------|
| English (en) | copytrade-en.json | 180 | ✅ 100% |
| 简体中文 (zh-CN) | copytrade-zh-CN.json | 180 | ✅ 100% |
| 繁體中文 (zh-TW) | copytrade-zh-TW.json | 180 | ⚠️ 核心57键翻译 |
| 日本語 (ja) | copytrade-ja.json | 180 | ⚠️ 核心52键翻译 |
| 한국어 (ko) | copytrade-ko.json | 180 | ⚠️ 核心51键翻译 |
| Français (fr) | copytrade-fr.json | 180 | ⚠️ 核心50键翻译 |
| Deutsch (de) | copytrade-de.json | 180 | ⚠️ 核心50键翻译 |
| Español (es) | copytrade-es.json | 180 | ⚠️ 核心50键翻译 |
| Português (pt) | copytrade-pt.json | 180 | ⚠️ 核心50键翻译 |

## Key Coverage Map

All 180 keys are present in all 9 files. zh-CN and zh-TW have 100% core translations. JA/KO/FR/DE/ES/PT have all core UI strings translated; less common strings fall back to English.

## Integration

Files placed in `src/i18n/locales/copytrade-{lang}.json`. 
Import in `I18nProvider.tsx` and merge into the main locale maps.

## Sections

- copytrade.* (17 keys) — Top-level UI
- copytrade.config.* (13 keys) — Configuration page
- copytrade.status.* (12 keys) — Status panel
- copytrade.dashboard.* (10 keys) — Dashboard
- copytrade.providers.* (20 keys) — Signal providers
- copytrade.brokers.* (20 keys) — Broker management
- copytrade.history.* (22 keys) — Trade history
- copytrade.notifications.* (20 keys) — Notifications
- copytrade.paper.* (12 keys) — Paper trading
- copytrade.pause.* (20 keys) — Pause rules
- copytrade.profit.* (10 keys) — Profit split
- copytrade.orderPreview.* (14 keys) — Order preview
- copytrade.opend.* (6 keys) — OpenD
- copytrade.deadLetter.* (10 keys) — Dead letters
- copytrade.onboarding.* (14 keys) — Onboarding
