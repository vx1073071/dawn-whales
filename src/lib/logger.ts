// ── quant-moo — Logger ───────────────────────────────────────────────────
// Lightweight logging wrapper. In dev → console; in production → configurable.

const isDev = typeof process !== 'undefined' &&
  (!process.env?.NODE_ENV || process.env.NODE_ENV === 'development');

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_COLORS: Record<LogLevel, string> = {
  debug: '#7c8db5',
  info: '#4a9eff',
  warn: '#e8a940',
  error: '#e05555',
};

class Logger {
  private prefix: string;

  constructor(prefix: string) {
    this.prefix = prefix;
  }

  private log(level: LogLevel, ...args: unknown[]) {
    if (!isDev && level === 'debug') return; // drop debug in production
    
    const tag = `[${this.prefix}]`;
    const color = LOG_COLORS[level];
    
    if (typeof window !== 'undefined') {
      console[level](
        `%c${tag}`,
        `color:${color};font-weight:600`,
        ...args
      );
    } else {
      console[level](tag, ...args);
    }
  }

  debug(...args: unknown[]) { this.log('debug', ...args); }
  info(...args: unknown[]) { this.log('info', ...args); }
  warn(...args: unknown[]) { this.log('warn', ...args); }
  error(...args: unknown[]) { this.log('error', ...args); }

  /** Create a child logger with sub-prefix */
  child(name: string): Logger {
    return new Logger(`${this.prefix}:${name}`);
  }
}

// Global logger instance
export const logger = new Logger('DAWN');

/** Create a component-scoped logger */
export function createLogger(component: string): Logger {
  return logger.child(component);
}

export default logger;
