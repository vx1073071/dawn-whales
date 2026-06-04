import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import TradeExecutionPanel from './TradeExecutionPanel';
import OrderBookPanel from './OrderBookPanel';
import PnLPanel from './PnLPanel';
import PositionMonitor from './PositionMonitor';
import QuickOrderPanel from './QuickOrderPanel';
import TradeAlertPanel from './TradeAlertPanel';
import { getQuotes } from '@/lib/bridge-api';

export default function TradingDesk() {
  const { t } = useTranslation();
  const [selectedSymbol, setSelectedSymbol] = useState<string>('');
  const [symbolPrice, setSymbolPrice] = useState<number>(0);

  // When symbol changes in TradeExecutionPanel, update related panels
  useEffect(() => {
    if (!selectedSymbol) return;
    loadPrice();
    const interval = setInterval(loadPrice, 5000);
    return () => clearInterval(interval);
  }, [selectedSymbol]);

  async function loadPrice() {
    if (!selectedSymbol) return;
    try {
      const quotes = await getQuotes([selectedSymbol]);
      if (quotes && quotes.length > 0) {
        setSymbolPrice(quotes[0].price || 0);
      }
    } catch (e) { console.error('[Error:TradingDesk]', e); }
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-3 border-b border-white/5 flex items-center justify-between bg-[#12121a]">
        <div>
          <h1 className="text-lg font-bold text-white">{t('trading.tradingDesk')}</h1>
          <p className="text-xs text-gray-500">{t('trading.tradingDeskSubtitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500">{t('trading.selectedSymbol')}: {selectedSymbol || '--'}</span>
          {symbolPrice > 0 && (
            <span className="text-sm font-mono text-white">${symbolPrice.toFixed(2)}</span>
          )}
        </div>
      </div>

      {/* Main Layout: 3 columns */}
      <div className="flex-1 overflow-auto p-4">
        <div className="grid grid-cols-12 gap-4 h-full">
          {/* Left Column: Order Book + Quick Order + Alerts (3 cols) */}
          <div className="col-span-3 space-y-4">
            <OrderBookPanel symbol={selectedSymbol} />
            <QuickOrderPanel symbol={selectedSymbol} price={symbolPrice} />
            <TradeAlertPanel />
          </div>

          {/* Center Column: Trade Execution (6 cols) */}
          <div className="col-span-6">
            <TradeExecutionPanel
              onSymbolChange={(symbol: string) => setSelectedSymbol(symbol)}
            />
          </div>

          {/* Right Column: PnL + Positions (3 cols) */}
          <div className="col-span-3 space-y-4">
            <PnLPanel />
            <PositionMonitor />
          </div>
        </div>
      </div>
    </div>
  );
}
