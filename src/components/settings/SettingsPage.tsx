import React, { useState } from 'react';

export default function SettingsPage() {
  const [host, setHost] = useState('127.0.0.1');
  const [port, setPort] = useState('11111');
  const [connected, setConnected] = useState(false);

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-1">系统设置</h1>
      <p className="text-gray-400 text-sm mb-6">券商连接、风控参数、通知偏好</p>

      {/* Broker connection */}
      <div className="bg-surface-2 border border-border rounded-xl p-6 mb-4">
        <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
          🔌 券商连接
        </h2>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-400 text-xs mb-1">券商</label>
              <select className="w-full bg-surface-1 border border-border rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-primary/50">
                <option>富途 Futu</option>
                <option>moomoo</option>
                <option>长桥 Longbridge (即将)</option>
                <option>盈透 IB (即将)</option>
              </select>
            </div>
            <div>
              <label className="block text-gray-400 text-xs mb-1">交易环境</label>
              <select className="w-full bg-surface-1 border border-border rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-primary/50">
                <option>模拟盘 SIMULATE</option>
                <option>实盘 REAL</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <label className="block text-gray-400 text-xs mb-1">OpenD 地址</label>
              <input
                value={host}
                onChange={(e) => setHost(e.target.value)}
                className="w-full bg-surface-1 border border-border rounded-lg px-3 py-2 text-sm text-gray-200 font-mono focus:outline-none focus:border-primary/50"
              />
            </div>
            <div>
              <label className="block text-gray-400 text-xs mb-1">端口</label>
              <input
                value={port}
                onChange={(e) => setPort(e.target.value)}
                className="w-full bg-surface-1 border border-border rounded-lg px-3 py-2 text-sm text-gray-200 font-mono focus:outline-none focus:border-primary/50"
              />
            </div>
          </div>
          <div className="flex gap-3 items-center">
            <button
              onClick={() => setConnected(!connected)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                connected
                  ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                  : 'bg-primary text-black hover:bg-primary-bright'
              }`}
            >
              {connected ? '断开连接' : '连接 OpenD'}
            </button>
            {connected && (
              <span className="text-green-400 text-xs flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                已连接 (12ms)
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Risk defaults */}
      <div className="bg-surface-2 border border-border rounded-xl p-6 mb-4">
        <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
          🛡️ 全局风控默认值
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <RiskSlider label="单日最大亏损" defaultValue={5} unit="%" />
          <RiskSlider label="单品种最大仓位" defaultValue={20} unit="%" />
          <RiskSlider label="总持仓上限" defaultValue={95} unit="%" />
          <RiskSlider label="策略最大回撤" defaultValue={10} unit="%" />
        </div>
      </div>

      {/* Notifications */}
      <div className="bg-surface-2 border border-border rounded-xl p-6">
        <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
          🔔 通知设置
        </h2>
        <div className="space-y-3">
          <Toggle label="桌面通知" defaultOn />
          <Toggle label="声音提示" />
          <Toggle label="交易提醒" defaultOn />
          <Toggle label="每日报告" defaultOn />
        </div>
      </div>
    </div>
  );
}

function RiskSlider({ label, defaultValue, unit }: { label: string; defaultValue: number; unit: string }) {
  const [val, setVal] = useState(defaultValue);
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-400">{label}</span>
        <span className="text-gray-200 font-mono">{val}{unit}</span>
      </div>
      <input
        type="range"
        min={1}
        max={100}
        value={val}
        onChange={(e) => setVal(Number(e.target.value))}
        className="w-full h-1.5 bg-surface-1 rounded-lg appearance-none cursor-pointer accent-primary"
      />
    </div>
  );
}

function Toggle({ label, defaultOn = false }: { label: string; defaultOn?: boolean }) {
  const [on, setOn] = useState(defaultOn);
  return (
    <div className="flex items-center justify-between">
      <span className="text-gray-300 text-sm">{label}</span>
      <button
        onClick={() => setOn(!on)}
        className={`w-10 h-5 rounded-full transition-colors relative ${on ? 'bg-primary' : 'bg-surface-1'}`}
      >
        <span
          className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
            on ? 'left-5' : 'left-0.5'
          }`}
        />
      </button>
    </div>
  );
}
