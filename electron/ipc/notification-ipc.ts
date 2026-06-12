// DAWN WHALES R120 — Unified Notification System
// 任务17: 异动通知 (AlertService → 系统通知) 
// 任务30: 下单券商确认 (下单按钮显示券商名)
// 任务32: 套利通知 (ArbitrageEngine → 系统提示)

import { ipcMain, Notification } from 'electron';

// ═══════ IPC: Desktop Notification ══════════════════════

let notificationPermissionGranted = false;

export function registerNotificationIPC(): void {
  // Request notification permission
  ipcMain.handle('notify:request-permission', async () => {
    notificationPermissionGranted = Notification.isSupported();
    return { granted: notificationPermissionGranted };
  });

  // Show price alert notification (task 17)
  ipcMain.handle('notify:alert', async (_event, alert: {
    symbol: string;
    price: number;
    condition: string;
    targetPrice: number;
    message: string;
  }) => {
    if (!notificationPermissionGranted) return { sent: false, reason: 'no-permission' };

    const notification = new Notification({
      title: `\u{1F514} ${alert.symbol} 价格预警`,
      body: alert.message || `${alert.symbol} ${alert.condition} ${alert.targetPrice} (当前: ${alert.price})`,
      urgency: 'critical',
    });

    notification.on('click', () => {
      // Focus the main window (handled by main process)
    });

    notification.show();
    return { sent: true };
  });

  // Show arbitrage notification (task 32)
  ipcMain.handle('notify:arbitrage', async (_event, arb: {
    symbol: string;
    buyBroker: string;
    sellBroker: string;
    buyPrice: number;
    sellPrice: number;
    spreadPct: number;
    estimatedProfit: number;
  }) => {
    if (!notificationPermissionGranted) return { sent: false, reason: 'no-permission' };

    const notification = new Notification({
      title: `\u{1F4B0} ${arb.symbol} 套利机会`,
      body: `${arb.buyBroker} → ${arb.sellBroker}: 价差${arb.spreadPct.toFixed(2)}%, 预估收益${arb.estimatedProfit.toFixed(2)} USDT`,
      urgency: 'critical',
    });

    notification.show();
    return { sent: true };
  });

  // Show order confirmation notification (task 30)
  ipcMain.handle('notify:order-confirm', async (_event, order: {
    brokerId: string;
    brokerName: string;
    symbol: string;
    market: string;
    side: string;
    quantity: number;
    price: number;
  }) => {
    if (!notificationPermissionGranted) return { sent: false, reason: 'no-permission' };

    const sideText = order.side === 'BUY' ? '买入' : '卖出';
    const notification = new Notification({
      title: `[${order.brokerName}] ${sideText} ${order.symbol}`,
      body: `确认 ${sideText} ${order.quantity}股 @ ${order.price} | ${order.market}`,
    });

    notification.show();
    return { sent: true };
  });
}

// ═══════ Renderer-side helper (for use in React components) ══════════

// Usage via preload bridge:
//
// import { useNotification } from '@/hooks/useNotification';
// const { showAlert, showArbitrage, showOrderConfirm } = useNotification();
//
// showAlert({ symbol: 'AAPL', price: 150, condition: '>', targetPrice: 155, message: '...' });
// showArbitrage({ symbol: 'BTC-USDT', buyBroker: 'Binance', sellBroker: 'OKX', buyPrice: 68000, sellPrice: 68400, spreadPct: 0.59, estimatedProfit: 12.5 });
// showOrderConfirm({ brokerId: 'futu', brokerName: '富途', symbol: 'AAPL', market: 'US', side: 'BUY', quantity: 100, price: 150.50 });
