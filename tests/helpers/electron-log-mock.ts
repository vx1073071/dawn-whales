// Mock electron-log for vitest (R84)
// Redirect all log calls to console so engine code using `import log from 'electron-log'`
// works in test environments without the real electron-log dependency.

const log = {
  info: (...args: unknown[]) => console.log(...args),
  warn: (...args: unknown[]) => console.warn(...args),
  error: (...args: unknown[]) => console.error(...args),
  debug: (...args: unknown[]) => console.debug(...args),
  verbose: (...args: unknown[]) => console.debug(...args),
  silly: (...args: unknown[]) => console.debug(...args),
  log: (...args: unknown[]) => console.log(...args),
};

export default log;
