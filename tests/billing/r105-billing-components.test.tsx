/**
 * R105 youdao S-10: R103-R104 billing component unit tests
 * 5 components × >=3 tests each
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

// ── Polyfills ─────────────────────────────────────────────
const store: Record<string, string> = {};
(globalThis as any).localStorage = {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => { store[k] = String(v); },
  removeItem: (k: string) => { delete store[k]; },
  clear: () => {}, get length() { return 0; }, key: () => null,
};
(globalThis as any).crypto = { randomUUID: () => `test-${Math.random().toString(36).slice(2)}` };
(globalThis as any).CustomEvent = class extends Event { detail: any; constructor(t: string, i?: any) { super(t, i); this.detail = i?.detail; } };
(globalThis as any).URL.createObjectURL = vi.fn(() => 'blob:test');
(globalThis as any).URL.revokeObjectURL = vi.fn();

// ── Mocks ─────────────────────────────────────────────────
vi.mock('i18next', () => {
  const i18n = { use: () => i18n, init: vi.fn(), changeLanguage: vi.fn(), t: (k: string) => k, addResourceBundle: vi.fn() };
  return { default: i18n, __esModule: true };
});
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { changeLanguage: vi.fn() } }),
  initReactI18next: { type: '3rdParty' as const, init: vi.fn() },
  I18nextProvider: ({ children }: any) => React.createElement('div', null, children),
}));
vi.mock('../../src/i18n/locales/zh-CN.json', () => ({ default: {} }));
vi.mock('../../src/i18n', () => ({
  default: { t: (k: string) => k, changeLanguage: vi.fn() },
  supportedLanguages: [{ code: 'en', label: 'English' }],
  changeLanguage: vi.fn(), preloadLocale: vi.fn(),
}));

const mockUC = vi.fn();
vi.mock('@/hooks/useCredits', () => ({ useCredits: () => mockUC() }));
vi.mock('@/utils/formatTime', () => ({
  formatDateTime: (ts: number) => new Date(ts).toISOString().slice(0, 16).replace('T', ' '),
}));
vi.mock('../../electron/engine/data/exchange-rate-engine', () => ({
  ExchangeRateEngine: class { async getRate() { return 1.0; } getAllRates() { return {}; } refresh() {} },
}));

function ds(overrides: any = {}) {
  return {
    balance: 100.0, transactions: [], filteredTxs: [], totalFiltered: 0,
    filter: 'all', setFilter: vi.fn(), page: 0, setPage: vi.fn(),
    totalPages: 1, pageSize: 20, addTransaction: vi.fn(), deductFee: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => { vi.clearAllMocks(); mockUC.mockReturnValue(ds()); });

// ═══════════════════════════════════════════════════════════
// 1. TopUpConfirmModal (4 tests)
// ═══════════════════════════════════════════════════════════
import TopUpConfirmModal from '../../src/components/billing/TopUpConfirmModal';

describe('TopUpConfirmModal', () => {
  const props = { currency: 'USD', amount: 100, rate: 1.0, estimatedUSDT: 100.0, rateSource: 'live', onConfirm: vi.fn(), onCancel: vi.fn() };

  it('renders modal with transaction details', () => {
    render(React.createElement(TopUpConfirmModal, props));
    expect(screen.getByText(/100\.00 USD/)).toBeDefined();
    // estimatedUSDT appears inside a span with USDT label
    expect(screen.getByText('100.000000')).toBeDefined();
    expect(screen.getByText(/verify the amount/)).toBeDefined();
  });

  it('calls onConfirm when confirm button clicked', () => {
    const onConfirm = vi.fn();
    render(React.createElement(TopUpConfirmModal, { ...props, onConfirm }));
    fireEvent.click(screen.getByText('Confirm'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when cancel button clicked', () => {
    const onCancel = vi.fn();
    render(React.createElement(TopUpConfirmModal, { ...props, onCancel }));
    fireEvent.click(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('shows calculation breakdown', () => {
    render(React.createElement(TopUpConfirmModal, { ...props, currency: 'CNY', amount: 1000, rate: 0.1381, estimatedUSDT: 138.1 }));
    const calcs = screen.getAllByText(/×/);
    expect(calcs.length).toBeGreaterThanOrEqual(1);
  });
});

// ═══════════════════════════════════════════════════════════
// 2. SettlementTimeline (4 tests)
// ═══════════════════════════════════════════════════════════
import SettlementTimeline from '../../src/components/billing/SettlementTimeline.tsx';

describe('SettlementTimeline', () => {
  it('shows empty state when no transactions', () => {
    mockUC.mockReturnValue(ds({ transactions: [] }));
    render(React.createElement(SettlementTimeline));
    expect(screen.getByText('credits.noTransactions')).toBeDefined();
  });

  it('renders transaction entries with types and sources', () => {
    mockUC.mockReturnValue(ds({
      transactions: [
        { id: '1', type: 'topup', amount: 100, balanceAfter: 200, source: 'Via exchange', timestamp: Date.now() - 3600000 },
        { id: '2', type: 'fee', amount: -2.5, balanceAfter: 197.5, source: 'Trade HK', timestamp: Date.now() },
        { id: '3', type: 'p2p', amount: -50, balanceAfter: 147.5, source: 'To Alice', timestamp: Date.now(), fee: 0.15 },
      ],
    }));
    render(React.createElement(SettlementTimeline));
    expect(screen.getByText('Via exchange')).toBeDefined();
    expect(screen.getByText('Trade HK')).toBeDefined();
    expect(screen.getByText('To Alice')).toBeDefined();
  });

  it('has all five filter tabs rendered', () => {
    render(React.createElement(SettlementTimeline));
    expect(screen.getByText('All')).toBeDefined();
    expect(screen.getByText('Top-up')).toBeDefined();
    expect(screen.getByText('Trade Fee')).toBeDefined();
    expect(screen.getByText('P2P')).toBeDefined();
    expect(screen.getByText('Withdraw')).toBeDefined();
  });

  it('shows correct record count', () => {
    mockUC.mockReturnValue(ds({
      transactions: [
        { id: '1', type: 'topup', amount: 50, balanceAfter: 150, source: 'A', timestamp: Date.now() },
        { id: '2', type: 'fee', amount: -1, balanceAfter: 149, source: 'B', timestamp: Date.now() },
        { id: '3', type: 'topup', amount: 10, balanceAfter: 159, source: 'C', timestamp: Date.now() },
      ],
    }));
    render(React.createElement(SettlementTimeline));
    expect(screen.getByText('3 credits.records')).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════
// 3. CreditsDashboard (4 tests)
// ═══════════════════════════════════════════════════════════
import CreditsDashboard from '../../src/components/billing/CreditsDashboard';

describe('CreditsDashboard', () => {
  it('renders dashboard title and balance', () => {
    mockUC.mockReturnValue(ds({ balance: 250.123456, transactions: [] }));
    render(React.createElement(CreditsDashboard));
    const els = screen.getAllByText(/250\.123456/);
    expect(els.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('credits.dashboard')).toBeDefined();
  });

  it('shows four stat card labels', () => {
    render(React.createElement(CreditsDashboard));
    expect(screen.getByText('credits.todayIncome')).toBeDefined();
    expect(screen.getByText('credits.monthIncome')).toBeDefined();
    expect(screen.getByText('credits.cumulativeIncome')).toBeDefined();
    expect(screen.getByText('credits.totalFeesPaid')).toBeDefined();
  });

  it('renders fee split with three tiers', () => {
    render(React.createElement(CreditsDashboard));
    expect(screen.getByText('L1')).toBeDefined();
    expect(screen.getByText('L2')).toBeDefined();
    expect(screen.getByText('L3')).toBeDefined();
    expect(screen.getByText('credits.feeSplit')).toBeDefined();
  });

  it('renders daily earnings mini chart', () => {
    mockUC.mockReturnValue(ds({
      balance: 100,
      transactions: [
        { id: '1', type: 'income', amount: 10, balanceAfter: 110, source: 'Rev', timestamp: Date.now() - 86400000 * 2 },
      ],
    }));
    render(React.createElement(CreditsDashboard));
    expect(screen.getByText('credits.dailyEarnings')).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════
// 4. P2PTransferRecords (4 tests)
// ═══════════════════════════════════════════════════════════
import P2PTransferRecords from '../../src/components/billing/P2PTransferRecords';

describe('P2PTransferRecords', () => {
  it('shows empty state when no P2P transactions', () => {
    mockUC.mockReturnValue(ds({ transactions: [] }));
    render(React.createElement(P2PTransferRecords));
    expect(screen.getByText('credits.noP2P')).toBeDefined();
  });

  it('renders P2P parties (sent and received)', () => {
    mockUC.mockReturnValue(ds({
      transactions: [
        { id: 'p1', type: 'p2p', amount: -30, balanceAfter: 70, source: 'Alice', timestamp: Date.now() - 3600000, fee: 0.09 },
        { id: 'p2', type: 'p2p', amount: 50, balanceAfter: 120, source: 'Bob', timestamp: Date.now(), fee: 0.15 },
      ],
    }));
    render(React.createElement(P2PTransferRecords));
    expect(screen.getByText('Alice')).toBeDefined();
    expect(screen.getByText('Bob')).toBeDefined();
  });

  it('shows summary stats labels', () => {
    mockUC.mockReturnValue(ds({
      transactions: [
        { id: 'p1', type: 'p2p', amount: -100, balanceAfter: 900, source: 'To C', timestamp: Date.now(), fee: 0.30 },
      ],
    }));
    render(React.createElement(P2PTransferRecords));
    expect(screen.getByText('credits.sent')).toBeDefined();
    expect(screen.getByText('credits.received')).toBeDefined();
    expect(screen.getByText('credits.fees')).toBeDefined();
  });

  it('has three filter tabs: All, Sent, Received', () => {
    render(React.createElement(P2PTransferRecords));
    expect(screen.getByText('All')).toBeDefined();
    expect(screen.getByText('Sent')).toBeDefined();
    expect(screen.getByText('Received')).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════
// 5. PointsTopUpPage (4 tests)
// ═══════════════════════════════════════════════════════════
import PointsTopUpPage from '../../src/components/billing/PointsTopUpPage';

describe('PointsTopUpPage', () => {
  it('renders currency selector with all 6 options', () => {
    mockUC.mockReturnValue(ds({ balance: 100.0 }));
    render(React.createElement(PointsTopUpPage));
    expect(screen.getByText('HKD')).toBeDefined();
    expect(screen.getByText('CNY')).toBeDefined();
    expect(screen.getByText('USD')).toBeDefined();
    expect(screen.getByText('JPY')).toBeDefined();
    expect(screen.getByText('EUR')).toBeDefined();
    expect(screen.getByText('GBP')).toBeDefined();
  });

  it('renders amount input field', () => {
    mockUC.mockReturnValue(ds({ balance: 100.0 }));
    render(React.createElement(PointsTopUpPage));
    expect(screen.getByPlaceholderText('0.00')).toBeDefined();
  });

  it('renders preset amount buttons', () => {
    mockUC.mockReturnValue(ds({ balance: 100.0 }));
    render(React.createElement(PointsTopUpPage));
    // All 4 USD preset buttons exist
    expect(screen.getByText('10')).toBeDefined();
    expect(screen.getByText('50')).toBeDefined();
    expect(screen.getByText('100')).toBeDefined();
    expect(screen.getByText('500')).toBeDefined();
  });

  it('has settlement history toggle and CSV export button', () => {
    mockUC.mockReturnValue(ds({ balance: 100.0 }));
    render(React.createElement(PointsTopUpPage));
    expect(screen.getByText('CSV')).toBeDefined();
    expect(screen.getByText(/Expand/)).toBeDefined();
    expect(screen.getByText('credits.settlementHistory')).toBeDefined();
  });
});
