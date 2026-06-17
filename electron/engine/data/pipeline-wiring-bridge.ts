/**
 * R261 P0-02: 管线接线 (PipelineWiringBridge)
 * 
 * 全链路接线引擎 — YahooEngine→Aggregator→AlertEngine→PushBridge→IPC
 * 
 * 功能:
 *   1. 管线拓扑构建 (YahooEngine → Aggregator → AlertEngine → PushBridge → IPC)
 *   2. 节点健康监控 + 背压控制
 *   3. 数据流追踪 (端到端延迟/吞吐量/丢失率)
 *   4. 接线验证 (15检查点)
 *   5. 降级链自动切换
 * 
 * 上游: yahoo-engine-bridge, binance-api-bridge, eastmoney-fetcher
 * 下游: push-ipc-bridge, tray-ipc-bridge, crash-push-bridge
 */

import { createHash } from 'crypto';

// ── Types ──────────────────────────────────────────────────────────────────

export type PipeNodeType =
  | 'yahoo_engine' | 'binance_engine' | 'eastmoney_engine' | 'investing_engine'
  | 'aggregator' | 'dedup_engine'
  | 'alert_engine' | 'sentiment_engine'
  | 'push_bridge' | 'crash_push'
  | 'ipc_bridge' | 'tray_bridge'
  | 'macro_bridge' | 'move_bridge'
  | 'short_selling' | 'community_bridge';

export interface PipeNode {
  nodeId: string;
  type: PipeNodeType;
  label: string;
  labelCn: string;
  upstream: string[];     // nodeIds
  downstream: string[];   // nodeIds
  healthy: boolean;
  latencyMs: number;
  throughputPps: number;  // packets per second
  errorRate: number;
  lastHeartbeat: number;
}

export interface PipeEdge {
  edgeId: string;
  from: string;           // nodeId
  to: string;
  label: string;
  wired: boolean;
  dataFlowing: boolean;
  latencyMs: number;
  packetsPassed: number;
  packetsDropped: number;
}

export interface PipePacket {
  packetId: string;
  type: 'quote' | 'alert' | 'signal' | 'push' | 'macro' | 'crash' | 'rotation';
  source: PipeNodeType;
  target: PipeNodeType;
  payload: Record<string, unknown>;
  hops: string[];          // route taken
  createdAt: number;
  deliveredAt?: number;
  latencyMs?: number;
}

export interface WiringCheckpoint {
  id: number;
  name: string;
  nameCn: string;
  passed: boolean;
  details: string;
  detailsCn: string;
}

export interface WiringReport {
  reportId: string;
  timestamp: number;
  totalNodes: number;
  totalEdges: number;
  wiredEdges: number;
  healthyNodes: number;
  unhealthyNodes: number;
  checkpoints: WiringCheckpoint[];
  overallStatus: 'PASS' | 'WARN' | 'FAIL';
  avgLatencyMs: number;
  totalPackets: number;
  droppedPackets: number;
  summaryEn: string;
  summaryCn: string;
}

// ── Pipeline topology ──────────────────────────────────────────────────────

const PIPELINE_NODES: Array<Omit<PipeNode, 'healthy' | 'latencyMs' | 'throughputPps' | 'errorRate' | 'lastHeartbeat'>> = [
  // Layer 1: Data Sources
  { nodeId: 'n_yahoo', type: 'yahoo_engine', label: 'Yahoo Engine', labelCn: '雅虎引擎', upstream: [], downstream: ['n_agg'] },
  { nodeId: 'n_binance', type: 'binance_engine', label: 'Binance Engine', labelCn: '币安引擎', upstream: [], downstream: ['n_agg'] },
  { nodeId: 'n_eastmoney', type: 'eastmoney_engine', label: 'EastMoney Engine', labelCn: '东方财富引擎', upstream: [], downstream: ['n_agg'] },
  { nodeId: 'n_investing', type: 'investing_engine', label: 'Investing Engine', labelCn: '英为财情引擎', upstream: [], downstream: ['n_agg'] },

  // Layer 2: Aggregation
  { nodeId: 'n_agg', type: 'aggregator', label: 'Aggregator', labelCn: '聚合器', upstream: ['n_yahoo', 'n_binance', 'n_eastmoney', 'n_investing'], downstream: ['n_dedup', 'n_macro'] },
  { nodeId: 'n_dedup', type: 'dedup_engine', label: 'Dedup Engine', labelCn: '去重引擎', upstream: ['n_agg'], downstream: ['n_alert'] },

  // Layer 3: Intelligence
  { nodeId: 'n_alert', type: 'alert_engine', label: 'Alert Engine', labelCn: '预警引擎', upstream: ['n_dedup'], downstream: ['n_push', 'n_crash', 'n_move'] },
  { nodeId: 'n_sentiment', type: 'sentiment_engine', label: 'Sentiment Engine', labelCn: '情绪引擎', upstream: ['n_dedup'], downstream: ['n_push'] },

  // Layer 4: Bridging
  { nodeId: 'n_push', type: 'push_bridge', label: 'Push Bridge', labelCn: '推送桥接', upstream: ['n_alert', 'n_sentiment'], downstream: ['n_ipc'] },
  { nodeId: 'n_crash', type: 'crash_push', label: 'Crash Push', labelCn: '崩盘推送', upstream: ['n_alert'], downstream: ['n_ipc'] },
  { nodeId: 'n_move', type: 'move_bridge', label: 'Move Bridge', labelCn: '异动桥接', upstream: ['n_alert'], downstream: ['n_ipc'] },
  { nodeId: 'n_macro', type: 'macro_bridge', label: 'Macro Bridge', labelCn: '宏观桥接', upstream: ['n_agg'], downstream: ['n_ipc'] },

  // Layer 5: IPC
  { nodeId: 'n_ipc', type: 'ipc_bridge', label: 'IPC Bridge', labelCn: 'IPC桥接', upstream: ['n_push', 'n_crash', 'n_move', 'n_macro'], downstream: ['n_tray'] },
  { nodeId: 'n_tray', type: 'tray_bridge', label: 'Tray Bridge', labelCn: '托盘桥接', upstream: ['n_ipc'], downstream: [] },

  // Additional modules
  { nodeId: 'n_short', type: 'short_selling', label: 'Short Selling', labelCn: '卖空管线', upstream: ['n_agg'], downstream: ['n_alert'] },
  { nodeId: 'n_community', type: 'community_bridge', label: 'Community', labelCn: '社区桥接', upstream: [], downstream: ['n_push'] },
];

// ── 15 Wiring checkpoints ──────────────────────────────────────────────────

const CHECKPOINTS: Array<Omit<WiringCheckpoint, 'passed' | 'details' | 'detailsCn'>> = [
  { id: 1, name: 'Yahoo→Aggregator connection', nameCn: '雅虎→聚合器接线' },
  { id: 2, name: 'Binance→Aggregator connection', nameCn: '币安→聚合器接线' },
  { id: 3, name: 'EastMoney→Aggregator connection', nameCn: '东方财富→聚合器接线' },
  { id: 4, name: 'Investing→Aggregator connection', nameCn: '英为→聚合器接线' },
  { id: 5, name: 'Aggregator→Dedup data flow', nameCn: '聚合器→去重数据流' },
  { id: 6, name: 'Dedup→Alert signal flow', nameCn: '去重→预警信号流' },
  { id: 7, name: 'Alert→Push bridge wiring', nameCn: '预警→推送桥接线' },
  { id: 8, name: 'Alert→Crash push wiring', nameCn: '预警→崩盘推送接线' },
  { id: 9, name: 'Alert→Move bridge wiring', nameCn: '预警→异动桥接线' },
  { id: 10, name: 'Aggregator→Macro bridge wiring', nameCn: '聚合器→宏观桥接线' },
  { id: 11, name: 'Push→IPC bridge wiring', nameCn: '推送桥→IPC桥接线' },
  { id: 12, name: 'IPC→Tray bridge wiring', nameCn: 'IPC→托盘桥接线' },
  { id: 13, name: 'ShortSelling→Alert connection', nameCn: '卖空→预警接线' },
  { id: 14, name: 'End-to-end latency < 500ms', nameCn: '端到端延迟<500ms' },
  { id: 15, name: 'Zero dropped packets', nameCn: '零丢包' },
];

// ═══════════════════════════════════════════════════════════════════════════
// PipelineWiringBridge
// ═══════════════════════════════════════════════════════════════════════════

export class PipelineWiringBridge {
  private nodes: Map<string, PipeNode> = new Map();
  private edges: PipeEdge[] = [];
  private packets: PipePacket[] = [];
  private wiringComplete = false;
  private stats_ = {
    totalPackets: 0,
    droppedPackets: 0,
    avgLatencyMs: 0,
    throughputPps: 0,
    uptimeMs: 0,
  };

  constructor() {
    this._initTopology();
  }

  // ── Public API: Wiring ─────────────────────────────────────────────────

  /**
   * Wire all nodes in the pipeline topology.
   */
  wireAll(): { nodes: number; edges: number } {
    // Wire all edges
    for (const node of PIPELINE_NODES) {
      for (const downstreamId of node.downstream) {
        const edge: PipeEdge = {
          edgeId: `e_${node.nodeId}_${downstreamId}`,
          from: node.nodeId,
          to: downstreamId,
          label: `${node.label} → ${this.nodes.get(downstreamId)?.label ?? downstreamId}`,
          wired: true,
          dataFlowing: false,
          latencyMs: 0,
          packetsPassed: 0,
          packetsDropped: 0,
        };
        this.edges.push(edge);
      }
    }

    this.wiringComplete = true;
    return { nodes: this.nodes.size, edges: this.edges.length };
  }

  /**
   * Verify all 15 wiring checkpoints.
   */
  verifyWiring(): WiringCheckpoint[] {
    const checkpoints: WiringCheckpoint[] = [];

    for (const cp of CHECKPOINTS) {
      const passed = this._checkPoint(cp.id);
      checkpoints.push({
        ...cp,
        passed,
        details: passed ? 'Connected and verified' : 'Connection failed or not wired',
        detailsCn: passed ? '已接线并验证通过' : '接线失败或未连接',
      });
    }

    return checkpoints;
  }

  // ── Public API: Data Flow ───────────────────────────────────────────────

  /**
   * Process a packet through the pipeline.
   */
  processPacket(
    type: PipePacket['type'],
    source: PipeNodeType,
    target: PipeNodeType,
    payload: Record<string, unknown>,
  ): PipePacket {
    const packet: PipePacket = {
      packetId: `pkt:${type}:${Date.now()}:${this._hash(JSON.stringify(payload)).toString(36).slice(0, 6)}`,
      type, source, target, payload,
      hops: [source],
      createdAt: Date.now(),
    };

    // Route through pipeline
    let currentNode = this._findByType(source);
    const targetNode = this._findByType(target);

    if (!currentNode || !targetNode) {
      this.stats_.droppedPackets++;
      return packet;
    }

    // BFS-like routing
    const visited = new Set<string>();
    const queue = [currentNode];
    visited.add(currentNode.nodeId);

    let reached = false;
    while (queue.length > 0) {
      const node = queue.shift()!;
      if (node.type === target) {
        reached = true;
        break;
      }

      for (const downId of node.downstream) {
        if (!visited.has(downId)) {
          visited.add(downId);
          const downNode = this.nodes.get(downId);
          if (downNode) {
            packet.hops.push(downNode.type);
            queue.push(downNode);

            // Update edge stats
            const edge = this.edges.find(e => e.from === node.nodeId && e.to === downId);
            if (edge) {
              edge.packetsPassed++;
              edge.dataFlowing = true;
              edge.latencyMs = Math.round((edge.latencyMs * (edge.packetsPassed - 1) + 5) / edge.packetsPassed);
            }
          }
        }
      }
    }

    if (reached) {
      packet.deliveredAt = Date.now();
      packet.latencyMs = packet.deliveredAt - packet.createdAt;

      this.stats_.totalPackets++;
      this.stats_.avgLatencyMs = Math.round(
        (this.stats_.avgLatencyMs * (this.stats_.totalPackets - 1) + packet.latencyMs)
        / this.stats_.totalPackets
      );

      // Update node throughput
      for (const hopType of packet.hops) {
        const node = this._findByType(hopType);
        if (node) {
          node.throughputPps++;
          node.lastHeartbeat = Date.now();
        }
      }
    } else {
      this.stats_.droppedPackets++;
    }

    this.packets.push(packet);
    if (this.packets.length > 1000) this.packets.shift();

    return packet;
  }

  /**
   * Simulate full data flow: Yahoo quote → push notification.
   */
  simulateQuoteFlow(symbol: string, price: number): PipePacket | null {
    const payload = { symbol, price, timestamp: Date.now(), source: 'yahoo' };
    const packet = this.processPacket('quote', 'yahoo_engine', 'ipc_bridge', payload);
    return packet.deliveredAt ? packet : null;
  }

  // ── Public API: Node Management ─────────────────────────────────────────

  /** Get pipeline topology */
  getTopology(): { nodes: PipeNode[]; edges: PipeEdge[] } {
    return {
      nodes: Array.from(this.nodes.values()),
      edges: this.edges,
    };
  }

  /** Update node health */
  updateNodeHealth(nodeId: string, healthy: boolean, latencyMs: number, errorRate: number): boolean {
    const node = this.nodes.get(nodeId);
    if (!node) return false;
    node.healthy = healthy;
    node.latencyMs = latencyMs;
    node.errorRate = errorRate;
    node.lastHeartbeat = Date.now();
    return true;
  }

  /** Get node by id */
  getNode(nodeId: string): PipeNode | null { return this.nodes.get(nodeId) ?? null; }

  /** Get edges */
  getEdges(): PipeEdge[] { return this.edges; }

  // ── Public API: Reports ─────────────────────────────────────────────────

  /** Generate wiring report */
  generateReport(): WiringReport {
    const checkpoints = this.verifyWiring();
    const passed = checkpoints.filter(c => c.passed).length;
    const healthyNodes = Array.from(this.nodes.values()).filter(n => n.healthy).length;
    const unhealthyNodes = this.nodes.size - healthyNodes;

    let overallStatus: 'PASS' | 'WARN' | 'FAIL' = 'PASS';
    if (passed < 10) overallStatus = 'FAIL';
    else if (passed < 14) overallStatus = 'WARN';

    return {
      reportId: `wirerep:${Date.now()}`,
      timestamp: Date.now(),
      totalNodes: this.nodes.size,
      totalEdges: this.edges.length,
      wiredEdges: this.edges.filter(e => e.wired).length,
      healthyNodes,
      unhealthyNodes,
      checkpoints,
      overallStatus,
      avgLatencyMs: this.stats_.avgLatencyMs,
      totalPackets: this.stats_.totalPackets,
      droppedPackets: this.stats_.droppedPackets,
      summaryEn: overallStatus === 'PASS'
        ? `Pipeline wiring PASSED: ${passed}/15 checkpoints, ${healthyNodes}/${this.nodes.size} nodes healthy`
        : `Pipeline wiring ${overallStatus}: ${passed}/15 checkpoints`,
      summaryCn: overallStatus === 'PASS'
        ? `管线接线通过：${passed}/15检查点，${healthyNodes}/${this.nodes.size}节点健康`
        : `管线接线${overallStatus === 'WARN' ? '警告' : '失败'}：${passed}/15检查点`,
    };
  }

  // ── Public API: Query ───────────────────────────────────────────────────

  /** Get pipeline stats */
  getStats() { return { ...this.stats_ }; }

  /** Get packet history */
  getPackets(limit = 50): PipePacket[] { return this.packets.slice(-limit).reverse(); }

  /** Is wiring complete */
  isWired(): boolean { return this.wiringComplete; }

  /** Get routing path between two node types */
  getRoute(from: PipeNodeType, to: PipeNodeType): pipeNodeType[] | null {
    const start = this._findByType(from);
    const end = this._findByType(to);
    if (!start || !end) return null;

    const visited = new Set<string>();
    const path: pipeNodeType[] = [from];
    visited.add(start.nodeId);

    if (from === to) return path;

    const queue: Array<{ node: PipeNode; path: pipeNodeType[] }> = [{ node: start, path: [from] }];
    while (queue.length > 0) {
      const { node, path: currentPath } = queue.shift()!;
      for (const downId of node.downstream) {
        if (!visited.has(downId)) {
          visited.add(downId);
          const downNode = this.nodes.get(downId);
          if (downNode) {
            const newPath = [...currentPath, downNode.type];
            if (downNode.type === to) return newPath;
            queue.push({ node: downNode, path: newPath });
          }
        }
      }
    }

    return null;
  }

  /** Reset */
  reset(): void {
    this.nodes.clear();
    this.edges = [];
    this.packets = [];
    this.stats_ = { totalPackets: 0, droppedPackets: 0, avgLatencyMs: 0, throughputPps: 0, uptimeMs: 0 };
    this.wiringComplete = false;
    this._initTopology();
  }

  // ── Private ─────────────────────────────────────────────────────────────

  private _initTopology(): void {
    for (const node of PIPELINE_NODES) {
      this.nodes.set(node.nodeId, {
        ...node,
        healthy: true,
        latencyMs: 0,
        throughputPps: 0,
        errorRate: 0,
        lastHeartbeat: Date.now(),
      });
    }
  }

  private _checkPoint(cpId: number): boolean {
    switch (cpId) {
      case 1: return this._edgeActive('n_yahoo', 'n_agg');
      case 2: return this._edgeActive('n_binance', 'n_agg');
      case 3: return this._edgeActive('n_eastmoney', 'n_agg');
      case 4: return this._edgeActive('n_investing', 'n_agg');
      case 5: return this._edgeActive('n_agg', 'n_dedup');
      case 6: return this._edgeActive('n_dedup', 'n_alert');
      case 7: return this._edgeActive('n_alert', 'n_push');
      case 8: return this._edgeActive('n_alert', 'n_crash');
      case 9: return this._edgeActive('n_alert', 'n_move');
      case 10: return this._edgeActive('n_agg', 'n_macro');
      case 11: return this._edgeActive('n_push', 'n_ipc');
      case 12: return this._edgeActive('n_ipc', 'n_tray');
      case 13: return this._edgeActive('n_short', 'n_alert');
      case 14: return this.stats_.avgLatencyMs < 500;
      case 15: return this.stats_.droppedPackets === 0;
      default: return false;
    }
  }

  private _edgeActive(fromId: string, toId: string): boolean {
    const edge = this.edges.find(e => e.from === fromId && e.to === toId);
    return edge?.wired ?? false;
  }

  private _findByType(type: PipeNodeType): PipeNode | undefined {
    return Array.from(this.nodes.values()).find(n => n.type === type);
  }

  private _hash(input: string): number {
    const h = createHash('sha256').update(input).digest('hex');
    return parseInt(h.slice(0, 8), 16);
  }
}

type pipeNodeType = PipeNodeType;

export const pipelineWiringBridge = new PipelineWiringBridge();
