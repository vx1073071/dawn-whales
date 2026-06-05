/**
 * Docker Container Management Abstraction
 * 
 * Simulated Docker-like container management with lifecycle control,
 * health checks, resource monitoring, compose orchestration,
 * volume and network management. No actual Docker SDK dependency.
 */

import log from 'electron-log';

// ─── Types & Interfaces ────────────────────────────────────────────────────

interface ContainerConfig {
  name: string;
  image: string;
  tag?: string;
  ports?: PortMapping[];
  env?: Record<string, string>;
  volumes?: VolumeMount[];
  network?: string;
  command?: string[];
  healthCheck?: HealthCheckConfig;
  resources?: ResourceLimits;
  restart?: 'no' | 'always' | 'on-failure' | 'unless-stopped';
  labels?: Record<string, string>;
}

interface PortMapping {
  host: number;
  container: number;
  protocol?: 'tcp' | 'udp';
}

interface VolumeMount {
  source: string;
  target: string;
  readonly?: boolean;
}

interface HealthCheckConfig {
  test: string[];
  interval: number; // seconds
  timeout: number; // seconds
  retries: number;
  startPeriod?: number;
}

interface ResourceLimits {
  cpus?: number;
  memory?: string; // e.g. '512m', '1g'
  memorySwap?: string;
}

interface ContainerInfo {
  id: string;
  name: string;
  image: string;
  tag: string;
  status: ContainerStatus;
  createdAt: Date;
  startedAt?: Date;
  stoppedAt?: Date;
  ports: PortMapping[];
  env: Record<string, string>;
  volumes: VolumeMount[];
  network: string;
  labels: Record<string, string>;
  health: HealthStatus;
  resources: ResourceUsage;
  restartPolicy: string;
  restartCount: number;
  logs: LogEntry[];
  pid?: number;
  exitCode?: number;
}

type ContainerStatus = 'created' | 'running' | 'paused' | 'stopped' | 'removing' | 'dead';
type HealthStatus = 'healthy' | 'unhealthy' | 'starting' | 'none';

interface ResourceUsage {
  cpuPercent: number;
  memoryBytes: number;
  memoryLimit: number;
  networkRx: number;
  networkTx: number;
  pids: number;
}

interface LogEntry {
  timestamp: Date;
  stream: 'stdout' | 'stderr';
  message: string;
}

interface NetworkConfig {
  name: string;
  driver: 'bridge' | 'host' | 'overlay' | 'none';
  subnet?: string;
  gateway?: string;
}

interface NetworkInfo {
  name: string;
  driver: string;
  subnet: string;
  gateway: string;
  containers: string[];
  createdAt: Date;
}

interface VolumeConfig {
  name: string;
  driver?: string;
  labels?: Record<string, string>;
}

interface VolumeInfo {
  name: string;
  driver: string;
  mountpoint: string;
  createdAt: Date;
  sizeBytes: number;
  labels: Record<string, string>;
}

interface ServiceDefinition {
  name: string;
  image: string;
  tag?: string;
  ports?: PortMapping[];
  env?: Record<string, string>;
  volumes?: VolumeMount[];
  network?: string;
  dependsOn?: string[];
  healthCheck?: HealthCheckConfig;
  resources?: ResourceLimits;
  replicas?: number;
}

interface ComposeConfig {
  version: string;
  services: ServiceDefinition[];
  networks?: NetworkConfig[];
  volumes?: VolumeConfig[];
}

// ─── Utility ────────────────────────────────────────────────────────────────

function generateId(): string {
  return Array.from({ length: 12 }, () =>
    Math.floor(Math.random() * 16).toString(16)
  ).join('');
}

function parseMemory(memStr: string): number {
  const match = memStr.match(/^(\d+(?:\.\d+)?)\s*(b|k|m|g|t)?$/i);
  if (!match) return 0;
  const value = parseFloat(match[1]);
  const unit = (match[2] || 'b').toLowerCase();
  const multipliers: Record<string, number> = { b: 1, k: 1024, m: 1048576, g: 1073741824, t: 1099511627776 };
  return value * (multipliers[unit] || 1);
}

function simulateCpuUsage(): number {
  return Math.random() * 15 + 0.5;
}

function simulateMemoryUsage(limit: number): number {
  return Math.random() * limit * 0.6 + limit * 0.1;
}

// ─── Docker Manager ─────────────────────────────────────────────────────────

export class DockerManager {
  private containers: Map<string, ContainerInfo> = new Map();
  private networks: Map<string, NetworkInfo> = new Map();
  private volumes: Map<string, VolumeInfo> = new Map();
  private healthTimers: Map<string, ReturnType<typeof setInterval>> = new Map();
  private resourceTimers: Map<string, ReturnType<typeof setInterval>> = new Map();
  private maxLogs: number = 1000;

  constructor() {
    this.createDefaultNetworks();
    log.info('[DockerManager] Initialized');
  }

  // ─── Default Networks ─────────────────────────────────────────────────

  private createDefaultNetworks(): void {
    this.createNetwork({ name: 'bridge', driver: 'bridge', subnet: '172.17.0.0/16', gateway: '172.17.0.1' });
    this.createNetwork({ name: 'host', driver: 'host' });
    this.createNetwork({ name: 'none', driver: 'none' });
  }

  // ─── Container Lifecycle ──────────────────────────────────────────────

  async createContainer(config: ContainerConfig): Promise<string> {
    const id = generateId();
    const existing = Array.from(this.containers.values()).find(
      (c) => c.name === config.name && c.status !== 'dead'
    );
    if (existing) {
      throw new Error(`Container with name "${config.name}" already exists (id: ${existing.id})`);
    }

    const network = config.network || 'bridge';
    if (!this.networks.has(network)) {
      throw new Error(`Network "${network}" not found`);
    }

    const container: ContainerInfo = {
      id,
      name: config.name,
      image: config.image,
      tag: config.tag || 'latest',
      status: 'created',
      createdAt: new Date(),
      ports: config.ports || [],
      env: config.env || {},
      volumes: config.volumes || [],
      network,
      labels: config.labels || {},
      health: 'none',
      resources: { cpuPercent: 0, memoryBytes: 0, memoryLimit: 0, networkRx: 0, networkTx: 0, pids: 0 },
      restartPolicy: config.restart || 'no',
      restartCount: 0,
      logs: [],
    };

    if (config.resources?.memory) {
      container.resources.memoryLimit = parseMemory(config.resources.memory);
    }

    this.containers.set(id, container);
    this.addLog(container, 'stdout', `Container created: ${config.image}:${container.tag}`);
    log.info(`[DockerManager] Container created: ${config.name} (${id})`);
    return id;
  }

  async startContainer(id: string): Promise<void> {
    const container = this.getContainer(id);
    if (container.status === 'running') {
      log.warn(`[DockerManager] Container ${container.name} already running`);
      return;
    }

    container.status = 'running';
    container.startedAt = new Date();
    container.stoppedAt = undefined;
    container.exitCode = undefined;
    container.pid = Math.floor(Math.random() * 30000) + 1000;
    container.health = container.health !== 'none' ? 'starting' : 'none';

    this.addLog(container, 'stdout', `Container started (pid: ${container.pid})`);
    this.startHealthCheck(container);
    this.startResourceMonitoring(container);
    log.info(`[DockerManager] Container started: ${container.name} (${id})`);
  }

  async stopContainer(id: string, timeout: number = 10): Promise<void> {
    const container = this.getContainer(id);
    if (container.status !== 'running' && container.status !== 'paused') {
      log.warn(`[DockerManager] Container ${container.name} is not running`);
      return;
    }

    this.addLog(container, 'stdout', `Stopping container (timeout: ${timeout}s)...`);
    this.stopHealthCheck(id);
    this.stopResourceMonitoring(id);

    container.status = 'stopped';
    container.stoppedAt = new Date();
    container.exitCode = 0;
    container.pid = undefined;
    container.health = 'none';
    container.resources = { cpuPercent: 0, memoryBytes: 0, memoryLimit: container.resources.memoryLimit, networkRx: 0, networkTx: 0, pids: 0 };

    this.addLog(container, 'stdout', 'Container stopped');
    log.info(`[DockerManager] Container stopped: ${container.name} (${id})`);
  }

  async restartContainer(id: string): Promise<void> {
    const container = this.getContainer(id);
    await this.stopContainer(id, 5);
    container.restartCount++;
    await this.startContainer(id);
    this.addLog(container, 'stdout', `Container restarted (count: ${container.restartCount})`);
  }

  async removeContainer(id: string, force: boolean = false): Promise<void> {
    const container = this.getContainer(id);
    if (container.status === 'running' && !force) {
      throw new Error(`Container ${container.name} is running. Use force=true to remove.`);
    }

    this.stopHealthCheck(id);
    this.stopResourceMonitoring(id);
    container.status = 'dead';
    this.containers.delete(id);
    log.info(`[DockerManager] Container removed: ${container.name} (${id})`);
  }

  async pauseContainer(id: string): Promise<void> {
    const container = this.getContainer(id);
    if (container.status !== 'running') {
      throw new Error(`Container ${container.name} is not running`);
    }
    container.status = 'paused';
    this.addLog(container, 'stdout', 'Container paused');
  }

  async unpauseContainer(id: string): Promise<void> {
    const container = this.getContainer(id);
    if (container.status !== 'paused') {
      throw new Error(`Container ${container.name} is not paused`);
    }
    container.status = 'running';
    this.addLog(container, 'stdout', 'Container unpaused');
  }

  inspectContainer(id: string): ContainerInfo {
    return { ...this.getContainer(id) };
  }

  async logs(id: string, options?: { tail?: number; since?: Date; follow?: boolean }): Promise<LogEntry[]> {
    const container = this.getContainer(id);
    let entries = [...container.logs];

    if (options?.since) {
      entries = entries.filter((e) => e.timestamp >= options.since!);
    }
    if (options?.tail) {
      entries = entries.slice(-options.tail);
    }
    return entries;
  }

  // ─── Health Checks ────────────────────────────────────────────────────

  private startHealthCheck(container: ContainerInfo): void {
    // Default health check for known services
    const defaultChecks: Record<string, HealthCheckConfig> = {
      redis: { test: ['CMD', 'redis-cli', 'ping'], interval: 10, timeout: 3, retries: 3 },
      postgres: { test: ['CMD', 'pg_isready'], interval: 10, timeout: 5, retries: 5 },
      prometheus: { test: ['CMD', 'wget', '-qO-', 'http://localhost:9090/-/healthy'], interval: 15, timeout: 5, retries: 3 },
      grafana: { test: ['CMD', 'wget', '-qO-', 'http://localhost:3000/api/health'], interval: 15, timeout: 5, retries: 3 },
    };

    const check = defaultChecks[container.image] || { test: ['CMD', 'true'], interval: 30, timeout: 5, retries: 3 };

    let attempts = 0;
    const timer = setInterval(() => {
      if (container.status !== 'running') {
        this.stopHealthCheck(container.id);
        return;
      }

      // Simulate health check - mostly healthy with occasional starting
      attempts++;
      if (attempts <= 2) {
        container.health = 'starting';
      } else {
        // 95% chance healthy, 5% unhealthy for simulation
        container.health = Math.random() > 0.05 ? 'healthy' : 'unhealthy';
      }
    }, check.interval * 1000);

    this.healthTimers.set(container.id, timer);
  }

  private stopHealthCheck(id: string): void {
    const timer = this.healthTimers.get(id);
    if (timer) {
      clearInterval(timer);
      this.healthTimers.delete(id);
    }
  }

  // ─── Resource Monitoring ──────────────────────────────────────────────

  private startResourceMonitoring(container: ContainerInfo): void {
    const timer = setInterval(() => {
      if (container.status !== 'running') {
        this.stopResourceMonitoring(container.id);
        return;
      }

      const memLimit = container.resources.memoryLimit || 536870912; // 512MB default
      container.resources.cpuPercent = simulateCpuUsage();
      container.resources.memoryBytes = simulateMemoryUsage(memLimit);
      container.resources.memoryLimit = memLimit;
      container.resources.networkRx += Math.random() * 10000;
      container.resources.networkTx += Math.random() * 5000;
      container.resources.pids = Math.floor(Math.random() * 20) + 5;
    }, 5000);

    this.resourceTimers.set(container.id, timer);
  }

  private stopResourceMonitoring(id: string): void {
    const timer = this.resourceTimers.get(id);
    if (timer) {
      clearInterval(timer);
      this.resourceTimers.delete(id);
    }
  }

  // ─── Logs ─────────────────────────────────────────────────────────────

  private addLog(container: ContainerInfo, stream: 'stdout' | 'stderr', message: string): void {
    container.logs.push({ timestamp: new Date(), stream, message });
    if (container.logs.length > this.maxLogs) {
      container.logs.shift();
    }
  }

  // ─── Network Management ───────────────────────────────────────────────

  createNetwork(config: NetworkConfig): string {
    const info: NetworkInfo = {
      name: config.name,
      driver: config.driver,
      subnet: config.subnet || '172.18.0.0/16',
      gateway: config.gateway || '172.18.0.1',
      containers: [],
      createdAt: new Date(),
    };
    this.networks.set(config.name, info);
    log.info(`[DockerManager] Network created: ${config.name} (${config.driver})`);
    return config.name;
  }

  removeNetwork(name: string): void {
    const network = this.networks.get(name);
    if (!network) throw new Error(`Network "${name}" not found`);
    if (network.containers.length > 0) {
      throw new Error(`Network "${name}" has active containers`);
    }
    if (['bridge', 'host', 'none'].includes(name)) {
      throw new Error(`Cannot remove default network "${name}"`);
    }
    this.networks.delete(name);
    log.info(`[DockerManager] Network removed: ${name}`);
  }

  listNetworks(): NetworkInfo[] {
    return Array.from(this.networks.values());
  }

  connectToNetwork(containerId: string, networkName: string): void {
    const container = this.getContainer(containerId);
    const network = this.networks.get(networkName);
    if (!network) throw new Error(`Network "${networkName}" not found`);
    container.network = networkName;
    if (!network.containers.includes(containerId)) {
      network.containers.push(containerId);
    }
  }

  disconnectFromNetwork(containerId: string, networkName: string): void {
    const network = this.networks.get(networkName);
    if (!network) return;
    network.containers = network.containers.filter((id) => id !== containerId);
  }

  // ─── Volume Management ────────────────────────────────────────────────

  createVolume(config: VolumeConfig): string {
    const info: VolumeInfo = {
      name: config.name,
      driver: config.driver || 'local',
      mountpoint: `/var/lib/docker/volumes/${config.name}/_data`,
      createdAt: new Date(),
      sizeBytes: 0,
      labels: config.labels || {},
    };
    this.volumes.set(config.name, info);
    log.info(`[DockerManager] Volume created: ${config.name}`);
    return config.name;
  }

  removeVolume(name: string): void {
    if (!this.volumes.has(name)) throw new Error(`Volume "${name}" not found`);
    // Check if any running container uses this volume
    for (const container of this.containers.values()) {
      if (container.status === 'running') {
        const inUse = container.volumes.some((v) => v.source === name);
        if (inUse) throw new Error(`Volume "${name}" is in use by container ${container.name}`);
      }
    }
    this.volumes.delete(name);
    log.info(`[DockerManager] Volume removed: ${name}`);
  }

  listVolumes(): VolumeInfo[] {
    return Array.from(this.volumes.values());
  }

  inspectVolume(name: string): VolumeInfo {
    const vol = this.volumes.get(name);
    if (!vol) throw new Error(`Volume "${name}" not found`);
    return { ...vol };
  }

  // ─── Compose Orchestration ────────────────────────────────────────────

  async up(config: ComposeConfig): Promise<Map<string, string>> {
    log.info(`[DockerManager] Compose up: ${config.services.length} services`);
    const containerIds = new Map<string, string>();

    // Create networks
    if (config.networks) {
      for (const net of config.networks) {
        if (!this.networks.has(net.name)) {
          this.createNetwork(net);
        }
      }
    }

    // Create volumes
    if (config.volumes) {
      for (const vol of config.volumes) {
        if (!this.volumes.has(vol.name)) {
          this.createVolume(vol);
        }
      }
    }

    // Sort services by dependency
    const sorted = this.topologicalSort(config.services);

    // Create and start containers in order
    for (const service of sorted) {
      const replicas = service.replicas || 1;
      for (let i = 1; i <= replicas; i++) {
        const name = replicas > 1 ? `${service.name}-${i}` : service.name;
        const id = await this.createContainer({
          name,
          image: service.image,
          tag: service.tag,
          ports: service.ports,
          env: service.env,
          volumes: service.volumes,
          network: service.network || 'bridge',
          healthCheck: service.healthCheck,
          resources: service.resources,
          restart: 'unless-stopped',
          labels: { 'compose.service': service.name, 'compose.replica': String(i) },
        });

        await this.startContainer(id);
        containerIds.set(name, id);

        // Small delay to simulate startup
        await this.sleep(100);
      }
    }

    log.info(`[DockerManager] Compose up complete: ${containerIds.size} containers`);
    return containerIds;
  }

  async down(options?: { removeVolumes?: boolean; removeNetworks?: boolean }): Promise<void> {
    log.info('[DockerManager] Compose down');

    // Stop and remove all compose containers
    const toRemove: string[] = [];
    for (const [id, container] of this.containers) {
      if (container.labels['compose.service']) {
        toRemove.push(id);
      }
    }

    for (const id of toRemove) {
      try {
        await this.stopContainer(id);
        await this.removeContainer(id, true);
      } catch (err) {
        log.warn(`[DockerManager] Error removing container: ${err}`);
      }
    }

    if (options?.removeVolumes) {
      const toRemoveVols: string[] = [];
      for (const [name, vol] of this.volumes) {
        if (vol.labels['compose.volume']) {
          toRemoveVols.push(name);
        }
      }
      for (const name of toRemoveVols) {
        try { this.removeVolume(name); } catch { /* ignore */ }
      }
    }

    if (options?.removeNetworks) {
      const toRemoveNets: string[] = [];
      for (const [name, net] of this.networks) {
        if (!['bridge', 'host', 'none'].includes(name) && net.containers.length === 0) {
          toRemoveNets.push(name);
        }
      }
      for (const name of toRemoveNets) {
        try { this.removeNetwork(name); } catch { /* ignore */ }
      }
    }

    log.info('[DockerManager] Compose down complete');
  }

  async scale(serviceName: string, replicas: number): Promise<void> {
    const existing = Array.from(this.containers.values()).filter(
      (c) => c.labels['compose.service'] === serviceName
    );

    const currentCount = existing.length;
    if (replicas > currentCount) {
      // Scale up
      const baseService = existing[0];
      if (!baseService) throw new Error(`Service "${serviceName}" not found`);

      for (let i = currentCount + 1; i <= replicas; i++) {
        const name = `${serviceName}-${i}`;
        const id = await this.createContainer({
          name,
          image: baseService.image,
          tag: baseService.tag,
          ports: baseService.ports,
          env: baseService.env,
          volumes: baseService.volumes,
          network: baseService.network,
          labels: { 'compose.service': serviceName, 'compose.replica': String(i) },
        });
        await this.startContainer(id);
      }
    } else if (replicas < currentCount) {
      // Scale down
      const toRemove = existing.slice(replicas);
      for (const container of toRemove) {
        await this.stopContainer(container.id);
        await this.removeContainer(container.id, true);
      }
    }

    log.info(`[DockerManager] Scaled ${serviceName} to ${replicas} replicas`);
  }

  // ─── Topological Sort ─────────────────────────────────────────────────

  private topologicalSort(services: ServiceDefinition[]): ServiceDefinition[] {
    const map = new Map<string, ServiceDefinition>();
    const visited = new Set<string>();
    const result: ServiceDefinition[] = [];

    for (const s of services) {
      map.set(s.name, s);
    }

    const visit = (name: string) => {
      if (visited.has(name)) return;
      visited.add(name);
      const service = map.get(name);
      if (service?.dependsOn) {
        for (const dep of service.dependsOn) {
          visit(dep);
        }
      }
      if (service) result.push(service);
    };

    for (const s of services) {
      visit(s.name);
    }

    return result;
  }

  // ─── Predefined Service Definitions ───────────────────────────────────

  static getDefaultServices(): ComposeConfig {
    return {
      version: '3.8',
      networks: [
        { name: 'dawn-whales', driver: 'bridge', subnet: '172.20.0.0/16', gateway: '172.20.0.1' },
      ],
      volumes: [
        { name: 'redis-data', labels: { 'compose.volume': 'true' } },
        { name: 'postgres-data', labels: { 'compose.volume': 'true' } },
        { name: 'prometheus-data', labels: { 'compose.volume': 'true' } },
        { name: 'grafana-data', labels: { 'compose.volume': 'true' } },
      ],
      services: [
        {
          name: 'redis',
          image: 'redis',
          tag: '7-alpine',
          ports: [{ host: 6379, container: 6379 }],
          volumes: [{ source: 'redis-data', target: '/data' }],
          network: 'dawn-whales',
          healthCheck: { test: ['CMD', 'redis-cli', 'ping'], interval: 10, timeout: 3, retries: 3 },
          resources: { cpus: 0.5, memory: '256m' },
        },
        {
          name: 'postgres',
          image: 'postgres',
          tag: '16-alpine',
          ports: [{ host: 5432, container: 5432 }],
          env: {
            POSTGRES_USER: 'dawnwhales',
            POSTGRES_PASSWORD: 'changeme',
            POSTGRES_DB: 'dawnwhales',
          },
          volumes: [{ source: 'postgres-data', target: '/var/lib/postgresql/data' }],
          network: 'dawn-whales',
          healthCheck: { test: ['CMD', 'pg_isready', '-U', 'dawnwhales'], interval: 10, timeout: 5, retries: 5 },
          resources: { cpus: 1, memory: '512m' },
        },
        {
          name: 'prometheus',
          image: 'prometheus',
          tag: 'latest',
          ports: [{ host: 9090, container: 9090 }],
          volumes: [{ source: 'prometheus-data', target: '/prometheus' }],
          network: 'dawn-whales',
          dependsOn: ['redis', 'postgres'],
          healthCheck: { test: ['CMD', 'wget', '-qO-', 'http://localhost:9090/-/healthy'], interval: 15, timeout: 5, retries: 3 },
          resources: { cpus: 0.5, memory: '256m' },
        },
        {
          name: 'grafana',
          image: 'grafana',
          tag: 'latest',
          ports: [{ host: 3000, container: 3000 }],
          env: { GF_SECURITY_ADMIN_PASSWORD: 'admin' },
          volumes: [{ source: 'grafana-data', target: '/var/lib/grafana' }],
          network: 'dawn-whales',
          dependsOn: ['prometheus'],
          healthCheck: { test: ['CMD', 'wget', '-qO-', 'http://localhost:3000/api/health'], interval: 15, timeout: 5, retries: 3 },
          resources: { cpus: 0.5, memory: '256m' },
        },
      ],
    };
  }

  // ─── Utility ──────────────────────────────────────────────────────────

  private getContainer(id: string): ContainerInfo {
    // Try by ID first, then by name
    const byId = this.containers.get(id);
    if (byId) return byId;

    const byName = Array.from(this.containers.values()).find((c) => c.name === id);
    if (byName) return byName;

    throw new Error(`Container not found: ${id}`);
  }

  listContainers(filter?: { status?: ContainerStatus; label?: string }): ContainerInfo[] {
    let result = Array.from(this.containers.values());
    if (filter?.status) {
      result = result.filter((c) => c.status === filter.status);
    }
    if (filter?.label) {
      const [key, value] = filter.label.split('=');
      result = result.filter((c) => {
        if (value) return c.labels[key] === value;
        return key in c.labels;
      });
    }
    return result;
  }

  async prune(): Promise<{ containers: number; volumes: number; networks: number }> {
    let containers = 0;
    let volumes = 0;
    let networks = 0;

    // Remove dead/stopped containers
    for (const [id, c] of this.containers) {
      if (c.status === 'dead' || c.status === 'stopped') {
        this.containers.delete(id);
        containers++;
      }
    }

    // Remove unused volumes
    for (const [name, vol] of this.volumes) {
      const inUse = Array.from(this.containers.values()).some(
        (c) => c.volumes.some((v) => v.source === name) && c.status === 'running'
      );
      if (!inUse) {
        this.volumes.delete(name);
        volumes++;
      }
    }

    // Remove unused networks
    for (const [name, net] of this.networks) {
      if (!['bridge', 'host', 'none'].includes(name) && net.containers.length === 0) {
        this.networks.delete(name);
        networks++;
      }
    }

    log.info(`[DockerManager] Prune: ${containers} containers, ${volumes} volumes, ${networks} networks`);
    return { containers, volumes, networks };
  }

  getResourceUsage(): Record<string, ResourceUsage> {
    const result: Record<string, ResourceUsage> = {};
    for (const [id, container] of this.containers) {
      if (container.status === 'running') {
        result[container.name] = { ...container.resources };
      }
    }
    return result;
  }

  shutdown(): void {
    for (const timer of this.healthTimers.values()) clearInterval(timer);
    for (const timer of this.resourceTimers.values()) clearInterval(timer);
    this.healthTimers.clear();
    this.resourceTimers.clear();
    log.info('[DockerManager] Shutdown complete');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ─── Singleton ──────────────────────────────────────────────────────────────

let instance: DockerManager | null = null;

export function getDockerManager(): DockerManager {
  if (!instance) {
    instance = new DockerManager();
  }
  return instance;
}

export function destroyDockerManager(): void {
  if (instance) {
    instance.shutdown();
    instance = null;
  }
}

// ─── Default Export ─────────────────────────────────────────────────────────

export default DockerManager;
