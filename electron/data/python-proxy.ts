// ── JVS-20: Python Script Proxy Layer (Python脚本代理层) ──────────────────
// Unified interface for calling em-mx-* Python skill scripts
// Auto-detects Python path, handles timeouts, caches output file paths

import log from 'electron-log';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';

const execAsync = promisify(exec);

// ── Types ──────────────────────────────────────────────────────────────────

export interface PythonScriptResult {
  success: boolean;
  stdout: string;
  stderr: string;
  outputFiles: string[];     // Paths to generated xlsx/csv/md/txt files
  description: string;       // Description text from skill
  rowCount: number;          // Number of data rows (for tabular output)
  durationMs: number;
  error?: string;
}

export interface PythonProxyConfig {
  pythonPath?: string;       // Override Python executable path
  timeoutMs?: number;        // Default 30000ms
  maxBuffer?: number;        // Default 50MB
  cacheTtlMs?: number;       // Output cache TTL, default 10 min
}

interface CacheEntry {
  result: PythonScriptResult;
  expires: number;
}

// ── Skill Script Paths ─────────────────────────────────────────────────────

const SKILL_BASE_PATHS = [
  'C:\\Users\\vx107\\.easyclaw\\workspace\\skills',
  'C:\\Users\\vx107\\.easyclaw\\workspace\\skills',
];

const SKILL_SCRIPTS: Record<string, string> = {
  'em-mx-finance-data': 'em-mx-finance-data/scripts/get_data.py',
  'em-mx-finance-search': 'em-mx-finance-search/scripts/get_data.py',
  'em-mx-macro-data': 'em-mx-macro-data/scripts/get_data.py',
  'em-mx-stocks-screener': 'em-mx-stocks-screener/scripts/get_data.py',
  'em-fund-diagnosis': 'em-fund-diagnosis/scripts/get_data.py',
  'em-stock-diagnosis': 'em-stock-diagnosis/scripts/get_data.py',
  'em-stock-market-hotspot': 'em-stock-market-hotspot-discovery/scripts/get_data.py',
  // Project-level aliases
  'mx-data': 'mx-data/scripts/get_data.py',
  'mx-search': 'mx-search/scripts/get_data.py',
  'mx-select-stock': 'mx-select-stock/scripts/get_data.py',
};

// ── Python Proxy Service ───────────────────────────────────────────────────

export class PythonProxyService {
  private pythonPath: string | null = null;
  private config: Required<PythonProxyConfig>;
  private cache = new Map<string, CacheEntry>();

  constructor(config?: PythonProxyConfig) {
    this.config = {
      pythonPath: config?.pythonPath || '',
      timeoutMs: config?.timeoutMs || 30000,
      maxBuffer: config?.maxBuffer || 50 * 1024 * 1024,
      cacheTtlMs: config?.cacheTtlMs || 10 * 60 * 1000,
    };
    this.detectPython();
    log.info(`[PythonProxy] Initialized, python: ${this.pythonPath || 'NOT FOUND'}`);
  }

  /**
   * Detect Python executable
   */
  private detectPython(): void {
    if (this.config.pythonPath) {
      this.pythonPath = this.config.pythonPath;
      return;
    }

    const candidates = [
      'C:\\Users\\vx107\\AppData\\Local\\Programs\\Python\\Python312\\python.exe',
      'C:\\Users\\vx107\\AppData\\Local\\Programs\\Python\\Python311\\python.exe',
      'C:\\Users\\vx107\\AppData\\Local\\Programs\\Python\\Python310\\python.exe',
      'python3',
      'python',
      'py',
    ];

    for (const candidate of candidates) {
      try {
        if (candidate.includes('\\') && fs.existsSync(candidate)) {
          this.pythonPath = candidate;
          log.info(`[PythonProxy] Found Python at: ${candidate}`);
          return;
        }
      } catch (e) { logger.error('[backend:python-proxy]', e); }
    }

    // Fallback to PATH resolution
    this.pythonPath = 'python3';
  }

  /**
   * Resolve skill script path
   */
  private resolveScriptPath(skillName: string): string | null {
    const relativePath = SKILL_SCRIPTS[skillName];
    if (!relativePath) {
      log.warn(`[PythonProxy] Unknown skill: ${skillName}`);
      return null;
    }

    for (const base of SKILL_BASE_PATHS) {
      const fullPath = path.join(base, relativePath);
      if (fs.existsSync(fullPath)) {
        return fullPath;
      }
    }

    log.warn(`[PythonProxy] Script not found for: ${skillName}`);
    return null;
  }

  /**
   * Call a Python skill script
   */
  async callSkill(
    skillName: string,
    query: string,
    options?: { selectType?: string; noSave?: boolean }
  ): Promise<PythonScriptResult> {
    const cacheKey = `${skillName}:${query}:${options?.selectType || ''}`;
    
    // Check cache
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expires > Date.now()) {
      log.info(`[PythonProxy] Cache hit: ${skillName}`);
      return cached.result;
    }

    const scriptPath = this.resolveScriptPath(skillName);
    if (!scriptPath) {
      return this.errorResult(`Script not found for skill: ${skillName}`);
    }

    if (!this.pythonPath) {
      return this.errorResult('Python not found');
    }

    const startTime = Date.now();

    // Build command
    let cmd = `"${this.pythonPath}" "${scriptPath}" --query "${query.replace(/"/g, '\\"')}"`;
    if (options?.selectType) {
      cmd += ` --select-type "${options.selectType}"`;
    }
    if (options?.noSave) {
      cmd += ' --no-save';
    }

    log.info(`[PythonProxy] Executing: ${cmd}`);

    try {
      const { stdout, stderr } = await execAsync(cmd, {
        timeout: this.config.timeoutMs,
        maxBuffer: this.config.maxBuffer,
        encoding: 'utf-8',
        env: { ...process.env },
      });

      const durationMs = Date.now() - startTime;

      // Parse output files from stdout
      const outputFiles = this.parseOutputFiles(stdout);
      const description = this.parseDescription(stdout);
      const rowCount = this.parseRowCount(stdout);

      const result: PythonScriptResult = {
        success: true,
        stdout: stdout || '',
        stderr: stderr || '',
        outputFiles,
        description,
        rowCount,
        durationMs,
      };

      // Cache result
      this.cache.set(cacheKey, { result, expires: Date.now() + this.config.cacheTtlMs });
      log.info(`[PythonProxy] ${skillName} done in ${durationMs}ms, files: ${outputFiles.length}`);
      return result;
    } catch (err) {
      const durationMs = Date.now() - startTime;
      log.error(`[PythonProxy] ${skillName} failed:`, err.message);
      
      return {
        success: false,
        stdout: err.stdout || '',
        stderr: err.stderr || '',
        outputFiles: [],
        description: '',
        rowCount: 0,
        durationMs,
        error: err.message,
      };
    }
  }

  /**
   * List available skills
   */
  listAvailableSkills(): { name: string; available: boolean; scriptPath: string | null }[] {
    return Object.keys(SKILL_SCRIPTS).map(name => ({
      name,
      available: this.resolveScriptPath(name) !== null,
      scriptPath: this.resolveScriptPath(name),
    }));
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    log.info('[PythonProxy] Cache cleared');
  }

  /**
   * Get Python status
   */
  getStatus(): { pythonPath: string | null; availableSkills: number; totalSkills: number; cacheSize: number } {
    const skills = this.listAvailableSkills();
    return {
      pythonPath: this.pythonPath,
      availableSkills: skills.filter(s => s.available).length,
      totalSkills: skills.length,
      cacheSize: this.cache.size,
    };
  }

  // ── Output Parsing Helpers ───────────────────────────────────────────────

  private parseOutputFiles(stdout: string): string[] {
    const files: string[] = [];
    
    // Match common output patterns
    const patterns = [
      /(?:xlsx|csv|md|txt|json):\s*([^\r\n]+)/gi,
      /(?:Saved|Output|File):\s*([^\r\n]+)/gi,
      /([A-Z]:\\[^\s"'<>|]+\.(?:xlsx|csv|md|txt|json))/gi,
      /(\/[^\s"'<>|]+\.(?:xlsx|csv|md|txt|json))/gi,
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(stdout)) !== null) {
        const filePath = match[1].trim();
        if (filePath && !files.includes(filePath)) {
          files.push(filePath);
        }
      }
    }

    return files;
  }

  private parseDescription(stdout: string): string {
    const descMatch = stdout.match(/(?:描述|Description|描述)[:\s]+([^\r\n]+)/i);
    if (descMatch) return descMatch[1].trim();

    const rowsMatch = stdout.match(/(?:行数|Rows|行数)[:\s]+(\d+)/i);
    if (rowsMatch) return `${rowsMatch[1]} rows returned`;

    // Fallback: first meaningful line
    const lines = stdout.split('\n').filter(l => l.trim().length > 10 && !l.startsWith('/'));
    return lines[0]?.trim() || '';
  }

  private parseRowCount(stdout: string): number {
    const match = stdout.match(/(?:行数|Rows|行数|rows?)[:\s]+(\d+)/i);
    return match ? parseInt(match[1]) : 0;
  }

  private errorResult(message: string): PythonScriptResult {
    return {
      success: false,
      stdout: '',
      stderr: '',
      outputFiles: [],
      description: '',
      rowCount: 0,
      durationMs: 0,
      error: message,
    };
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────

let pythonProxyInstance: PythonProxyService | null = null;

export function getPythonProxy(config?: PythonProxyConfig): PythonProxyService {
  if (!pythonProxyInstance) {
    pythonProxyInstance = new PythonProxyService(config);
  }
  return pythonProxyInstance;
}
