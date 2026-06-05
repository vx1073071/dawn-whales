import log from 'electron-log';

/**
 * Docker container management abstraction (simulated)
 * Container lifecycle: create/start/stop/restart/remove/inspect/logs
 * Service definitions for redis/postgres/prometheus/grafana
 * Health checks, resource monitoring, compose-like orchestration
 */

interface ContainerConfig {
  name: string;
  image: string;
  ports: Record<string, string>;
  env: Record<string, string>;
  volumes: string[];
  network: string;
  memoryLimit?: number;
  cpuLimit?: number;
  restartPolicy?: 'no' | 'always' | 'on-failure' | 'unless-stopped';
  labels?: Record<string, string>;
  command?: string[];
  entrypoint?: string[];
  workdir?: string;
  user?: string;
  hostname?: string;
  dns?: string[];
  healthCheck?: HealthCheckConfig;
}

interface HealthCheckConfig {
  endpoint: string;
  intervalMs: number;
  timeoutMs?: number;
  retries?: number;
  startPeriodMs?: number;
}

interface ContainerState {
  id: string;
  name: string;
  image: string;
  status: 'created' | 'running' | 'stopped' | 'removed' | 'paused' | 'restarting';
  startedAt?: string;
  stoppedAt?: string;
  createdAt: string;
  cpuPercent: number;
  memoryMB: number;
  memoryLimitMB: number;
  networkRx: number;
  networkTx: number;
  restartCount: number;
  exitCode: number;
  ports: Record<string, string>;
  env: Record<string, string>;
  volumes: string[];
  network: string;
  labels: Record<string, string>;
  logs: LogEntry[];
  healthStatus: 'healthy' | 'unhealthy' | 'starting' | 'none';
  lastHealthCheck?: string;
  pid?: number;
  uptime: number;
}

interface LogEntry {
  timestamp: string;
  stream: 'stdout' | 'stderr';
  message: string;
}

interface ServiceDefinition {
  name: string;
  image: string;
  ports: string[];
  env: Record<string, string>;
  volumes?: string[];
  network?: string;
  dependsOn?: string[];
  healthCheck?: HealthCheckConfig;
  restartPolicy?: 'no' | 'always' | 'on-failure' | 'unless-stopped';
  memoryLimit?: number;
  cpuLimit?: number;
  replicas?: number;
  labels?: Record<string, string>;
}

interface ComposeFile {
  version: string;
  services: Record<string, ServiceDefinition>;
  networks?: string[];
  volumes?: string[];
}

interface ResourceUsage {
  containerId: string;
  name: string;
  cpuPercent: number;
  memoryMB: number;
  memoryLimitMB: number;
  memoryPercent: number;
  networkRxMB: number;
  networkTxMB: number;
  blockReadMB: number;
  blockWriteMB: number;
  pids: number;
}

interface ContainerInspect {
  id: string;
  name: string;
  image: string;
  status: string;
  state: {
    running: boolean;
    paused: boolean;
    restarting: boolean;
    pid: number;
    exitCode: number;
    startedAt: string;
    stoppedAt: string;
  };
  config: {
    env: Record<string, string>;
    ports: Record<string, string>;
    volumes: string[];
    labels: Record<string, string>;
    network: string;
    restartPolicy: string;
  };
  networkSettings: {
    ipAddress: string;
    gateway: string;
    macAddress: string;
    ports: Record<string, string>;
  };
  health: {
    status: string;
    lastCheck: string;
    log: Array<{ timestamp: string; output: string; exitCode: number }>;
  };
  resourceUsage: ResourceUsage;
}

function generateId(): string {
  const chars = '0123456789abcdef';
  let id = '';
  for (let i = 0; i < 64; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

function generateShortId(id: string): string {
  return id.slice(0, 12);
}

function generateIPAddress(index: number): string {
  return `172.18.0.${index + 2}`;
}

function generateMacAddress(): string {
  const hex = () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0');
  return `02:42:ac:12:${hex()}:${hex()}`;
}

// ─── Default Service Definitions ──────────────────────────────

const DEFAULT_SERVICES: Record<string, ServiceDefinition> = {
  redis: {
    name: 'redis',
    image: 'redis:7-alpine',
    ports: ['6379:6379'],
    env: {
      REDIS_MAXMEMORY: '256mb',
      REDIS_MAXMEMORY_POLICY: 'allkeys-lru',
    },
    volumes: ['redis-data:/data'],
    network: 'dawn-whales-net',
    healthCheck: {
      endpoint: 'redis-cli ping',
      intervalMs: 10000,
      timeoutMs: 5000,
      retries: 3,
      startPeriodMs: 5000,
    },
    restartPolicy: 'always',
    memoryLimit: 512,
    cpuLimit: 50,
    labels: { 'service.type': 'cache', 'service.tier': 'infrastructure' },
  },

  postgres: {
    name: 'postgres',
    image: 'postgres:16-alpine',
    ports: ['5432:5432'],
    env: {
      POSTGRES_USER: 'dawn',
      POSTGRES_PASSWORD: 'whales',
      POSTGRES_DB: 'trading',
      PGDATA: '/var/lib/postgresql/data/pgdata',
    },
    volumes: ['postgres-data:/var/lib/postgresql/data'],
    network: 'dawn-whales-net',
    healthCheck: {
      endpoint: 'pg_isready -U dawn',
      intervalMs: 10000,
      timeoutMs: 5000,
      retries: 5,
      startPeriodMs: 30000,
    },
    restartPolicy: 'always',
    memoryLimit: 1024,
    cpuLimit: 100,
    labels: { 'service.type': 'database', 'service.tier': 'infrastructure' },
  },

  prometheus: {
    name: 'prometheus',
    image: 'prom/prometheus:v2.48.0',
    ports: ['9090:9090'],
    env: {},
    volumes: [
      'prometheus-data:/prometheus',
      './config/prometheus.yml:/etc/prometheus/prometheus.yml',
    ],
    network: 'dawn-whales-net',
    healthCheck: {
      endpoint: 'http://localhost:9090/-/healthy',
      intervalMs: 15000,
      timeoutMs: 5000,
      retries: 3,
      startPeriodMs: 10000,
    },
    restartPolicy: 'always',
    memoryLimit: 512,
    cpuLimit: 50,
    labels: { 'service.type': 'monitoring', 'service.tier': 'observability' },
  },

  grafana: {
    name: 'grafana',
    image: 'grafana/grafana:10.2.0',
    ports: ['3000:3000'],
    env: {
      GF_SECURITY_ADMIN_USER: 'admin',
      GF_SECURITY_ADMIN_PASSWORD: 'admin',
      GF_USERS_ALLOW_SIGN_UP: 'false',
    },
    volumes: [
      'grafana-data:/var/lib/grafana',
      './config/grafana/provisioning:/etc/grafana/provisioning',
    ],
    network: 'dawn-whales-net',
    dependsOn: ['prometheus'],
    healthCheck: {
      endpoint: 'http://localhost:3000/api/health',
      intervalMs: 15000,
      timeoutMs: 5000,
      retries: 3,
      startPeriodMs: 15000,
    },
    restartPolicy: 'always',
    memoryLimit: 256,
    cpuLimit: 30,
    labels: { 'service.type': 'monitoring', 'service.tier': 'observability' },
  },

  nginx: {
    name: 'nginx',
    image: 'nginx:1.25-alpine',
    ports: ['80:80', '443:443'],
    env: {},
    volumes: [
      './config/nginx/nginx.conf:/etc/nginx/nginx.conf:ro',
      './config/nginx/certs:/etc/nginx/certs:ro',
    ],
    network: 'dawn-whales-net',
    dependsOn: ['grafana'],
    healthCheck: {
      endpoint: 'curl -f http://localhost/health',
      intervalMs: 15000,
      timeoutMs: 5000,
      retries: 3,
    },
    restartPolicy: 'always',
    memoryLimit: 128,
    cpuLimit: 20,
    labels: { 'service.type': 'proxy', 'service.tier': 'infrastructure' },
  },

  nats: {
    name: 'nats',
    image: 'nats:2.10-alpine',
    ports: ['4222:4222', '8222:8222'],
    env: {},
    volumes: ['nats-data:/data'],
    network: 'dawn-whales-net',
    healthCheck: {
      endpoint: 'http://localhost:8222/healthz',
      intervalMs: 10000,
      timeoutMs: 5000,
      retries: 3,
    },
    restartPolicy: 'always',
    memoryLimit: 256,
    cpuLimit: 30,
    labels: { 'service.type': 'messaging', 'service.tier': 'infrastructure' },
  },
};

// ─── DockerManager ─────────────────────────────────────────────

export class DockerManager {
  private containers = new Map<string, ContainerState>();
  private networks = new Set<string>();
  private volumes = new Set<string>();
  private services = new Map<string, ServiceDefinition>();
  private composeStacks = new Map<string, string[]>();
  private healthCheckIntervals = new Map<string, ReturnType<typeof setInterval>>();
  private resourceMonitorInterval: ReturnType<typeof setInterval> | null = null;
  private containerIpIndex = 0;
  private eventHandlers = new Map<string, Set<(event: DockerEvent) => void>>();

  constructor() {
    // Register default services
    for (const [name, def] of Object.entries(DEFAULT_SERVICES)) {
      this.services.set(name, { ...def });
    }

    // Create default network
    this.networks.add('dawn-whales-net');
    this.networks.add('bridge');
    this.networks.add('host');

    // Create default volumes
    this.volumes.add('redis-data');
    this.volumes.add('postgres-data');
    this.volumes.add('prometheus-data');
    this.volumes.add('grafana-data');
    this.volumes.add('nats-data');

    // Start resource monitoring
    this.startResourceMonitor();

    log.info('[DockerManager] Initialized with default services and networks');
  }

  // ─── Container Lifecycle ────────────────────────────────────

  async create(config: ContainerConfig): Promise<string> {
    const existing = this.findByName(config.name);
    if (existing && existing.status !== 'removed') {
      throw new Error(`Container ${config.name} already exists (status: ${existing.status})`);
    }

    // Validate network
    if (config.network && !this.networks.has(config.network)) {
      throw new Error(`Network ${config.network} does not exist`);
    }

    const id = generateId();
    const now = new Date().toISOString();

    const state: ContainerState = {
      id,
      name: config.name,
      image: config.image,
      status: 'created',
      createdAt: now,
      cpuPercent: 0,
      memoryMB: 0,
      memoryLimitMB: config.memoryLimit ?? 512,
      networkRx: 0,
      networkTx: 0,
      restartCount: 0,
      exitCode: 0,
      ports: config.ports,
      env: config.env,
      volumes: config.volumes,
      network: config.network || 'bridge',
      labels: config.labels ?? {},
      logs: [],
      healthStatus: 'none',
      uptime: 0,
    };

    this.containers.set(id, state);
    this.addLog(id, 'stdout', `Container created: ${config.name} (${generateShortId(id)})`);
    this.emitEvent('create', id, config.name);

    log.info(`[DockerManager] Created container: ${config.name} (${generateShortId(id)})`);
    return id;
  }

  async start(idOrName: string): Promise<void> {
    const state = this.resolve(idOrName);
    if (!state) throw new Error(`Container ${idOrName} not found`);

    if (state.status === 'running') {
      log.warn(`[DockerManager] Container ${state.name} is already running`);
      return;
    }

    if (state.status === 'removed') {
      throw new Error(`Container ${state.name} has been removed`);
    }

    state.status = 'running';
    state.startedAt = new Date().toISOString();
    state.stoppedAt = undefined;
    state.pid = Math.floor(Math.random() * 30000) + 1000;
    state.exitCode = 0;
    state.healthStatus = state.labels['healthcheck'] !== 'none' ? 'starting' : 'none';
    state.uptime = 0;

    // Allocate IP
    state.labels['_ip'] = generateIPAddress(this.containerIpIndex++);
    state.labels['_mac'] = generateMacAddress();
    state.labels['_gateway'] = '172.18.0.1';

    this.addLog(state.id, 'stdout', `Container started: ${state.name}`);
    this.emitEvent('start', state.id, state.name);

    // Start health checks if configured
    this.startHealthCheck(state);

    log.info(`[DockerManager] Started container: ${state.name} (${generateShortId(state.id)})`);
  }

  async stop(idOrName: string, timeout?: number): Promise<void> {
    const state = this.resolve(idOrName);
    if (!state) throw new Error(`Container ${idOrName} not found`);

    if (state.status !== 'running' && state.status !== 'paused') {
      log.warn(`[DockerManager] Container ${state.name} is not running (status: ${state.status})`);
      return;
    }

    // Simulate graceful shutdown delay
    const shutdownMs = Math.min((timeout ?? 10) * 100, 3000);
    this.addLog(state.id, 'stdout', `Stopping container (timeout: ${timeout ?? 10}s)...`);

    await this.delay(shutdownMs);

    state.status = 'stopped';
    state.stoppedAt = new Date().toISOString();
    state.exitCode = 0;
    state.pid = undefined;
    state.cpuPercent = 0;
    state.healthStatus = 'none';

    // Stop health checks
    this.stopHealthCheck(state.id);

    this.addLog(state.id, 'stdout', `Container stopped: ${state.name}`);
    this.emitEvent('stop', state.id, state.name);

    log.info(`[DockerManager] Stopped container: ${state.name}`);
  }

  async restart(idOrName: string, timeout?: number): Promise<void> {
    const state = this.resolve(idOrName);
    if (!state) throw new Error(`Container ${idOrName} not found`);

    this.addLog(state.id, 'stdout', 'Restarting container...');

    if (state.status === 'running' || state.status === 'paused') {
      await this.stop(idOrName, timeout);
    }

    await this.start(idOrName);
    state.restartCount++;

    this.addLog(state.id, 'stdout', `Container restarted (count: ${state.restartCount})`);
    this.emitEvent('restart', state.id, state.name);

    log.info(`[DockerManager] Restarted container: ${state.name}`);
  }

  async remove(idOrName: string, force?: boolean): Promise<void> {
    const state = this.resolve(idOrName);
    if (!state) throw new Error(`Container ${idOrName} not found`);

    if (state.status === 'running' && !force) {
      throw new Error(`Container ${state.name} is running. Use force=true to remove.`);
    }

    if (state.status === 'running') {
      await this.stop(idOrName, 0);
    }

    state.status = 'removed';
    state.stoppedAt = new Date().toISOString();
    state.pid = undefined;

    this.stopHealthCheck(state.id);
    this.addLog(state.id, 'stdout', `Container removed: ${state.name}`);
    this.emitEvent('remove', state.id, state.name);

    // Clean up after a brief delay (simulate Docker cleanup)
    setTimeout(() => {
      this.containers.delete(state.id);
    }, 1000);

    log.info(`[DockerManager] Removed container: ${state.name}`);
  }

  async pause(idOrName: string): Promise<void> {
    const state = this.resolve(idOrName);
    if (!state) throw new Error(`Container ${idOrName} not found`);
    if (state.status !== 'running') throw new Error(`Container ${state.name} is not running`);

    state.status = 'paused';
    state.cpuPercent = 0;
    this.addLog(state.id, 'stdout', `Container paused: ${state.name}`);
    this.emitEvent('pause', state.id, state.name);
  }

  async unpause(idOrName: string): Promise<void> {
    const state = this.resolve(idOrName);
    if (!state) throw new Error(`Container ${idOrName} not found`);
    if (state.status !== 'paused') throw new Error(`Container ${state.name} is not paused`);

    state.status = 'running';
    this.addLog(state.id, 'stdout', `Container unpaused: ${state.name}`);
    this.emitEvent('unpause', state.id, state.name);
  }

  async kill(idOrName: string, signal?: string): Promise<void> {
    const state = this.resolve(idOrName);
    if (!state) throw new Error(`Container ${idOrName} not found`);

    state.status = 'stopped';
    state.stoppedAt = new Date().toISOString();
    state.exitCode = 137; // SIGKILL
    state.pid = undefined;
    state.cpuPercent = 0;
    state.healthStatus = 'none';

    this.stopHealthCheck(state.id);
    this.addLog(state.id, 'stderr', `Container killed with signal ${signal ?? 'SIGKILL'}`);
    this.emitEvent('kill', state.id, state.name);
  }

  // ─── Inspection & Logs ──────────────────────────────────────

  async inspect(idOrName: string): Promise<ContainerInspect> {
    const state = this.resolve(idOrName);
    if (!state) throw new Error(`Container ${idOrName} not found`);

    return {
      id: state.id,
      name: state.name,
      image: state.image,
      status: state.status,
      state: {
        running: state.status === 'running',
        paused: state.status === 'paused',
        restarting: state.status === 'restarting',
        pid: state.pid ?? 0,
        exitCode: state.exitCode,
        startedAt: state.startedAt ?? '',
        stoppedAt: state.stoppedAt ?? '',
      },
      config: {
        env: { ...state.env },
        ports: { ...state.ports },
        volumes: [...state.volumes],
        labels: { ...state.labels },
        network: state.network,
        restartPolicy: 'always',
      },
      networkSettings: {
        ipAddress: state.labels['_ip'] ?? '',
        gateway: state.labels['_gateway'] ?? '',
        macAddress: state.labels['_mac'] ?? '',
        ports: { ...state.ports },
      },
      health: {
        status: state.healthStatus,
        lastCheck: state.lastHealthCheck ?? '',
        log: [],
      },
      resourceUsage: await this.getResourceUsage(state.id),
    };
  }

  async logs(idOrName: string, options?: { tail?: number; since?: string; follow?: boolean }): Promise<LogEntry[]> {
    const state = this.resolve(idOrName);
    if (!state) throw new Error(`Container ${idOrName} not found`);

    let entries = [...state.logs];

    if (options?.since) {
      const since = new Date(options.since).getTime();
      entries = entries.filter((e) => new Date(e.timestamp).getTime() >= since);
    }

    if (options?.tail) {
      entries = entries.slice(-options.tail);
    }

    return entries;
  }

  async list(filters?: { status?: string; label?: string; name?: string }): Promise<ContainerState[]> {
    let results = Array.from(this.containers.values());

    if (filters?.status) {
      results = results.filter((c) => c.status === filters.status);
    }

    if (filters?.name) {
      const regex = new RegExp(filters.name, 'i');
      results = results.filter((c) => regex.test(c.name));
    }

    if (filters?.label) {
      const [key, val] = filters.label.split('=');
      results = results.filter((c) => {
        if (val) return c.labels[key] === val;
        return key in c.labels;
      });
    }

    return results;
  }

  async top(idOrName: string): Promise<{ titles: string[]; processes: string[][] }> {
    const state = this.resolve(idOrName);
    if (!state) throw new Error(`Container ${idOrName} not found`);
    if (state.status !== 'running') throw new Error(`Container ${state.name} is not running`);

    return {
      titles: ['UID', 'PID', 'PPID', 'C', 'STIME', 'TTY', 'TIME', 'CMD'],
      processes: [
        ['root', String(state.pid ?? 1), '0', '0', '00:00', '?', '00:00:00', state.image],
      ],
    };
  }

  async stats(idOrName: string): Promise<ResourceUsage> {
    const state = this.resolve(idOrName);
    if (!state) throw new Error(`Container ${idOrName} not found`);
    return this.getResourceUsage(state.id);
  }

  // ─── Compose-like Orchestration ─────────────────────────────

  async composeUp(stackName: string, services?: string[]): Promise<Map<string, string>> {
    log.info(`[DockerManager] composeUp: stack=${stackName}, services=${services?.join(',') ?? 'all'}`);

    const containerIds = new Map<string, string>();
    const servicesToStart = services ?? Array.from(this.services.keys());

    // Create network for stack
    const networkName = `${stackName}-net`;
    if (!this.networks.has(networkName)) {
      this.createNetwork(networkName);
    }

    // Resolve dependency order
    const ordered = this.resolveServiceOrder(servicesToStart);

    for (const serviceName of ordered) {
      const svc = this.services.get(serviceName);
      if (!svc) {
        log.warn(`[DockerManager] Unknown service: ${serviceName}`);
        continue;
      }

      // Handle replicas
      const replicas = svc.replicas ?? 1;
      for (let i = 0; i < replicas; i++) {
        const containerName = replicas > 1 ? `${stackName}-${serviceName}-${i + 1}` : `${stackName}-${serviceName}`;

        const ports: Record<string, string> = {};
        for (const p of svc.ports) {
          const [host, container] = p.split(':');
          const hostPort = replicas > 1 ? String(parseInt(host) + i) : host;
          ports[hostPort] = container;
        }

        const id = await this.create({
          name: containerName,
          image: svc.image,
          ports,
          env: svc.env,
          volumes: svc.volumes ?? [],
          network: svc.network ?? networkName,
          memoryLimit: svc.memoryLimit,
          cpuLimit: svc.cpuLimit,
          labels: {
            ...svc.labels,
            'compose.stack': stackName,
            'compose.service': serviceName,
            'compose.replica': String(i + 1),
          },
        });

        await this.start(id);
        containerIds.set(containerName, id);
      }
    }

    this.composeStacks.set(stackName, Array.from(containerIds.values()));
    log.info(`[DockerManager] composeUp complete: ${containerIds.size} containers started`);
    return containerIds;
  }

  async composeDown(stackName: string, options?: { removeVolumes?: boolean; removeImages?: boolean }): Promise<void> {
    log.info(`[DockerManager] composeDown: stack=${stackName}`);

    const containerIds = this.composeStacks.get(stackName);
    if (!containerIds || containerIds.length === 0) {
      log.warn(`[DockerManager] No containers found for stack: ${stackName}`);
      return;
    }

    // Stop and remove in reverse order
    for (const id of [...containerIds].reverse()) {
      const state = this.containers.get(id);
      if (state && state.status !== 'removed') {
        await this.remove(id, true);
      }
    }

    // Clean up stack network
    const networkName = `${stackName}-net`;
    if (this.networks.has(networkName)) {
      this.removeNetwork(networkName);
    }

    if (options?.removeVolumes) {
      // Remove stack-specific volumes
      for (const vol of this.volumes) {
        if (vol.startsWith(`${stackName}-`)) {
          this.volumes.delete(vol);
        }
      }
    }

    this.composeStacks.delete(stackName);
    log.info(`[DockerManager] composeDown complete: stack=${stackName}`);
  }

  async scale(stackName: string, serviceName: string, replicas: number): Promise<void> {
    log.info(`[DockerManager] scale: ${stackName}/${serviceName} -> ${replicas} replicas`);

    if (replicas < 0) throw new Error('Replicas must be >= 0');

    const svc = this.services.get(serviceName);
    if (!svc) throw new Error(`Unknown service: ${serviceName}`);

    // Find current containers for this service
    const current = Array.from(this.containers.values()).filter(
      (c) =>
        c.labels['compose.stack'] === stackName &&
        c.labels['compose.service'] === serviceName &&
        c.status !== 'removed'
    );

    const currentCount = current.length;

    if (replicas > currentCount) {
      // Scale up
      for (let i = currentCount; i < replicas; i++) {
        const containerName = `${stackName}-${serviceName}-${i + 1}`;
        const ports: Record<string, string> = {};
        for (const p of svc.ports) {
          const [host, container] = p.split(':');
          ports[String(parseInt(host) + i)] = container;
        }

        const id = await this.create({
          name: containerName,
          image: svc.image,
          ports,
          env: svc.env,
          volumes: svc.volumes ?? [],
          network: svc.network ?? `${stackName}-net`,
          labels: {
            ...svc.labels,
            'compose.stack': stackName,
            'compose.service': serviceName,
            'compose.replica': String(i + 1),
          },
        });
        await this.start(id);
      }
    } else if (replicas < currentCount) {
      // Scale down - remove excess containers
      const toRemove = current.slice(replicas);
      for (const state of toRemove) {
        await this.remove(state.id, true);
      }
    }
  }

  // ─── Service Management ─────────────────────────────────────

  registerService(definition: ServiceDefinition): void {
    this.services.set(definition.name, { ...definition });
    log.info(`[DockerManager] Registered service: ${definition.name}`);
  }

  unregisterService(name: string): boolean {
    const removed = this.services.delete(name);
    if (removed) {
      log.info(`[DockerManager] Unregistered service: ${name}`);
    }
    return removed;
  }

  getService(name: string): ServiceDefinition | undefined {
    return this.services.get(name);
  }

  listServices(): ServiceDefinition[] {
    return Array.from(this.services.values());
  }

  // ─── Health Checks ──────────────────────────────────────────

  private startHealthCheck(state: ContainerState): void {
    const svc = this.services.get(state.labels['compose.service'] ?? state.name);
    const hc = svc?.healthCheck ?? state.healthStatus !== 'none' ? undefined : undefined;

    if (!hc && !svc?.healthCheck) return;

    const config = svc?.healthCheck;
    if (!config) return;

    const interval = setInterval(() => {
      this.performHealthCheck(state.id, config);
    }, config.intervalMs);

    this.healthCheckIntervals.set(state.id, interval);
    state.healthStatus = 'starting';

    // Initial check after start period
    setTimeout(() => {
      this.performHealthCheck(state.id, config);
    }, config.startPeriodMs ?? 5000);
  }

  private performHealthCheck(containerId: string, config: HealthCheckConfig): void {
    const state = this.containers.get(containerId);
    if (!state || state.status !== 'running') return;

    // Simulate health check (always passes for simulation)
    const healthy = Math.random() > 0.05; // 95% success rate
    state.healthStatus = healthy ? 'healthy' : 'unhealthy';
    state.lastHealthCheck = new Date().toISOString();

    if (!healthy) {
      this.addLog(containerId, 'stderr', `Health check failed: ${config.endpoint}`);
      log.warn(`[DockerManager] Health check failed for ${state.name}: ${config.endpoint}`);

      // Handle unhealthy based on restart policy
      if (state.labels['restartPolicy'] === 'on-failure') {
        this.restart(containerId).catch((err) => {
          log.error(`[DockerManager] Failed to restart unhealthy container ${state.name}:`, err);
        });
      }
    } else {
      log.debug(`[DockerManager] Health check passed for ${state.name}`);
    }
  }

  private stopHealthCheck(containerId: string): void {
    const interval = this.healthCheckIntervals.get(containerId);
    if (interval) {
      clearInterval(interval);
      this.healthCheckIntervals.delete(containerId);
    }
  }

  async healthCheck(idOrName: string): Promise<{ status: string; healthy: boolean; details: Record<string, unknown> }> {
    const state = this.resolve(idOrName);
    if (!state) throw new Error(`Container ${idOrName} not found`);

    return {
      status: state.healthStatus,
      healthy: state.healthStatus === 'healthy',
      details: {
        container: state.name,
        image: state.image,
        uptime: state.uptime,
        lastCheck: state.lastHealthCheck,
        restartCount: state.restartCount,
        cpuPercent: state.cpuPercent,
        memoryMB: state.memoryMB,
      },
    };
  }

  // ─── Resource Monitoring ────────────────────────────────────

  private startResourceMonitor(): void {
    this.resourceMonitorInterval = setInterval(() => {
      this.updateResourceMetrics();
    }, 5000);
  }

  private updateResourceMetrics(): void {
    for (const [id, state] of this.containers) {
      if (state.status !== 'running') continue;

      // Simulate CPU usage (random walk)
      state.cpuPercent = Math.max(0, Math.min(100, state.cpuPercent + (Math.random() - 0.5) * 10));

      // Simulate memory usage
      const baseMemMB = 50;
      const jitter = (Math.random() - 0.5) * 20;
      state.memoryMB = Math.max(10, Math.min(state.memoryLimitMB, baseMemMB + jitter + state.uptime * 0.001));

      // Simulate network I/O
      state.networkRx += Math.random() * 1024 * 100; // up to 100KB per tick
      state.networkTx += Math.random() * 1024 * 50;

      // Update uptime
      if (state.startedAt) {
        state.uptime = (Date.now() - new Date(state.startedAt).getTime()) / 1000;
      }
    }
  }

  async getResourceUsage(containerId: string): Promise<ResourceUsage> {
    const state = this.containers.get(containerId);
    if (!state) throw new Error(`Container ${containerId} not found`);

    return {
      containerId: state.id,
      name: state.name,
      cpuPercent: Math.round(state.cpuPercent * 100) / 100,
      memoryMB: Math.round(state.memoryMB * 100) / 100,
      memoryLimitMB: state.memoryLimitMB,
      memoryPercent: Math.round((state.memoryMB / state.memoryLimitMB) * 10000) / 100,
      networkRxMB: Math.round((state.networkRx / (1024 * 1024)) * 100) / 100,
      networkTxMB: Math.round((state.networkTx / (1024 * 1024)) * 100) / 100,
      blockReadMB: Math.round(Math.random() * 50 * 100) / 100,
      blockWriteMB: Math.round(Math.random() * 30 * 100) / 100,
      pids: state.status === 'running' ? Math.floor(Math.random() * 20) + 5 : 0,
    };
  }

  async getAllResourceUsage(): Promise<ResourceUsage[]> {
    const results: ResourceUsage[] = [];
    for (const [id, state] of this.containers) {
      if (state.status === 'running') {
        results.push(await this.getResourceUsage(id));
      }
    }
    return results;
  }

  // ─── Network Management ─────────────────────────────────────

  createNetwork(name: string, options?: { driver?: string; subnet?: string }): string {
    if (this.networks.has(name)) {
      throw new Error(`Network ${name} already exists`);
    }
    this.networks.add(name);
    log.info(`[DockerManager] Created network: ${name} (driver: ${options?.driver ?? 'bridge'})`);
    return `net-${generateId().slice(0, 12)}`;
  }

  removeNetwork(name: string): void {
    if (!this.networks.has(name)) {
      throw new Error(`Network ${name} does not exist`);
    }

    // Check if any containers are using this network
    for (const state of this.containers.values()) {
      if (state.network === name && state.status === 'running') {
        throw new Error(`Network ${name} is in use by container ${state.name}`);
      }
    }

    this.networks.delete(name);
    log.info(`[DockerManager] Removed network: ${name}`);
  }

  listNetworks(): string[] {
    return Array.from(this.networks);
  }

  async inspectNetwork(name: string): Promise<{
    name: string;
    driver: string;
    containers: Array<{ id: string; name: string; ip: string }>;
  }> {
    if (!this.networks.has(name)) {
      throw new Error(`Network ${name} does not exist`);
    }

    const containers: Array<{ id: string; name: string; ip: string }> = [];
    for (const state of this.containers.values()) {
      if (state.network === name && state.status !== 'removed') {
        containers.push({
          id: generateShortId(state.id),
          name: state.name,
          ip: state.labels['_ip'] ?? '',
        });
      }
    }

    return { name, driver: 'bridge', containers };
  }

  async connectNetwork(containerId: string, networkName: string): Promise<void> {
    const state = this.containers.get(containerId);
    if (!state) throw new Error(`Container ${containerId} not found`);
    if (!this.networks.has(networkName)) throw new Error(`Network ${networkName} does not exist`);

    state.network = networkName;
    state.labels['_ip'] = generateIPAddress(this.containerIpIndex++);
    this.addLog(containerId, 'stdout', `Connected to network: ${networkName}`);
  }

  async disconnectNetwork(containerId: string, networkName: string): Promise<void> {
    const state = this.containers.get(containerId);
    if (!state) throw new Error(`Container ${containerId} not found`);

    if (state.network === networkName) {
      state.network = '';
      this.addLog(containerId, 'stdout', `Disconnected from network: ${networkName}`);
    }
  }

  // ─── Volume Management ──────────────────────────────────────

  createVolume(name: string, options?: { driver?: string; labels?: Record<string, string> }): string {
    if (this.volumes.has(name)) {
      throw new Error(`Volume ${name} already exists`);
    }
    this.volumes.add(name);
    log.info(`[DockerManager] Created volume: ${name}`);
    return name;
  }

  removeVolume(name: string, force?: boolean): void {
    if (!this.volumes.has(name)) {
      throw new Error(`Volume ${name} does not exist`);
    }

    // Check if any containers are using this volume
    if (!force) {
      for (const state of this.containers.values()) {
        if (state.volumes.some((v) => v.startsWith(`${name}:`)) && state.status !== 'removed') {
          throw new Error(`Volume ${name} is in use by container ${state.name}`);
        }
      }
    }

    this.volumes.delete(name);
    log.info(`[DockerManager] Removed volume: ${name}`);
  }

  listVolumes(): string[] {
    return Array.from(this.volumes);
  }

  async pruneVolumes(): Promise<{ deleted: string[]; spaceReclaimed: number }> {
    const unused: string[] = [];

    for (const vol of this.volumes) {
      let inUse = false;
      for (const state of this.containers.values()) {
        if (state.volumes.some((v) => v.startsWith(`${vol}:`)) && state.status !== 'removed') {
          inUse = true;
          break;
        }
      }
      if (!inUse) {
        unused.push(vol);
      }
    }

    for (const vol of unused) {
      this.volumes.delete(vol);
    }

    log.info(`[DockerManager] Pruned ${unused.length} unused volumes`);
    return { deleted: unused, spaceReclaimed: unused.length * 100 * 1024 * 1024 };
  }

  // ─── Image Management (Simulated) ──────────────────────────

  async pull(image: string): Promise<{ status: string; id: string; size: number }> {
    log.info(`[DockerManager] Pulling image: ${image}`);
    await this.delay(500);

    return {
      status: 'Downloaded newer image',
      id: `sha256:${generateId()}`,
      size: Math.floor(Math.random() * 500 + 50) * 1024 * 1024,
    };
  }

  async listImages(): Promise<Array<{ id: string; tags: string[]; size: number; created: string }>> {
    const images = new Map<string, { id: string; tags: string[]; size: number; created: string }>();

    for (const state of this.containers.values()) {
      if (!images.has(state.image)) {
        images.set(state.image, {
          id: `sha256:${generateId().slice(0, 12)}`,
          tags: [state.image],
          size: Math.floor(Math.random() * 500 + 50) * 1024 * 1024,
          created: state.createdAt,
        });
      }
    }

    return Array.from(images.values());
  }

  // ─── Events ─────────────────────────────────────────────────

  on(event: string, handler: (event: DockerEvent) => void): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);
  }

  off(event: string, handler: (event: DockerEvent) => void): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  private emitEvent(action: string, containerId: string, containerName: string): void {
    const event: DockerEvent = {
      action,
      containerId: generateShortId(containerId),
      containerName,
      timestamp: new Date().toISOString(),
    };

    const handlers = this.eventHandlers.get(action);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(event);
        } catch (err) {
          log.error(`[DockerManager] Event handler error:`, err);
        }
      }
    }

    // Also emit to wildcard handlers
    const wildcardHandlers = this.eventHandlers.get('*');
    if (wildcardHandlers) {
      for (const handler of wildcardHandlers) {
        try {
          handler(event);
        } catch (err) {
          log.error(`[DockerManager] Wildcard event handler error:`, err);
        }
      }
    }
  }

  // ─── Utility Methods ────────────────────────────────────────

  private resolve(idOrName: string): ContainerState | undefined {
    // Try by ID
    if (this.containers.has(idOrName)) {
      return this.containers.get(idOrName);
    }

    // Try by short ID
    for (const [id, state] of this.containers) {
      if (id.startsWith(idOrName)) return state;
    }

    // Try by name
    return this.findByName(idOrName);
  }

  private findByName(name: string): ContainerState | undefined {
    for (const state of this.containers.values()) {
      if (state.name === name && state.status !== 'removed') return state;
    }
    return undefined;
  }

  private addLog(containerId: string, stream: 'stdout' | 'stderr', message: string): void {
    const state = this.containers.get(containerId);
    if (!state) return;

    state.logs.push({
      timestamp: new Date().toISOString(),
      stream,
      message,
    });

    // Keep only last 10000 log entries
    if (state.logs.length > 10000) {
      state.logs = state.logs.slice(-10000);
    }
  }

  private resolveServiceOrder(services: string[]): string[] {
    const visited = new Set<string>();
    const order: string[] = [];

    const visit = (name: string) => {
      if (visited.has(name)) return;
      visited.add(name);

      const svc = this.services.get(name);
      if (svc?.dependsOn) {
        for (const dep of svc.dependsOn) {
          visit(dep);
        }
      }

      order.push(name);
    };

    for (const name of services) {
      visit(name);
    }

    return order;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ─── Compose File Generation ────────────────────────────────

  generateComposeFile(stackName: string, serviceNames?: string[]): ComposeFile {
    const names = serviceNames ?? Array.from(this.services.keys());
    const services: Record<string, ServiceDefinition> = {};

    for (const name of names) {
      const svc = this.services.get(name);
      if (svc) {
        services[name] = { ...svc, network: `${stackName}-net` };
      }
    }

    return {
      version: '3.8',
      services,
      networks: [`${stackName}-net`],
      volumes: names.flatMap((n) => {
        const svc = this.services.get(n);
        return svc?.volumes?.map((v) => v.split(':')[0]).filter((v) => !v.startsWith('.')) ?? [];
      }),
    };
  }

  // ─── System Info ────────────────────────────────────────────

  async systemInfo(): Promise<{
    containers: { total: number; running: number; stopped: number; paused: number };
    images: number;
    networks: number;
    volumes: number;
    serverVersion: string;
    os: string;
    arch: string;
    cpus: number;
    memoryGB: number;
  }> {
    let running = 0, stopped = 0, paused = 0;
    for (const state of this.containers.values()) {
      if (state.status === 'running') running++;
      else if (state.status === 'paused') paused++;
      else if (state.status !== 'removed') stopped++;
    }

    return {
      containers: {
        total: this.containers.size,
        running,
        stopped,
        paused,
      },
      images: (await this.listImages()).length,
      networks: this.networks.size,
      volumes: this.volumes.size,
      serverVersion: '24.0.7-sim',
      os: process.platform,
      arch: process.arch,
      cpus: 8,
      memoryGB: 16,
    };
  }

  // ─── Cleanup ────────────────────────────────────────────────

  async prune(options?: { all?: boolean }): Promise<{ containersRemoved: number; networksRemoved: number; volumesRemoved: number }> {
    let containersRemoved = 0;
    let networksRemoved = 0;
    let volumesRemoved = 0;

    // Remove stopped containers
    for (const [id, state] of this.containers) {
      if (state.status === 'stopped' || state.status === 'created') {
        this.containers.delete(id);
        containersRemoved++;
      }
    }

    // Remove unused networks
    if (options?.all) {
      for (const net of this.networks) {
        if (net !== 'bridge' && net !== 'host' && net !== 'dawn-whales-net') {
          let inUse = false;
          for (const state of this.containers.values()) {
            if (state.network === net && state.status !== 'removed') {
              inUse = true;
              break;
            }
          }
          if (!inUse) {
            this.networks.delete(net);
            networksRemoved++;
          }
        }
      }
    }

    log.info(`[DockerManager] Prune: containers=${containersRemoved}, networks=${networksRemoved}, volumes=${volumesRemoved}`);
    return { containersRemoved, networksRemoved, volumesRemoved };
  }

  destroy(): void {
    // Stop all health checks
    for (const [id, interval] of this.healthCheckIntervals) {
      clearInterval(interval);
    }
    this.healthCheckIntervals.clear();

    // Stop resource monitor
    if (this.resourceMonitorInterval) {
      clearInterval(this.resourceMonitorInterval);
      this.resourceMonitorInterval = null;
    }

    // Clear all state
    this.containers.clear();
    this.networks.clear();
    this.volumes.clear();
    this.composeStacks.clear();
    this.eventHandlers.clear();

    log.info('[DockerManager] Destroyed');
  }
}

interface DockerEvent {
  action: string;
  containerId: string;
  containerName: string;
  timestamp: string;
}

export type {
  ContainerConfig,
  ContainerState,
  ServiceDefinition,
  ComposeFile,
  ResourceUsage,
  ContainerInspect,
  LogEntry,
  HealthCheckConfig,
  DockerEvent,
};

export default DockerManager;
