// T91: GitOps deployment pipeline configuration
export interface GitOpsConfig {
  gitRepo: string;
  branch: string;
  deployPath: string;
  autoDeploy: boolean;
  preDeployChecks: {
    tests: boolean;
    build: boolean;
    lint: boolean;
    securityScan: boolean;
  };
  environments: {
    name: string;
    branch: string;
    url?: string;
  }[];
}

export interface DeploymentStatus {
  env: string;
  status: 'pending' | 'deploying' | 'deployed' | 'failed' | 'rolled-back';
  version: string;
  commitSha: string;
  deployedAt?: number;
  duration?: number;
  error?: string;
}

export class GitOpsPipeline {
  private config: GitOpsConfig;
  private deployments = new Map<string, DeploymentStatus[]>();

  constructor(config: GitOpsConfig) {
    this.config = config;
  }

  getConfig(): GitOpsConfig {
    return { ...this.config };
  }

  getDeploymentStatus(env: string): DeploymentStatus[] {
    return this.deployments.get(env) || [];
  }

  getLatestDeployment(env: string): DeploymentStatus | null {
    const deps = this.deployments.get(env) || [];
    return deps[deps.length - 1] || null;
  }

  async deploy(env: string, version: string, commitSha: string): Promise<DeploymentStatus> {
    const status: DeploymentStatus = {
      env,
      status: 'deploying',
      version,
      commitSha,
      deployedAt: Date.now(),
    };

    if (!this.config.environments.find(e => e.name === env)) {
      status.status = 'failed';
      status.error = `Environment ${env} not found`;
      return status;
    }

    // Pre-deploy checks (simulated)
    const checks = this.config.preDeployChecks;
    if (checks.tests) await this._simulate('tests', 200);
    if (checks.build) await this._simulate('build', 500);
    if (checks.lint) await this._simulate('lint', 100);
    if (checks.securityScan) await this._simulate('security scan', 300);

    status.status = 'deployed';
    status.duration = Date.now() - status.deployedAt!;

    if (!this.deployments.has(env)) this.deployments.set(env, []);
    this.deployments.get(env)!.push(status);

    return status;
  }

  async rollback(env: string): Promise<DeploymentStatus> {
    const history = this.deployments.get(env) || [];
    if (history.length < 2) {
      return { env, status: 'failed', version: '', commitSha: '', error: 'No previous deployment' };
    }

    const current = history.pop()!;
    current.status = 'rolled-back';

    const previous = history[history.length - 1];
    const rollbackStatus: DeploymentStatus = {
      env,
      status: 'deployed',
      version: previous.version,
      commitSha: previous.commitSha,
      deployedAt: Date.now(),
    };
    this.deployments.get(env)!.push(rollbackStatus);

    return rollbackStatus;
  }

  private async _simulate(name: string, duration: number): Promise<void> {
    await new Promise(r => setTimeout(r, duration));
  }
}
