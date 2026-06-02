import React from 'react';

export default function PortfolioPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-white mb-1">持仓管理</h1>
      <p className="text-gray-400 text-sm mb-6">查看账户、持仓、盈亏</p>
      <div className="bg-surface-2 border border-border rounded-xl p-8 text-center">
        <div className="text-3xl mb-2 opacity-40">💼</div>
        <p className="text-gray-400 text-sm">请先连接券商</p>
        <p className="text-gray-500 text-xs mt-1">在系统设置中配置 OpenD 连接信息</p>
      </div>
    </div>
  );
}
