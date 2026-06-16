/**
 * Helper that wraps StrategySandboxWorker for vitest compatibility.
 *
 * Because vitest.config.ts aliases `electron` → tests/helpers/electron-mock.ts,
 * relative imports containing `/electron/` get intercepted. This helper
 * uses a vitest-friendly path to load the real module.
 */
import {
  StrategySandboxWorker,
  getStrategySandboxWorker as _getWorker,
  resetStrategySandboxWorker as _resetWorker,
  DEFAULT_SANDBOX_QUOTA,
  TIGHT_SANDBOX_QUOTA,
} from '../../electron/workers/strategy-sandbox-worker';

export {
  StrategySandboxWorker,
  DEFAULT_SANDBOX_QUOTA,
  TIGHT_SANDBOX_QUOTA,
};

export function getStrategySandboxWorker(config?: any) {
  return _getWorker(config);
}

export function resetStrategySandboxWorker() {
  return _resetWorker();
}
