// T64: Temporary file cleanup service
import * as fs from 'fs';
import * as path from 'path';

export interface CleanupRule {
  dir: string;
  pattern: RegExp;
  maxAgeMs: number;
  recursive?: boolean;
}

export class FileCleanup {
  private rules: CleanupRule[] = [];
  private timer: NodeJS.Timeout | null = null;

  addRule(rule: CleanupRule): void {
    this.rules.push(rule);
  }

  async cleanup(): Promise<{ deleted: number; errors: string[] }> {
    let deleted = 0;
    const errors: string[] = [];

    for (const rule of this.rules) {
      try {
        deleted += await this._cleanDir(rule.dir, rule);
      } catch (e) {
        errors.push(`${rule.dir}: ${e.message}`);
      }
    }

    return { deleted, errors };
  }

  private async _cleanDir(dir: string, rule: CleanupRule): Promise<number> {
    if (!fs.existsSync(dir)) return 0;
    let deleted = 0;
    const now = Date.now();

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory() && rule.recursive) {
        deleted += await this._cleanDir(fullPath, rule);
        // remove empty dir
        try {
          const remaining = fs.readdirSync(fullPath);
          if (remaining.length === 0) {
            fs.rmdirSync(fullPath);
            deleted++;
          }
        } catch (e) { /* ignore */ }
        continue;
      }

      if (entry.isFile() && rule.pattern.test(entry.name)) {
        const stats = fs.statSync(fullPath);
        if (now - stats.mtimeMs > rule.maxAgeMs) {
          fs.unlinkSync(fullPath);
          deleted++;
        }
      }
    }

    return deleted;
  }

  schedule(intervalMs = 3600000): void {
    this.timer = setInterval(() => this.cleanup(), intervalMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}

export const fileCleanup = new FileCleanup();
