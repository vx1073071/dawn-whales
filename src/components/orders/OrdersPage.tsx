import React from 'react';

export default function OrdersPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-white mb-1">委托订单</h1>
      <p className="text-gray-400 text-sm mb-6">当前委托和历史成交记录</p>

      {/* Tabs */}
      <div className="flex gap-4 mb-4 text-sm border-b border-border">
        <button className="pb-2 text-primary border-b-2 border-primary">当前委托</button>
        <button className="pb-2 text-gray-400 hover:text-gray-200">历史委托</button>
        <button className="pb-2 text-gray-400 hover:text-gray-200">成交记录</button>
      </div>

      <div className="bg-surface-2 border border-border rounded-xl p-8 text-center">
        <div className="text-3xl mb-2 opacity-40">📋</div>
        <p className="text-gray-400 text-sm">暂无委托</p>
        <p className="text-gray-500 text-xs mt-1">策略运行后这里会显示实时订单</p>
      </div>
    </div>
  );
}
