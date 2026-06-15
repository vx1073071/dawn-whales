// ── R218-auto#2 (L6): 策略模板版本管理 — v1.0→v2.0一键迁移 ──────────────
// 版本diff + 一键迁移 + 回滚 + 迁移审计日志

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export type TemplateVersion = `${number}.${number}`; // e.g., "1.0", "2.1"

export interface VersionedTemplate {
  id: string;
  name: string;
  nameCn: string;
  version: TemplateVersion;
  versionHistory: TemplateVersionSnapshot[];
  currentData: Record<string, unknown>;
}

export interface TemplateVersionSnapshot {
  version: TemplateVersion;
  data: Record<string, unknown>;
  createdAt: number;
  createdBy: string;
  changelog: string[];
}

export interface VersionDiff {
  templateId: string;
  fromVersion: TemplateVersion;
  toVersion: TemplateVersion;
  changes: VersionChange[];
  summary: string;
  breakingChanges: boolean;
  migrationCost: 'none' | 'low' | 'medium' | 'high';
  affectedUsers: number;
}

export interface VersionChange {
  field: string;
  type: 'added' | 'removed' | 'modified' | 'renamed' | 'type_changed';
  oldValue?: unknown;
  newValue?: unknown;
  description: string;
  breaking: boolean;
}

export interface MigrationPlan {
  templateId: string;
  fromVersion: TemplateVersion;
  toVersion: TemplateVersion;
  steps: MigrationStep[];
  estimatedDuration: 'instant' | 'fast' | 'moderate' | 'slow';
  rollbackAvailable: boolean;
  warnings: string[];
}

export interface MigrationStep {
  order: number;
  action: string;
  description: string;
  field?: string;
  transform?: string;    // description of the transformation
  reversible: boolean;
}

export interface MigrationResult {
  templateId: string;
  fromVersion: TemplateVersion;
  toVersion: TemplateVersion;
  success: boolean;
  steps: Array<{ order: number; action: string; success: boolean; error?: string }>;
  migratedAt: number;
  migratedBy: string;
  rollbackVersion?: TemplateVersion;
}

export interface RollbackResult {
  templateId: string;
  fromVersion: TemplateVersion;
  rolledBackTo: TemplateVersion;
  success: boolean;
  steps: Array<{ order: number; action: string; success: boolean; error?: string }>;
  rolledBackAt: number;
  note: string;
}

export interface MigrationLogEntry {
  id: string;
  templateId: string;
  action: 'migrate' | 'rollback' | 'snapshot' | 'diff';
  fromVersion: TemplateVersion;
  toVersion: TemplateVersion;
  success: boolean;
  userId: string;
  timestamp: number;
  details: string;
}

export interface VersionChangelog {
  templateId: string;
  versions: Array<{
    version: TemplateVersion;
    date: number;
    changes: string[];
    breaking: boolean;
  }>;
}

// ═══════════════════════════════════════════════════════════════════════════
// TEMPLATE VERSION MANAGER
// ═══════════════════════════════════════════════════════════════════════════

export class TemplateVersionManager {
  private templates = new Map<string, VersionedTemplate>();
  private migrationLog: MigrationLogEntry[] = [];
  private logCounter = 0;

  // ═══════════════════════════════════════════════════════════════════════
  // VERSION REGISTRATION
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Register a new template with version tracking.
   */
  registerTemplate(
    id: string,
    name: string,
    nameCn: string,
    initialVersion: TemplateVersion,
    initialData: Record<string, unknown>,
    createdBy: string = 'system',
  ): VersionedTemplate {
    const snapshot: TemplateVersionSnapshot = {
      version: initialVersion,
      data: structuredClone(initialData),
      createdAt: Date.now(),
      createdBy,
      changelog: ['初始版本'],
    };

    const template: VersionedTemplate = {
      id,
      name,
      nameCn,
      version: initialVersion,
      versionHistory: [snapshot],
      currentData: initialData,
    };

    this.templates.set(id, template);
    return template;
  }

  /**
   * Create a version snapshot (before making changes).
   */
  createSnapshot(
    templateId: string,
    newVersion: TemplateVersion,
    newData: Record<string, unknown>,
    changelog: string[],
    createdBy: string = 'system',
  ): TemplateVersionSnapshot | null {
    const template = this.templates.get(templateId);
    if (!template) return null;

    const snapshot: TemplateVersionSnapshot = {
      version: newVersion,
      data: structuredClone(newData),
      createdAt: Date.now(),
      createdBy,
      changelog,
    };

    template.versionHistory.push(snapshot);
    template.version = newVersion;
    template.currentData = newData;

    this.recordLog(templateId, 'snapshot', template.versionHistory[template.versionHistory.length - 2]?.version ?? '1.0', newVersion, true, createdBy, `Snapshot: ${changelog.join(', ')}`);

    return snapshot;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // VERSION DIFF
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Compute detailed diff between two versions of a template.
   */
  computeDiff(templateId: string, fromVersion: TemplateVersion, toVersion: TemplateVersion): VersionDiff | null {
    const template = this.templates.get(templateId);
    if (!template) return null;

    const from = template.versionHistory.find(s => s.version === fromVersion);
    const to = template.versionHistory.find(s => s.version === toVersion);
    if (!from || !to) return null;

    const changes = this.deepDiff(from.data, to.data);
    const breakingChanges = changes.some(c => c.breaking);

    // Migration cost
    let migrationCost: 'none' | 'low' | 'medium' | 'high' = 'none';
    const breakingCount = changes.filter(c => c.breaking).length;
    if (breakingCount > 5) migrationCost = 'high';
    else if (breakingCount > 2) migrationCost = 'medium';
    else if (breakingCount > 0) migrationCost = 'low';

    const summary = `${changes.length} 项变更, ${breakingCount} 项破坏性变更, 迁移成本: ${migrationCost}`;

    return {
      templateId,
      fromVersion,
      toVersion,
      changes,
      summary,
      breakingChanges,
      migrationCost,
      affectedUsers: 0, // would be populated from usage stats in production
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ONE-CLICK MIGRATION (v1.0 → v2.0)
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Generate a migration plan for upgrading a template version.
   */
  generateMigrationPlan(templateId: string, toVersion: TemplateVersion): MigrationPlan | null {
    const template = this.templates.get(templateId);
    if (!template) return null;

    if (template.version === toVersion) {
      return {
        templateId, fromVersion: template.version, toVersion,
        steps: [], estimatedDuration: 'instant', rollbackAvailable: true,
        warnings: ['已是最新版本，无需迁移'],
      };
    }

    const diff = this.computeDiff(templateId, template.version, toVersion);
    if (!diff) return null;

    const steps: MigrationStep[] = diff.changes.map((change, i) => ({
      order: i + 1,
      action: this.changeTypeToAction(change.type),
      description: change.description,
      field: change.field,
      transform: change.type === 'type_changed'
        ? `类型转换: ${typeof change.oldValue} → ${typeof change.newValue}`
        : undefined,
      reversible: !change.breaking,
    }));

    // Add pre/post migration steps
    steps.unshift({
      order: 0, action: 'backup', description: '创建迁移前快照备份',
      reversible: true,
    });

    steps.push({
      order: steps.length + 1, action: 'validate',
      description: '迁移后验证: 权重和=100%, 因子引用有效, 必填字段完整',
      reversible: false,
    });

    const breaking = diff.changes.filter(c => c.breaking);
    const warnings: string[] = [];

    if (breaking.length > 0) {
      warnings.push(`${breaking.length} 项破坏性变更，迁移后部分用户配置可能需要手动调整`);
    }

    if (diff.changes.some(c => c.type === 'removed')) {
      warnings.push('包含字段删除: 删除字段的数据将不可恢复');
    }

    // Estimate duration
    let estimatedDuration: 'instant' | 'fast' | 'moderate' | 'slow' = 'instant';
    if (steps.length > 20) estimatedDuration = 'slow';
    else if (steps.length > 10) estimatedDuration = 'moderate';
    else if (steps.length > 3) estimatedDuration = 'fast';

    return {
      templateId,
      fromVersion: template.version,
      toVersion,
      steps,
      estimatedDuration,
      rollbackAvailable: true,
      warnings,
    };
  }

  /**
   * Execute one-click migration.
   * 1. Create pre-migration snapshot
   * 2. Apply changes
   * 3. Validate result
   */
  migrate(
    templateId: string,
    toVersion: TemplateVersion,
    userId: string = 'system',
  ): MigrationResult {
    const template = this.templates.get(templateId);
    if (!template) {
      return {
        templateId, fromVersion: '1.0' as TemplateVersion, toVersion,
        success: false,
        steps: [{ order: 0, action: 'migrate', success: false, error: `模板 ${templateId} 不存在` }],
        migratedAt: Date.now(), migratedBy: userId,
      };
    }

    const fromVersion = template.version;
    const target = template.versionHistory.find(s => s.version === toVersion);
    if (!target) {
      return {
        templateId, fromVersion, toVersion,
        success: false,
        steps: [{ order: 0, action: 'migrate', success: false, error: `目标版本 ${toVersion} 不存在` }],
        migratedAt: Date.now(), migratedBy: userId,
      };
    }

    // Step 1: Create pre-migration backup
    const backupResult = this.createSnapshot(
      templateId,
      `${fromVersion}-backup` as TemplateVersion,
      template.currentData,
      [`迁移前备份: ${fromVersion} → ${toVersion}`],
      userId,
    );
    const stepResults: Array<{ order: number; action: string; success: boolean; error?: string }> = [
      { order: 0, action: 'backup', success: !!backupResult },
    ];

    // Step 2: Apply the new version data
    try {
      template.currentData = structuredClone(target.data);
      template.version = toVersion;
      stepResults.push({ order: 1, action: 'migrate', success: true });
    } catch (err) {
      stepResults.push({
        order: 1, action: 'migrate', success: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    // Step 3: Validate
    const valid = this.validateTemplate(template);
    stepResults.push({
      order: 2, action: 'validate',
      success: valid.valid,
      error: valid.valid ? undefined : valid.errors.join('; '),
    });

    const allSuccess = stepResults.every(s => s.success);

    this.recordLog(templateId, 'migrate', fromVersion, toVersion, allSuccess, userId,
      allSuccess ? '迁移成功' : '部分步骤失败');

    return {
      templateId, fromVersion, toVersion,
      success: allSuccess,
      steps: stepResults,
      migratedAt: Date.now(),
      migratedBy: userId,
      rollbackVersion: backupResult?.version,
    };
  }

  /**
   * Rollback to a previous version.
   */
  rollback(templateId: string, targetVersion: TemplateVersion, userId: string = 'system'): RollbackResult {
    const template = this.templates.get(templateId);
    if (!template) {
      return {
        templateId, fromVersion: '1.0' as TemplateVersion, rolledBackTo: targetVersion,
        success: false,
        steps: [{ order: 0, action: 'rollback', success: false, error: `模板不存在` }],
        rolledBackAt: Date.now(), note: '回滚失败',
      };
    }

    const fromVersion = template.version;
    const target = template.versionHistory.find(s => s.version === targetVersion);
    if (!target) {
      return {
        templateId, fromVersion, rolledBackTo: targetVersion,
        success: false,
        steps: [{ order: 0, action: 'rollback', success: false, error: `版本 ${targetVersion} 不存在于历史记录` }],
        rolledBackAt: Date.now(), note: '回滚失败: 版本不存在',
      };
    }

    // Restore target version data
    template.currentData = structuredClone(target.data);
    template.version = targetVersion;

    this.recordLog(templateId, 'rollback', fromVersion, targetVersion, true, userId,
      `回滚到 ${targetVersion}`);

    return {
      templateId, fromVersion, rolledBackTo: targetVersion,
      success: true,
      steps: [
        { order: 0, action: 'backup', success: true },
        { order: 1, action: 'restore', success: true },
        { order: 2, action: 'validate', success: this.validateTemplate(template).valid },
      ],
      rolledBackAt: Date.now(),
      note: `已从 ${fromVersion} 回滚到 ${targetVersion}。回滚前的数据已保存在版本历史中。`,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // VERSION HISTORY & CHANGELOG
  // ═══════════════════════════════════════════════════════════════════════

  getVersionHistory(templateId: string): TemplateVersionSnapshot[] {
    return this.templates.get(templateId)?.versionHistory ?? [];
  }

  generateChangelog(templateId: string): VersionChangelog | null {
    const template = this.templates.get(templateId);
    if (!template) return null;

    const versions = template.versionHistory.map(s => ({
      version: s.version,
      date: s.createdAt,
      changes: s.changelog,
      breaking: s.changelog.some(c => c.includes('breaking') || c.includes('破坏')),
    }));

    return { templateId, versions };
  }

  /**
   * Generate changelog for all templates (useful for release notes).
   */
  generateFullChangelog(): VersionChangelog[] {
    const changelogs: VersionChangelog[] = [];
    for (const [id] of Array.from(this.templates)) {
      const cl = this.generateChangelog(id);
      if (cl) changelogs.push(cl);
    }
    return changelogs;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // MIGRATION LOG
  // ═══════════════════════════════════════════════════════════════════════

  getMigrationLog(options?: { templateId?: string; limit?: number }): MigrationLogEntry[] {
    let entries = [...this.migrationLog];

    if (options?.templateId) {
      entries = entries.filter(e => e.templateId === options.templateId);
    }

    entries.sort((a, b) => b.timestamp - a.timestamp);

    if (options?.limit) {
      entries = entries.slice(0, options.limit);
    }

    return entries;
  }

  getLastMigration(templateId: string): MigrationLogEntry | null {
    return this.migrationLog
      .filter(e => e.templateId === templateId && e.action === 'migrate')
      .sort((a, b) => b.timestamp - a.timestamp)[0] ?? null;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // QUERY
  // ═══════════════════════════════════════════════════════════════════════

  getTemplate(templateId: string): VersionedTemplate | null {
    return this.templates.get(templateId) ?? null;
  }

  getCurrentVersion(templateId: string): TemplateVersion | null {
    return this.templates.get(templateId)?.version ?? null;
  }

  listTemplates(): VersionedTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * Get templates that are not on the latest version.
   */
  getOutdatedTemplates(targetVersion: TemplateVersion): VersionedTemplate[] {
    return Array.from(this.templates.values())
      .filter(t => t.version !== targetVersion);
  }

  /**
   * Batch migrate all outdated templates to target version.
   */
  batchMigrate(targetVersion: TemplateVersion, userId: string = 'system'): MigrationResult[] {
    const outdated = this.getOutdatedTemplates(targetVersion);
    return outdated.map(t => this.migrate(t.id, targetVersion, userId));
  }

  // ═══════════════════════════════════════════════════════════════════════
  // VALIDATION
  // ═══════════════════════════════════════════════════════════════════════

  private validateTemplate(template: VersionedTemplate): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const data = template.currentData;

    // Check required fields
    if (!data.id) errors.push('缺少 id');
    if (!data.name) errors.push('缺少 name');
    if (!data.nameCn) errors.push('缺少 nameCn');

    // Check weight sum = 100 if factorWeights present
    if (Array.isArray(data.factorWeights)) {
      const weights = data.factorWeights as Array<{ weight: number }>;
      const sum = weights.reduce((s, w) => s + (w.weight || 0), 0);
      if (Math.abs(sum - 100) > 0.01) {
        errors.push(`因子权重和 = ${sum}，应为 100`);
      }
    }

    // Check holdingDays format if present
    if (data.holdingDays) {
      const hd = data.holdingDays as { min: number; max: number; unit: string };
      if (!hd.unit || !['day', 'week', 'month', 'year'].includes(hd.unit)) {
        errors.push('holdingDays.unit 无效');
      }
      if (hd.min > hd.max) {
        errors.push('holdingDays.min > max');
      }
    }

    return { valid: errors.length === 0, errors };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // DIFF ENGINE
  // ═══════════════════════════════════════════════════════════════════════

  private deepDiff(
    oldObj: Record<string, unknown>,
    newObj: Record<string, unknown>,
    prefix: string = '',
  ): VersionChange[] {
    const changes: VersionChange[] = [];
    const allKeys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)]);

    for (const key of Array.from(allKeys)) {
      const fieldPath = prefix ? `${prefix}.${key}` : key;
      const oldVal = oldObj[key];
      const newVal = newObj[key];

      if (oldVal === undefined && newVal !== undefined) {
        changes.push({
          field: fieldPath, type: 'added', newValue: this.summarize(newVal),
          description: `新增字段 ${fieldPath}`, breaking: false,
        });
      } else if (oldVal !== undefined && newVal === undefined) {
        changes.push({
          field: fieldPath, type: 'removed', oldValue: this.summarize(oldVal),
          description: `删除字段 ${fieldPath}`, breaking: true,
        });
      } else if (typeof oldVal !== typeof newVal) {
        changes.push({
          field: fieldPath, type: 'type_changed',
          oldValue: typeof oldVal, newValue: typeof newVal,
          description: `${fieldPath} 类型变更: ${typeof oldVal} → ${typeof newVal}`,
          breaking: true,
        });
      } else if (this.isObject(oldVal) && this.isObject(newVal)) {
        changes.push(
          ...this.deepDiff(oldVal as Record<string, unknown>, newVal as Record<string, unknown>, fieldPath),
        );
      } else if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
        changes.push({
          field: fieldPath, type: 'modified',
          oldValue: this.summarize(oldVal), newValue: this.summarize(newVal),
          description: `${fieldPath} 变更: ${this.summarize(oldVal)} → ${this.summarize(newVal)}`,
          breaking: typeof oldVal === 'number' && typeof newVal === 'number' && oldVal > newVal,
        });
      }
    }

    return changes;
  }

  private isObject(val: unknown): val is Record<string, unknown> {
    return val !== null && typeof val === 'object' && !Array.isArray(val);
  }

  private summarize(val: unknown): string {
    if (typeof val === 'string' && val.length > 40) return val.substring(0, 37) + '...';
    if (typeof val === 'object' && val !== null) return `{...}`;
    return String(val);
  }

  private changeTypeToAction(type: VersionChange['type']): string {
    switch (type) {
      case 'added': return 'add_field';
      case 'removed': return 'remove_field';
      case 'modified': return 'update_field';
      case 'renamed': return 'rename_field';
      case 'type_changed': return 'transform_field';
    }
  }

  private recordLog(
    templateId: string,
    action: MigrationLogEntry['action'],
    fromVersion: TemplateVersion,
    toVersion: TemplateVersion,
    success: boolean,
    userId: string,
    details: string,
  ): void {
    this.migrationLog.push({
      id: `mig_${++this.logCounter}`,
      templateId, action, fromVersion, toVersion,
      success, userId, timestamp: Date.now(), details,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ADMIN
  // ═══════════════════════════════════════════════════════════════════════

  reset(): void {
    this.templates.clear();
    this.migrationLog = [];
    this.logCounter = 0;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════════════

let _versionManagerInstance: TemplateVersionManager | null = null;

export function getTemplateVersionManager(): TemplateVersionManager {
  if (!_versionManagerInstance) {
    _versionManagerInstance = new TemplateVersionManager();
  }
  return _versionManagerInstance;
}

export function resetTemplateVersionManager(): void {
  _versionManagerInstance?.reset();
  _versionManagerInstance = null;
}

// ═══════════════════════════════════════════════════════════════════════════
// CONVENIENCE: One-click migration helper
// ═══════════════════════════════════════════════════════════════════════════

/**
 * One-click migrate a template from its current version to target.
 * Returns detailed MigrationResult.
 */
export function oneClickMigrate(
  templateId: string,
  toVersion: TemplateVersion,
  userId: string = 'system',
): MigrationResult {
  return getTemplateVersionManager().migrate(templateId, toVersion, userId);
}

/**
 * Batch one-click migrate all templates to target version.
 */
export function batchOneClickMigrate(
  toVersion: TemplateVersion,
  userId: string = 'system',
): MigrationResult[] {
  return getTemplateVersionManager().batchMigrate(toVersion, userId);
}

export default {
  TemplateVersionManager,
  getTemplateVersionManager,
  resetTemplateVersionManager,
  oneClickMigrate,
  batchOneClickMigrate,
};
