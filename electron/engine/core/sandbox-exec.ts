/**
 * J-77-02: child_process 安全沙箱
 * 
 * 白名单命令 + 输入校验 + 超时自动kill
 * 用于替换引擎中 node:child_process spawn/exec 的直接调用
 */

import { spawn, SpawnOptions } from 'child_process';
import { createHash } from 'crypto';
import { EngineError, ErrorCode } from '../../errors';


// ── 白名单：允许的命令（绝对路径安全） ──────────────────────
const ALLOWED_COMMANDS: Set<string> = new Set([
  'python3',
  'python',
  'node',
  'git',
  'docker',
  'kubectl',
  'helm',
]);

const ALLOWED_PATHS: Set<string> = new Set([
  'C:/Python312/python.exe',
  '/usr/bin/python3',
  '/usr/local/bin/python3',
  'C:/Program Files/nodejs/node.exe',
  '/usr/bin/node',
  'C:/Program Files/Git/cmd/git.exe',
  '/usr/bin/git',
]);

// ── 禁止的字符/模式（命令注入防护） ──────────────────────
const FORBIDDEN_PATTERNS = [
  /[;&|`$]/,
  /\.\.\//,
  /\/etc\/passwd/,
  /\/etc\/shadow/,
  /\/dev\/null/,
  /rm\s+-rf/,
  /del\s+\/f/i,
  /shutdown/i,
  /reboot/i,
  /format\s/i,
  /mkfs/i,
  /dd\s+if=/,
  /nc\s+-/,
  /wget\s+/,
  /curl\s+/,
];

const MAX_INPUT_LENGTH = 8192;
const DEFAULT_TIMEOUT_MS = 30_000;

export interface SandboxOptions extends SpawnOptions {
  /** 超时(ms), 默认30000 */
  timeoutMs?: number;
  /** 跳过白名单检查（仅用于已知内部工具） */
  skipAllowlist?: boolean;
}

export interface SandboxResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  killed: boolean;
  signal: string | null;
}

/**
 * 安全校验输入参数
 */
function validateInputs(args: string[]): void {
  if (!args || args.length === 0) return;
  
  const joined = args.join(' ');
  if (joined.length > MAX_INPUT_LENGTH) {
    throw new EngineError(ErrorCode.INTERNAL_ERROR, 'Sandbox: Input exceeds max length');
  }
  
  for (const arg of args) {
    if (Buffer.byteLength(arg, 'utf8') > 4096) {
      throw new EngineError(ErrorCode.INTERNAL_ERROR, 'Sandbox: Argument exceeds limit');
    }
  }
  
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(joined)) {
      throw new EngineError(ErrorCode.INTERNAL_ERROR, `Sandbox: Forbidden pattern detected: ${pattern}`);
    }
  }
}

/**
 * 白名单检查
 */
function checkAllowlist(command: string, skipAllowlist: boolean): void {
  if (skipAllowlist) return;
  
  if (ALLOWED_COMMANDS.has(command)) return;
  if (ALLOWED_PATHS.has(command)) return;
  
  // Check if command is a known safe path prefix
  for (const allowed of ALLOWED_PATHS) {
    if (command.startsWith(allowed + '/') || command.startsWith(allowed + '\\')) {
      return;
    }
  }
  
  throw new EngineError(ErrorCode.INTERNAL_ERROR, `Sandbox: Command "${command}" is not in the allowlist`);
}

/**
 * 安全 spawn — 替代 node:child_process.spawn
 */
export function safeSpawn(
  command: string,
  args: string[] = [],
  options: SandboxOptions = {}
): Promise<SandboxResult> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, skipAllowlist = false, ...spawnOptions } = options;
  
  checkAllowlist(command, skipAllowlist);
  validateInputs(args);
  
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      ...spawnOptions,
      windowsHide: true,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    
    let stdout = '';
    let stderr = '';
    let killed = false;
    let timedOut = false;
    
    const timer = setTimeout(() => {
      timedOut = true;
      killed = true;
      child.kill('SIGKILL');
      reject(new Error(`Sandbox: Command "${command}" timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    
    child.stdout?.on('data', (chunk: Buffer) => {
      const text = chunk.toString('utf8');
      if (stdout.length + text.length > MAX_INPUT_LENGTH * 10) return; // limit output
      stdout += text;
    });
    
    child.stderr?.on('data', (chunk: Buffer) => {
      const text = chunk.toString('utf8');
      if (stderr.length + text.length > MAX_INPUT_LENGTH * 5) return;
      stderr += text;
    });
    
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      if (!timedOut) {
        resolve({
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          exitCode: code,
          killed,
          signal,
        });
      }
    });
    
    child.on('error', (err) => {
      clearTimeout(timer);
      killed = true;
      reject(new Error(`Sandbox: Failed to spawn "${command}": ${err.message}`));
    });
  });
}

/**
 * 生成命令执行指纹（审计日志用）
 */
export function commandFingerprint(command: string, args: string[]): string {
  return createHash('sha256').update(`${command}|${args.join('|')}`).digest('hex').substring(0, 16);
}

export default safeSpawn;
