import { EngineError, ErrorDomain, ErrorCode } from '../engine/core/engine-error';
﻿// T99: Batch ETL Scheduler with DAG dependencies
export interface BatchJob {
  id: string;
  name: string;
  schedule: { kind: 'cron'; expr: string } | { kind: 'interval'; ms: number };
  dependencies: string[];
  handler: string;
  lastRun?: number;
  status: 'idle' | 'running' | 'success' | 'failed';
  error?: string;
  duration?: number;
}

export interface DAGNode {
  job: BatchJob;
  children: string[];
  level: number;
}

export class BatchScheduler {
  private jobs = new Map<string, BatchJob>();
  private dag: DAGNode[] = [];
  private timers = new Map<string, NodeJS.Timeout>();
  private handlers = new Map<string, () => Promise<void>>();

  register(job: BatchJob): void {
    this.jobs.set(job.id, job);
    this._buildDAG();
  }

  on(jobId: string, handler: () => Promise<void>): void {
    this.handlers.set(jobId, handler);
  }

  async execute(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) throw new EngineError(ErrorDomain.SYSTEM, ErrorCode.INTERNAL_ERROR, `Job ${jobId} not found`);

    // Check dependencies
    for (const depId of job.dependencies) {
      const dep = this.jobs.get(depId);
      if (!dep || dep.status === 'failed') {
        job.status = 'failed';
        job.error = `Dependency ${depId} failed or missing`;
        return;
      }
      if (dep.status !== 'success') {
        return; // dependency not ready
      }
    }

    const start = Date.now();
    job.status = 'running';
    job.lastRun = start;

    try {
      const handler = this.handlers.get(jobId);
      if (handler) await handler();
      job.status = 'success';
      job.duration = Date.now() - start;
    } catch (e) {
      job.status = 'failed';
      job.error = e.message;
      job.duration = Date.now() - start;
    }
  }

  async executeAll(): Promise<{ success: number; failed: number; skipped: number }[]> {
    // Sort by DAG level
    const ordered = this.dag.sort((a, b) => a.level - b.level);
    const results: { success: number; failed: number; skipped: number }[] = [];

    for (let level = 0; level <= Math.max(...ordered.map(n => n.level)); level++) {
      const levelJobs = ordered.filter(n => n.level === level);
      let success = 0, failed = 0, skipped = 0;

      for (const node of levelJobs) {
        if (node.job.dependencies.some(d => this.jobs.get(d)?.status === 'failed')) {
          node.job.status = 'failed';
          node.job.error = 'Upstream dependency failed';
          skipped++;
          continue;
        }
        await this.execute(node.job.id);
        if (node.job.status === 'success') success++;
        else failed++;
      }
      results.push({ success, failed, skipped });
    }

    return results;
  }

  start(): void {
    for (const [, job] of this.jobs) {
      if (job.schedule.kind === 'interval') {
        const timer = setInterval(() => this.execute(job.id), job.schedule.ms);
        this.timers.set(job.id, timer);
      }
    }
  }

  stop(): void {
    for (const timer of this.timers.values()) clearInterval(timer);
    this.timers.clear();
  }

  getDAG(): DAGNode[] {
    return this.dag;
  }

  detectCycles(): string[][] {
    const cycles: string[][] = [];
    // Simple DFS cycle detection
    const visited = new Set<string>();
    const stack = new Set<string>();

    const dfs = (nodeId: string, path: string[]) => {
      if (stack.has(nodeId)) {
        cycles.push([...path, nodeId]);
        return;
      }
      if (visited.has(nodeId)) return;
      visited.add(nodeId);
      stack.add(nodeId);
      const job = this.jobs.get(nodeId);
      if (job) {
        for (const dep of job.dependencies) dfs(dep, [...path, nodeId]);
      }
      stack.delete(nodeId);
    };

    for (const id of this.jobs.keys()) dfs(id, []);
    return cycles;
  }

  private _buildDAG(): void {
    const nodes: DAGNode[] = [];
    const jobIds = Array.from(this.jobs.keys());

    for (const [id, job] of this.jobs) {
      const deps = job.dependencies;
      let level = 0;
      if (deps.length > 0) {
        level = 1 + Math.max(...deps.map(d => {
          const existing = nodes.find(n => n.job.id === d);
          return existing?.level || 0;
        }));
      }
      nodes.push({ job: { ...job }, children: jobIds.filter(j => this.jobs.get(j)?.dependencies.includes(id)), level });
    }

    this.dag = nodes;
  }
}
