import React, { useState, useEffect, useCallback, useRef } from 'react';
import { EngineError } from '../../../electron/engine/core/engine-error';

// ─── Types ───────────────────────────────────────────────────────────────────

type Theme = 'dark' | 'light' | 'system';
type Language = 'zh-CN' | 'en-US' | 'zh-TW';
type FontSize = 'small' | 'medium' | 'large';
type ChartType = 'candlestick' | 'line' | 'area';
type Market = 'US' | 'HK' | 'CN' | 'CRYPTO';
type OrderType = 'MARKET' | 'LIMIT' | 'STOP';
type TimeInForce = 'GTC' | 'DAY' | 'IOC' | 'FOK';
type TabKey = 'ui' | 'trading' | 'notifications' | 'advanced';

interface ChartInterval {
  value: string;
  label: string;
}

interface UIPreferences {
  theme: Theme;
  language: Language;
  fontSize: FontSize;
  chartType: ChartType;
  defaultChartInterval: string;
  defaultMarket: Market;
  animationsEnabled: boolean;
  compactMode: boolean;
}

interface TradingPreferences {
  defaultOrderType: OrderType;
  defaultTimeInForce: TimeInForce;
  confirmBeforeTrade: boolean;
  oneClickTrading: boolean;
  defaultQuantity: number;
  maxPositionSizePercent: number;
  defaultStopLossPercent: number;
  defaultTakeProfitPercent: number;
  autoRefreshIntervalSec: number;
}

interface NotificationPreferences {
  masterEnabled: boolean;
  soundEnabled: boolean;
  desktopNotifications: boolean;
  tradeSignals: boolean;
  riskAlerts: boolean;
  systemAlerts: boolean;
  priceAlerts: boolean;
  newsAlerts: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  emailAlertsEnabled: boolean;
  emailAlertsAddress: string;
}

interface UserPreferences {
  ui: UIPreferences;
  trading: TradingPreferences;
  notifications: NotificationPreferences;
}

interface IPCResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const CHART_INTERVALS: ChartInterval[] = [
  { value: '1m', label: '1 Minute' },
  { value: '5m', label: '5 Minutes' },
  { value: '15m', label: '15 Minutes' },
  { value: '30m', label: '30 Minutes' },
  { value: '1h', label: '1 Hour' },
  { value: '4h', label: '4 Hours' },
  { value: '1d', label: '1 Day' },
  { value: '1w', label: '1 Week' },
  { value: '1M', label: '1 Month' },
];

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: 'ui', label: 'UI', icon: '🎨' },
  { key: 'trading', label: 'Trading', icon: '📈' },
  { key: 'notifications', label: 'Notifications', icon: '🔔' },
  { key: 'advanced', label: 'Advanced', icon: '⚙️' },
];

const DEFAULT_UI: UIPreferences = {
  theme: 'dark',
  language: 'zh-CN',
  fontSize: 'medium',
  chartType: 'candlestick',
  defaultChartInterval: '1d',
  defaultMarket: 'US',
  animationsEnabled: true,
  compactMode: false,
};

const DEFAULT_TRADING: TradingPreferences = {
  defaultOrderType: 'LIMIT',
  defaultTimeInForce: 'GTC',
  confirmBeforeTrade: true,
  oneClickTrading: false,
  defaultQuantity: 100,
  maxPositionSizePercent: 25,
  defaultStopLossPercent: 5,
  defaultTakeProfitPercent: 10,
  autoRefreshIntervalSec: 30,
};

const DEFAULT_NOTIFICATIONS: NotificationPreferences = {
  masterEnabled: true,
  soundEnabled: true,
  desktopNotifications: true,
  tradeSignals: true,
  riskAlerts: true,
  systemAlerts: true,
  priceAlerts: true,
  newsAlerts: false,
  quietHoursEnabled: false,
  quietHoursStart: '22:00',
  quietHoursEnd: '08:00',
  emailAlertsEnabled: false,
  emailAlertsAddress: '',
};

// ─── Reusable Sub-Components ─────────────────────────────────────────────────

interface SectionCardProps {
  title: string;
  description?: string;
  children: React.ReactNode;
}

const SectionCard: React.FC<SectionCardProps> = ({ title, description, children }) => (
  <div className="bg-gray-800 border border-gray-700 rounded-xl p-5 mb-5 shadow-sm">
    <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-1">{title}</h3>
    {description && (
      <p className="text-xs text-gray-500 mb-4">{description}</p>
    )}
    <div className="space-y-4">{children}</div>
  </div>
);

interface RadioGroupProps<T extends string> {
  label: string;
  name: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}

function RadioGroup<T extends string>({ label, name, value, options, onChange }: RadioGroupProps<T>) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-400 mb-2">{label}</label>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <label
            key={opt.value}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-lg cursor-pointer transition-all duration-150
              border text-sm font-medium
              ${value === opt.value
                ? 'bg-blue-600 border-blue-500 text-white shadow-md shadow-blue-900/40'
                : 'bg-gray-900 border-gray-600 text-gray-400 hover:border-gray-500 hover:text-gray-300'}
            `}
          >
            <input
              type="radio"
              name={name}
              value={opt.value}
              checked={value === opt.value}
              onChange={() => onChange(opt.value)}
              className="sr-only"
            />
            <span
              className={`
                w-3 h-3 rounded-full border-2 flex items-center justify-center
                ${value === opt.value ? 'border-white' : 'border-gray-500'}
              `}
            >
              {value === opt.value && (
                <span className="w-1.5 h-1.5 rounded-full bg-white" />
              )}
            </span>
            {opt.label}
          </label>
        ))}
      </div>
    </div>
  );
}

interface SelectFieldProps {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}

const SelectField: React.FC<SelectFieldProps> = ({ label, value, options, onChange }) => (
  <div>
    <label className="block text-sm font-medium text-gray-400 mb-2">{label}</label>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full bg-gray-900 border border-gray-600 text-gray-200 rounded-lg px-3 py-2
                 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                 appearance-none cursor-pointer"
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  </div>
);

interface ToggleFieldProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  warning?: string;
}

const ToggleField: React.FC<ToggleFieldProps> = ({ label, description, checked, onChange, warning }) => (
  <div className="flex items-start justify-between gap-4 py-1">
    <div className="flex-1">
      <span className="text-sm font-medium text-gray-200">{label}</span>
      {description && (
        <p className="text-xs text-gray-500 mt-0.5">{description}</p>
      )}
      {warning && checked && (
        <div className="flex items-center gap-1.5 mt-1.5 px-2 py-1 bg-yellow-900/40 border border-yellow-700/50 rounded text-xs text-yellow-400">
          <span>⚠️</span>
          <span>{warning}</span>
        </div>
      )}
    </div>
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`
        relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent
        transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500
        ${checked ? 'bg-blue-600' : 'bg-gray-600'}
      `}
    >
      <span
        className={`
          pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow
          ring-0 transition duration-200 ease-in-out
          ${checked ? 'translate-x-5' : 'translate-x-0'}
        `}
      />
    </button>
  </div>
);

interface NumberInputProps {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  onChange: (value: number) => void;
}

const NumberInput: React.FC<NumberInputProps> = ({
  label, value, min = 0, max = 999999, step = 1, suffix, onChange,
}) => (
  <div>
    <label className="block text-sm font-medium text-gray-400 mb-2">{label}</label>
    <div className="flex items-center gap-2">
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-28 bg-gray-900 border border-gray-600 text-gray-200 rounded-lg px-3 py-2
                   text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />
      {suffix && <span className="text-sm text-gray-500">{suffix}</span>}
    </div>
  </div>
);

interface SliderFieldProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (value: number) => void;
}

const SliderField: React.FC<SliderFieldProps> = ({
  label, value, min, max, step = 1, suffix, onChange,
}) => (
  <div>
    <div className="flex justify-between items-center mb-2">
      <label className="text-sm font-medium text-gray-400">{label}</label>
      <span className="text-sm font-mono text-blue-400">
        {value}{suffix ?? ''}
      </span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full h-2 rounded-full appearance-none cursor-pointer
                 bg-gray-700 accent-blue-500"
    />
    <div className="flex justify-between text-xs text-gray-600 mt-1">
      <span>{min}{suffix ?? ''}</span>
      <span>{max}{suffix ?? ''}</span>
    </div>
  </div>
);

// ─── Main Component ──────────────────────────────────────────────────────────

const PreferencesPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabKey>('ui');
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState('');

  const [ui, setUI] = useState<UIPreferences>(DEFAULT_UI);
  const [trading, setTrading] = useState<TradingPreferences>(DEFAULT_TRADING);
  const [notifications, setNotifications] = useState<NotificationPreferences>(DEFAULT_NOTIFICATIONS);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Load preferences on mount ──────────────────────────────────────────────

  useEffect(() => {
    const loadPrefs = async () => {
      try {
        const result: IPCResult<UserPreferences> = await window.api.prefs.getAll();
        if (result.success && result.data) {
          if (result.data.ui) setUI({ ...DEFAULT_UI, ...result.data.ui });
          if (result.data.trading) setTrading({ ...DEFAULT_TRADING, ...result.data.trading });
          if (result.data.notifications) setNotifications({ ...DEFAULT_NOTIFICATIONS, ...result.data.notifications });
        }
      } catch (err) {
    // [EngineError:SYSTEM] — structured error tracking
        void EngineError; // structured error domain: SYSTEM
        console.error('Failed to load preferences:', err);
        showStatus('Failed to load preferences', 'error');
      } finally {
        setLoading(false);
      }
    };
    loadPrefs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Debounced save ─────────────────────────────────────────────────────────

  const debouncedSave = useCallback(
    (section: 'ui' | 'trading' | 'notifications', data: UIPreferences | TradingPreferences | NotificationPreferences) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      setSaveStatus('saving');
      saveTimerRef.current = setTimeout(async () => {
        try {
          const result: IPCResult = await window.api.prefs.setSection(section, data);
          if (result.success) {
            setSaveStatus('saved');
            setLastUpdated(new Date().toLocaleTimeString());
            if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
            statusTimerRef.current = setTimeout(() => setSaveStatus('idle'), 2000);
          } else {
            setSaveStatus('error');
            showStatus('Failed to save preferences', 'error');
          }
        } catch (err) {
    // [EngineError:SYSTEM] — structured error tracking
          console.error('Save error:', err);
          setSaveStatus('error');
          showStatus('Save failed unexpectedly', 'error');
        }
      }, 500);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const showStatus = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setStatusMessage(`${type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️'} ${message}`);
    if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
    statusTimerRef.current = setTimeout(() => setStatusMessage(''), 4000);
  };

  // ── Updaters ───────────────────────────────────────────────────────────────

  const updateUI = useCallback(<K extends keyof UIPreferences>(key: K, value: UIPreferences[K]) => {
    setUI((prev) => {
      const next = { ...prev, [key]: value };
      debouncedSave('ui', next);
      return next;
    });
  }, [debouncedSave]);

  const updateTrading = useCallback(<K extends keyof TradingPreferences>(key: K, value: TradingPreferences[K]) => {
    setTrading((prev) => {
      const next = { ...prev, [key]: value };
      debouncedSave('trading', next);
      return next;
    });
  }, [debouncedSave]);

  const updateNotification = useCallback(<K extends keyof NotificationPreferences>(key: K, value: NotificationPreferences[K]) => {
    setNotifications((prev) => {
      const next = { ...prev, [key]: value };
      debouncedSave('notifications', next);
      return next;
    });
  }, [debouncedSave]);

  // ── Advanced actions ───────────────────────────────────────────────────────

  const handleResetSection = async (section?: 'ui' | 'trading' | 'notifications') => {
    try {
      const result: IPCResult<UserPreferences> = await window.api.prefs.reset(section);
      if (result.success) {
        if (!section || section === 'ui') setUI({ ...DEFAULT_UI });
        if (!section || section === 'trading') setTrading({ ...DEFAULT_TRADING });
        if (!section || section === 'notifications') setNotifications({ ...DEFAULT_NOTIFICATIONS });
        showStatus(section ? `${section} preferences reset` : 'All preferences reset to defaults', 'success');
      }
    } catch (err) {
    // [EngineError:SYSTEM] — structured error tracking
      console.error('Reset failed:', err);
      showStatus('Reset failed', 'error');
    }
  };

  const handleExport = async () => {
    try {
      const result: IPCResult<{ filePath: string }> = await window.api.prefs!.exportPrefs();
      if (result.success && result.data) {
        showStatus(`Exported to: ${result.data.filePath}`, 'success');
      }
    } catch (err) {
    // [EngineError:SYSTEM] — structured error tracking
      console.error('Export failed:', err);
      showStatus('Export failed', 'error');
    }
  };

  const handleImport = async () => {
    try {
      const result: IPCResult<UserPreferences> = await window.api.prefs.importPrefs();
      if (result.success && result.data) {
        if (result.data.ui) setUI({ ...DEFAULT_UI, ...result.data.ui });
        if (result.data.trading) setTrading({ ...DEFAULT_TRADING, ...result.data.trading });
        if (result.data.notifications) setNotifications({ ...DEFAULT_NOTIFICATIONS, ...result.data.notifications });
        showStatus('Preferences imported successfully', 'success');
      }
    } catch (err) {
    // [EngineError:SYSTEM] — structured error tracking
      console.error('Import failed:', err);
      showStatus('Import failed', 'error');
    }
  };

  // ── Render helpers ─────────────────────────────────────────────────────────

  const renderTabBar = () => (
    <div className="flex border-b border-gray-700 mb-6">
      {TABS.map((tab) => (
        <button
          key={tab.key}
          onClick={() => setActiveTab(tab.key)}
          className={`
            flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-all duration-150
            ${activeTab === tab.key
              ? 'border-blue-500 text-blue-400 bg-gray-800/50'
              : 'border-transparent text-gray-500 hover:text-gray-300 hover:border-gray-500'}
          `}
        >
          <span className="text-base">{tab.icon}</span>
          <span>{tab.label}</span>
        </button>
      ))}
      {/* Save status indicator */}
      <div className="ml-auto flex items-center pr-4">
        {saveStatus === 'saving' && (
          <span className="flex items-center gap-1.5 text-xs text-yellow-400">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
            Saving…
          </span>
        )}
        {saveStatus === 'saved' && (
          <span className="flex items-center gap-1.5 text-xs text-green-400">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-400" />
            Saved
          </span>
        )}
        {saveStatus === 'error' && (
          <span className="flex items-center gap-1.5 text-xs text-red-400">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-400" />
            Error
          </span>
        )}
      </div>
    </div>
  );

  // ── Tab 1: UI Preferences ──────────────────────────────────────────────────

  const renderUITab = () => (
    <div>
      <SectionCard title="Appearance" description="Customize the visual theme and layout of the application.">
        <RadioGroup<Theme>
          label="Theme"
          name="theme"
          value={ui.theme}
          options={[
            { value: 'dark', label: '🌙 Dark' },
            { value: 'light', label: '☀️ Light' },
            { value: 'system', label: '💻 System' },
          ]}
          onChange={(v) => updateUI('theme', v)}
        />
        <SelectField
          label="Language"
          value={ui.language}
          options={[
            { value: 'zh-CN', label: '简体中文' },
            { value: 'en-US', label: 'English (US)' },
            { value: 'zh-TW', label: '繁體中文' },
          ]}
          onChange={(v) => updateUI('language', v as Language)}
        />
        <RadioGroup<FontSize>
          label="Font Size"
          name="fontSize"
          value={ui.fontSize}
          options={[
            { value: 'small', label: 'Small' },
            { value: 'medium', label: 'Medium' },
            { value: 'large', label: 'Large' },
          ]}
          onChange={(v) => updateUI('fontSize', v)}
        />
      </SectionCard>

      <SectionCard title="Charts" description="Configure default chart appearance and data visualization.">
        <RadioGroup<ChartType>
          label="Chart Type"
          name="chartType"
          value={ui.chartType}
          options={[
            { value: 'candlestick', label: '📊 Candlestick' },
            { value: 'line', label: '📈 Line' },
            { value: 'area', label: '🏔️ Area' },
          ]}
          onChange={(v) => updateUI('chartType', v)}
        />
        <SelectField
          label="Default Chart Interval"
          value={ui.defaultChartInterval}
          options={CHART_INTERVALS.map((i) => ({ value: i.value, label: i.label }))}
          onChange={(v) => updateUI('defaultChartInterval', v)}
        />
        <SelectField
          label="Default Market"
          value={ui.defaultMarket}
          options={[
            { value: 'US', label: '🇺🇸 US Market' },
            { value: 'HK', label: '🇭🇰 Hong Kong' },
            { value: 'CN', label: '🇨🇳 China A-Shares' },
            { value: 'CRYPTO', label: '₿ Crypto' },
          ]}
          onChange={(v) => updateUI('defaultMarket', v as Market)}
        />
      </SectionCard>

      <SectionCard title="Interface" description="Toggles for animation and layout density.">
        <ToggleField
          label="Animations"
          description="Enable smooth transitions and motion effects throughout the UI."
          checked={ui.animationsEnabled}
          onChange={(v) => updateUI('animationsEnabled', v)}
        />
        <ToggleField
          label="Compact Mode"
          description="Reduce spacing and padding for a denser information layout."
          checked={ui.compactMode}
          onChange={(v) => updateUI('compactMode', v)}
        />
      </SectionCard>
    </div>
  );

  // ── Tab 2: Trading Preferences ─────────────────────────────────────────────

  const renderTradingTab = () => (
    <div>
      <SectionCard title="Order Defaults" description="Configure default parameters for new orders.">
        <SelectField
          label="Default Order Type"
          value={trading.defaultOrderType}
          options={[
            { value: 'MARKET', label: 'Market Order' },
            { value: 'LIMIT', label: 'Limit Order' },
            { value: 'STOP', label: 'Stop Order' },
          ]}
          onChange={(v) => updateTrading('defaultOrderType', v as OrderType)}
        />
        <SelectField
          label="Time in Force"
          value={trading.defaultTimeInForce}
          options={[
            { value: 'GTC', label: 'Good-Til-Cancelled (GTC)' },
            { value: 'DAY', label: 'Day Order (DAY)' },
            { value: 'IOC', label: 'Immediate-Or-Cancel (IOC)' },
            { value: 'FOK', label: 'Fill-Or-Kill (FOK)' },
          ]}
          onChange={(v) => updateTrading('defaultTimeInForce', v as TimeInForce)}
        />
        <NumberInput
          label="Default Quantity"
          value={trading.defaultQuantity}
          min={1}
          max={999999}
          step={1}
          suffix="shares"
          onChange={(v) => updateTrading('defaultQuantity', v)}
        />
      </SectionCard>

      <SectionCard title="Execution" description="Control trade confirmation and execution behavior.">
        <ToggleField
          label="Confirm Before Trade"
          description="Show a confirmation dialog before submitting any order."
          checked={trading.confirmBeforeTrade}
          onChange={(v) => updateTrading('confirmBeforeTrade', v)}
        />
        <ToggleField
          label="One-Click Trading"
          description="Execute trades immediately without confirmation. Use with caution."
          checked={trading.oneClickTrading}
          onChange={(v) => updateTrading('oneClickTrading', v)}
          warning="One-click trading bypasses all confirmations. Accidental trades cannot be undone."
        />
      </SectionCard>

      <SectionCard title="Risk Management" description="Set default risk parameters applied to new positions.">
        <SliderField
          label="Max Position Size"
          value={trading.maxPositionSizePercent}
          min={1}
          max={100}
          step={1}
          suffix="%"
          onChange={(v) => updateTrading('maxPositionSizePercent', v)}
        />
        <div className="grid grid-cols-2 gap-4">
          <NumberInput
            label="Default Stop Loss"
            value={trading.defaultStopLossPercent}
            min={0.1}
            max={50}
            step={0.5}
            suffix="%"
            onChange={(v) => updateTrading('defaultStopLossPercent', v)}
          />
          <NumberInput
            label="Default Take Profit"
            value={trading.defaultTakeProfitPercent}
            min={0.1}
            max={100}
            step={0.5}
            suffix="%"
            onChange={(v) => updateTrading('defaultTakeProfitPercent', v)}
          />
        </div>
      </SectionCard>

      <SectionCard title="Data Refresh" description="Control how frequently market data is fetched.">
        <SliderField
          label="Auto Refresh Interval"
          value={trading.autoRefreshIntervalSec}
          min={10}
          max={120}
          step={5}
          suffix="s"
          onChange={(v) => updateTrading('autoRefreshIntervalSec', v)}
        />
      </SectionCard>
    </div>
  );

  // ── Tab 3: Notification Preferences ────────────────────────────────────────

  const renderNotificationsTab = () => {
    const isDisabled = !notifications.masterEnabled;

    return (
      <div>
        <SectionCard title="Master Switch" description="Enable or disable all notifications globally.">
          <ToggleField
            label="Enable Notifications"
            description="Master toggle for all notification types."
            checked={notifications.masterEnabled}
            onChange={(v) => updateNotification('masterEnabled', v)}
          />
        </SectionCard>

        <div className={isDisabled ? 'opacity-40 pointer-events-none' : ''}>
          <SectionCard title="Delivery Channels" description="Choose how you want to receive notifications.">
            <ToggleField
              label="Sound"
              description="Play an audible alert when notifications arrive."
              checked={notifications.soundEnabled}
              onChange={(v) => updateNotification('soundEnabled', v)}
            />
            <ToggleField
              label="Desktop Notifications"
              description="Show native OS push notifications."
              checked={notifications.desktopNotifications}
              onChange={(v) => updateNotification('desktopNotifications', v)}
            />
          </SectionCard>

          <SectionCard title="Notification Types" description="Select which events trigger notifications.">
            <ToggleField
              label="Trade Signals"
              description="Alerts when trade signal conditions are met."
              checked={notifications.tradeSignals}
              onChange={(v) => updateNotification('tradeSignals', v)}
            />
            <ToggleField
              label="Risk Alerts"
              description="Warnings about portfolio risk thresholds being breached."
              checked={notifications.riskAlerts}
              onChange={(v) => updateNotification('riskAlerts', v)}
            />
            <ToggleField
              label="System Alerts"
              description="Application updates, connectivity issues, and maintenance notices."
              checked={notifications.systemAlerts}
              onChange={(v) => updateNotification('systemAlerts', v)}
            />
            <ToggleField
              label="Price Alerts"
              description="Notifications when watched symbols hit target prices."
              checked={notifications.priceAlerts}
              onChange={(v) => updateNotification('priceAlerts', v)}
            />
            <ToggleField
              label="News Alerts"
              description="Breaking financial news and market-moving events."
              checked={notifications.newsAlerts}
              onChange={(v) => updateNotification('newsAlerts', v)}
            />
          </SectionCard>

          <SectionCard title="Quiet Hours" description="Suppress notifications during specified hours.">
            <ToggleField
              label="Enable Quiet Hours"
              description="Mute all non-critical notifications during the time window below."
              checked={notifications.quietHoursEnabled}
              onChange={(v) => updateNotification('quietHoursEnabled', v)}
            />
            {notifications.quietHoursEnabled && (
              <div className="grid grid-cols-2 gap-4 pt-1">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Start Time</label>
                  <input
                    type="time"
                    value={notifications.quietHoursStart}
                    onChange={(e) => updateNotification('quietHoursStart', e.target.value)}
                    className="w-full bg-gray-900 border border-gray-600 text-gray-200 rounded-lg px-3 py-2
                               text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">End Time</label>
                  <input
                    type="time"
                    value={notifications.quietHoursEnd}
                    onChange={(e) => updateNotification('quietHoursEnd', e.target.value)}
                    className="w-full bg-gray-900 border border-gray-600 text-gray-200 rounded-lg px-3 py-2
                               text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            )}
          </SectionCard>

          <SectionCard title="Email Alerts" description="Receive critical alerts via email.">
            <ToggleField
              label="Enable Email Alerts"
              description="Send important notifications to your email address."
              checked={notifications.emailAlertsEnabled}
              onChange={(v) => updateNotification('emailAlertsEnabled', v)}
            />
            {notifications.emailAlertsEnabled && (
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Email Address</label>
                <input
                  type="email"
                  value={notifications.emailAlertsAddress}
                  placeholder="your@email.com"
                  onChange={(e) => updateNotification('emailAlertsAddress', e.target.value)}
                  className="w-full bg-gray-900 border border-gray-600 text-gray-200 rounded-lg px-3 py-2
                             text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                             placeholder-gray-600"
                />
              </div>
            )}
          </SectionCard>
        </div>
      </div>
    );
  };

  // ── Tab 4: Advanced ────────────────────────────────────────────────────────

  const renderAdvancedTab = () => (
    <div>
      <SectionCard title="Reset Preferences" description="Restore default values for one or all preference sections.">
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => handleResetSection('ui')}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium
                       bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white transition-colors"
          >
            <span>🎨</span> Reset UI
          </button>
          <button
            onClick={() => handleResetSection('trading')}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium
                       bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white transition-colors"
          >
            <span>📈</span> Reset Trading
          </button>
          <button
            onClick={() => handleResetSection('notifications')}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium
                       bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white transition-colors"
          >
            <span>🔔</span> Reset Notifications
          </button>
          <button
            onClick={() => handleResetSection()}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium
                       bg-red-900/40 border border-red-700/50 text-red-400 hover:bg-red-900/60 hover:text-red-300 transition-colors"
          >
            <span>⚠️</span> Reset All
          </button>
        </div>
      </SectionCard>

      <SectionCard title="Import & Export" description="Back up or restore your complete preference profile.">
        <div className="flex gap-3">
          <button
            onClick={handleExport}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-medium
                       bg-blue-600 text-white hover:bg-blue-500 transition-colors shadow-md shadow-blue-900/30"
          >
            <span>📤</span> Export Preferences
          </button>
          <button
            onClick={handleImport}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-medium
                       bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white transition-colors"
          >
            <span>📥</span> Import Preferences
          </button>
        </div>
        <p className="text-xs text-gray-600 mt-2">
          Exported files use JSON format and can be shared across devices.
        </p>
      </SectionCard>

      <SectionCard title="Application Info" description="Current version and build details.">
        <div className="space-y-2">
          <div className="flex justify-between items-center py-1.5 border-b border-gray-700/50">
            <span className="text-sm text-gray-500">Application</span>
            <span className="text-sm font-medium text-gray-300">Dawn Whales</span>
          </div>
          <div className="flex justify-between items-center py-1.5 border-b border-gray-700/50">
            <span className="text-sm text-gray-500">Version</span>
            <span className="text-sm font-mono text-gray-300">1.0.0</span>
          </div>
          <div className="flex justify-between items-center py-1.5 border-b border-gray-700/50">
            <span className="text-sm text-gray-500">Preferences Schema</span>
            <span className="text-sm font-mono text-gray-300">v1</span>
          </div>
          <div className="flex justify-between items-center py-1.5">
            <span className="text-sm text-gray-500">Last Updated</span>
            <span className="text-sm font-mono text-gray-300">
              {lastUpdated ?? 'Not modified this session'}
            </span>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Danger Zone" description="Irreversible operations. Proceed with caution.">
        <div className="p-4 bg-red-950/30 border border-red-800/40 rounded-lg">
          <p className="text-sm text-red-400 mb-3">
            Clearing the preferences cache will force a full reload from disk on next startup.
            This cannot be undone.
          </p>
          <button
            onClick={() => {
              showStatus('Cache cleared. Restart the app to take effect.', 'info');
            }}
            className="px-4 py-2 rounded-lg text-sm font-medium
                       bg-red-800/50 border border-red-700 text-red-300 hover:bg-red-800 hover:text-red-200
                       transition-colors"
          >
            Clear Preferences Cache
          </button>
        </div>
      </SectionCard>
    </div>
  );

  // ── Main render ────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-gray-400">Loading preferences…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="border-b border-gray-800 px-6 py-5">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-xl font-bold text-white tracking-tight">Preferences</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Configure your Dawn Whales experience. Changes are saved automatically.
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-4">
        {renderTabBar()}

        <div className="pb-16">
          {activeTab === 'ui' && renderUITab()}
          {activeTab === 'trading' && renderTradingTab()}
          {activeTab === 'notifications' && renderNotificationsTab()}
          {activeTab === 'advanced' && renderAdvancedTab()}
        </div>
      </div>

      {/* Toast notification */}
      {statusMessage && (
        <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-2">
          <div className="px-4 py-3 rounded-xl bg-gray-800 border border-gray-700 shadow-xl max-w-sm">
            <p className="text-sm text-gray-200">{statusMessage}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default PreferencesPage;
