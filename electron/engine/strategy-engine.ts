// ── Strategy Engine — 策略执行引擎 ─────────────────────────────────────────
import log from 'electron-log';

export class StrategyEngine {
  private liveStrategies = new Map<string, { timer: NodeJS.Timeout; status: string }>();

  createStrategy(dsl: any): string {
    const id = `strat_${Date.now()}`;
    log.info(`[StrategyEngine] Created strategy: ${id}`, dsl.name);
    return id;
  }

  startLive(strategyId: string) {
    if (this.liveStrategies.has(strategyId)) return;
    log.info(`[StrategyEngine] Starting live: ${strategyId}`);
    // TODO: Load DSL, setup signal evaluation loop
    this.liveStrategies.set(strategyId, { timer: setInterval(() => {}, 60000), status: 'running' });
  }

  stopLive(strategyId: string) {
    const entry = this.liveStrategies.get(strategyId);
    if (entry) {
      clearInterval(entry.timer);
      this.liveStrategies.delete(strategyId);
      log.info(`[StrategyEngine] Stopped live: ${strategyId}`);
    }
  }

  emergencyStop() {
    log.warn('[StrategyEngine] 🚨 EMERGENCY STOP — stopping all live strategies');
    for (const [id, entry] of this.liveStrategies) {
      clearInterval(entry.timer);
      log.info(`[StrategyEngine] Emergency stopped: ${id}`);
    }
    this.liveStrategies.clear();
  }
}
