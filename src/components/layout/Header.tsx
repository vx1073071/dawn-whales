import { useAppStore } from '@/stores/appStore';
import logo from '@/assets/logo.jpg';

export default function Header() {
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);
  const conn = useAppStore((s) => s.connectionStatus);
  const emergencyStop = useAppStore((s) => s.emergencyStop);

  const opendConnected = conn?.connected ?? false;

  return (
    <header className="h-12 bg-[#15151f] border-b border-white/5 flex items-center px-4 gap-3 flex-shrink-0">
      <button onClick={toggleSidebar} className="text-gray-400 hover:text-gray-200 text-lg p-1" title="折叠侧边栏">☰</button>

      <div className="flex items-center gap-2.5">
        <img src={logo} alt="道鲸" className="w-7 h-7 rounded-md" />
        <div className="flex flex-col leading-tight">
          <span className="text-white font-bold text-xs">道鲸·AI量化系统</span>
          <span className="text-[#D4A853] text-[9px] font-medium tracking-wider">DAWN WHALES</span>
        </div>
      </div>

      <div className="flex-1" />

      {/* Connection status */}
      <div className="flex items-center gap-4 text-xs">
        <div className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${opendConnected ? 'bg-emerald-400 animate-pulse' : 'bg-gray-500'}`} />
          <span className={opendConnected ? 'text-emerald-400' : 'text-gray-500'}>
            OpenD {opendConnected ? '已连接' : '未连接'}
          </span>
          {opendConnected && conn?.latencyMs && (
            <span className="text-gray-600 text-[10px]">{conn.latencyMs}ms</span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 ml-3">
        <button className="text-gray-400 hover:text-gray-200 p-1.5 rounded hover:bg-white/5 transition-colors" title="通知">🔔</button>
        <button onClick={emergencyStop} className="text-gray-400 hover:text-red-400 p-1.5 rounded hover:bg-red-500/10 transition-colors" title="紧急停止所有策略">⏸️</button>
      </div>
    </header>
  );
}
