import React, { useState, useEffect } from 'react';

export default function StatusBar() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <footer className="h-6 bg-surface-2 border-t border-border flex items-center px-3 gap-4 text-[11px] text-gray-500 flex-shrink-0">
      <div className="flex items-center gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-gray-500" />
        <span>OpenD 127.0.0.1:11111</span>
      </div>
      <span>|</span>
      <span>DAWN WHALES · 道鲸</span>
      <div className="flex-1" />
      <span>{time.toLocaleTimeString('zh-CN', { hour12: false })}</span>
      <span>|</span>
      <span>内存: --</span>
    </footer>
  );
}
