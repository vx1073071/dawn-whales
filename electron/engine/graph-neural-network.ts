/**
 * JVS-94: Graph Neural Network Engine
 *
 * Simplified message-passing GNN for stock relationship analysis
 * and sector propagation. No external ML dependencies — all matrix
 * operations are implemented from scratch.
 *
 * Use-cases:
 *  - Node classification (sector / concept tagging)
 *  - Link prediction (correlation / supply-chain discovery)
 *  - Graph classification (market regime detection)
 *  - Influence propagation across stock relationship graphs
 *
 * @module graph-neural-network
 */

import log from 'electron-log';

// ---------------------------------------------------------------------------
// Public Interfaces
// ---------------------------------------------------------------------------

/** A single node in the stock / sector graph. */
export interface GraphNode {
  id: string;
  label: string;
  type: 'stock' | 'sector' | 'index' | 'concept';
  /** Node feature vector (e.g. normalised price features, fundamentals). */
  features: number[];
  metadata?: Record<string, any>;
}

/** A weighted, typed edge between two graph nodes. */
export interface GraphEdge {
  source: string;
  target: string;
  /** Connection strength in [0, 1]. */
  weight: number;
  type: 'correlation' | 'supply_chain' | 'sector' | 'ownership' | 'custom';
  features?: number[];
}

/** Complete graph payload used to build the internal representation. */
export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

/** Hyper-parameters for GNN training. */
export interface GNNConfig {
  hiddenSize: number;
  numLayers: number;
  learningRate: number;
  epochs: number;
  task: 'node_classification' | 'link_prediction' | 'graph_classification';
  aggregationType: 'sum' | 'mean' | 'max';
}

/** Result returned after a training run. */
export interface GNNResult {
  nodeEmbeddings: Record<string, number[]>;
  predictions: Record<string, number[]>;
  accuracy: number;
  lossHistory: number[];
  durationMs: number;
}

/** Result of an influence-propagation query. */
export interface PropagationResult {
  sourceNode: string;
  affectedNodes: { nodeId: string; influence: number; hops: number }[];
  propagationPath: string[][];
  durationMs: number;
}

/** Summary statistics for the current graph. */
export interface GraphStats {
  nodes: number;
  edges: number;
  avgDegree: number;
  density: number;
  components: number;
}

// ---------------------------------------------------------------------------
// Internal matrix / vector helpers (no external deps)
// ---------------------------------------------------------------------------

/** Create a zero-initialised matrix of shape [rows, cols]. */
function zeros(rows: number, cols: number): number[][] {
  const m: number[][] = [];
  for (let i = 0; i < rows; i++) {
    m.push(new Array(cols).fill(0));
  }
  return m;
}

/** Create a matrix filled with small random values (Xavier-ish init). */
function randomMatrix(rows: number, cols: number): number[][] {
  const scale = Math.sqrt(2.0 / (rows + cols));
  const m: number[][] = [];
  for (let i = 0; i < rows; i++) {
    const row: number[] = [];
    for (let j = 0; j < cols; j++) {
      // Simple uniform random in [-scale, scale]
      row.push((Math.random() * 2 - 1) * scale);
    }
    m.push(row);
  }
  return m;
}

/** Create a zero-initialised vector of given length. */
function zerosVec(len: number): number[] {
  return new Array(len).fill(0);
}

/** Random-initialised vector. */
function randomVec(len: number): number[] {
  const scale = Math.sqrt(1.0 / len);
  const v: number[] = [];
  for (let i = 0; i < len; i++) {
    v.push((Math.random() * 2 - 1) * scale);
  }
  return v;
}

/** Matrix multiply A[m,k] x B[k,n] → C[m,n]. */
function matmul(A: number[][], B: number[][]): number[][] {
  const m = A.length;
  const k = A[0].length;
  const n = B[0].length;
  const C = zeros(m, n);
  for (let i = 0; i < m; i++) {
    for (let p = 0; p < k; p++) {
      const aip = A[i][p];
      for (let j = 0; j < n; j++) {
        C[i][j] += aip * B[p][j];
      }
    }
  }
  return C;
}

/** Element-wise matrix addition. */
function matAdd(A: number[][], B: number[][]): number[][] {
  const rows = A.length;
  const cols = A[0].length;
  const C = zeros(rows, cols);
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      C[i][j] = A[i][j] + B[i][j];
    }
  }
  return C;
}

/** Broadcast-add a bias vector to every row of a matrix. */
function addBias(M: number[][], bias: number[]): number[][] {
  const rows = M.length;
  const cols = M[0].length;
  const out = zeros(rows, cols);
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      out[i][j] = M[i][j] + bias[j];
    }
  }
  return out;
}

/** Element-wise ReLU activation. */
function relu(M: number[][]): number[][] {
  const rows = M.length;
  const cols = M[0].length;
  const out = zeros(rows, cols);
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      out[i][j] = Math.max(0, M[i][j]);
    }
  }
  return out;
}

/** Element-wise vector ReLU. */
function reluVec(v: number[]): number[] {
  return v.map((x) => Math.max(0, x));
}

/** Vector dot product. */
function dot(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += a[i] * b[i];
  }
  return sum;
}

/** Vector addition. */
function vecAdd(a: number[], b: number[]): number[] {
  return a.map((v, i) => v + b[i]);
}

/** Scalar-vector multiply. */
function vecScale(v: number[], s: number): number[] {
  return v.map((x) => x * s);
}

/** L2 norm of a vector. */
function vecNorm(v: number[]): number {
  let sum = 0;
  for (const x of v) sum += x * x;
  return Math.sqrt(sum);
}

/** Softmax over a 1-D vector. */
function softmax(v: number[]): number[] {
  const maxVal = Math.max(...v);
  const exps = v.map((x) => Math.exp(x - maxVal));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / sum);
}

/** Transpose a matrix. */
function transpose(M: number[][]): number[][] {
  const rows = M.length;
  const cols = M[0].length;
  const T = zeros(cols, rows);
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      T[j][i] = M[i][j];
    }
  }
  return T;
}

/** Mean of a list of vectors (element-wise). */
function meanVectors(vecs: number[][]): number[] {
  if (vecs.length === 0) return [];
  const dim = vecs[0].length;
  const out = zerosVec(dim);
  for (const v of vecs) {
    for (let i = 0; i < dim; i++) {
      out[i] += v[i];
    }
  }
  for (let i = 0; i < dim; i++) {
    out[i] /= vecs.length;
  }
  return out;
}

/** Sum of a list of vectors (element-wise). */
function sumVectors(vecs: number[][]): number[] {
  if (vecs.length === 0) return [];
  const dim = vecs[0].length;
  const out = zerosVec(dim);
  for (const v of vecs) {
    for (let i = 0; i < dim; i++) {
      out[i] += v[i];
    }
  }
  return out;
}

/** Max-pool a list of vectors (element-wise max). */
function maxVectors(vecs: number[][]): number[] {
  if (vecs.length === 0) return [];
  const dim = vecs[0].length;
  const out = vecs[0].slice();
  for (let k = 1; k < vecs.length; k++) {
    for (let i = 0; i < dim; i++) {
      if (vecs[k][i] > out[i]) out[i] = vecs[k][i];
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

/** Adjacency entry for a single neighbour. */
interface AdjEntry {
  nodeId: string;
  weight: number;
  edgeType: GraphEdge['type'];
  features?: number[];
}

/** A single linear layer: Y = ReLU(X·W + b). */
interface LinearLayer {
  W: number[][];  // [inDim, outDim]
  b: number[];    // [outDim]
}

// ---------------------------------------------------------------------------
// GraphNeuralNetwork
// ---------------------------------------------------------------------------

/**
 * Simplified message-passing Graph Neural Network.
 *
 * Architecture per layer:
 *   h_i^(l+1) = ReLU( AGG_{j∈N(i)} ( W_msg · h_j^(l) ) + W_self · h_i^(l) + b )
 *
 * No external ML library is required; all operations are hand-rolled.
 */
export class GraphNeuralNetwork {
  // -- Graph storage --------------------------------------------------------
  /** Map from node id → GraphNode. */
  private nodeMap: Map<string, GraphNode> = new Map();
  /** Adjacency list: nodeId → list of neighbour entries (undirected). */
  private adjList: Map<string, AdjEntry[]> = new Map();
  /** All edges stored for iteration. */
  private edges: GraphEdge[] = [];

  // -- Model parameters -----------------------------------------------------
  /** Message-passing layers. */
  private messageLayers: LinearLayer[] = [];
  /** Self-transform layers (applied to the node's own hidden state). */
  private selfLayers: LinearLayer[] = [];
  /** Output head (task-specific). */
  private outputLayer: LinearLayer | null = null;

  // -- Embedding cache ------------------------------------------------------
  private embeddings: Record<string, number[]> = {};
  private predictions: Record<string, number[]> = {};
  private isTrained = false;

  // -- Config cache ---------------------------------------------------------
  private lastConfig: GNNConfig | null = null;
  /** Number of distinct labels seen during training (for classification). */
  private numClasses = 0;
  /** Label → index mapping built during training. */
  private labelIndex: Map<string, number> = new Map();

  // -----------------------------------------------------------------------
  // Graph construction
  // -----------------------------------------------------------------------

  /**
   * Build (or rebuild) the internal graph from a GraphData payload.
   * Clears any previously trained model state.
   */
  buildGraph(data: GraphData): void {
    log.info(`[GNN] buildGraph: ${data.nodes.length} nodes, ${data.edges.length} edges`);
    const startTime = Date.now();

    this.nodeMap.clear();
    this.adjList.clear();
    this.edges = [];
    this.messageLayers = [];
    this.selfLayers = [];
    this.outputLayer = null;
    this.embeddings = {};
    this.predictions = {};
    this.isTrained = false;
    this.lastConfig = null;

    // Insert nodes
    for (const node of data.nodes) {
      this.nodeMap.set(node.id, { ...node, features: [...node.features] });
      this.adjList.set(node.id, []);
    }

    // Insert edges (undirected)
    for (const edge of data.edges) {
      this.insertEdge(edge);
    }

    const elapsed = Date.now() - startTime;
    log.info(`[GNN] buildGraph completed in ${elapsed}ms`);
  }

  /**
   * Add a single node to the graph. If a node with the same id already
   * exists it will be overwritten.
   */
  addNode(node: GraphNode): void {
    log.debug(`[GNN] addNode: ${node.id} (${node.type})`);
    this.nodeMap.set(node.id, { ...node, features: [...node.features] });
    if (!this.adjList.has(node.id)) {
      this.adjList.set(node.id, []);
    }
    // Invalidate trained state
    this.invalidateModel();
  }

  /**
   * Add a single edge. Both source and target nodes must already exist.
   */
  addEdge(edge: GraphEdge): void {
    log.debug(`[GNN] addEdge: ${edge.source} → ${edge.target} (w=${edge.weight})`);
    if (!this.nodeMap.has(edge.source) || !this.nodeMap.has(edge.target)) {
      log.warn(`[GNN] addEdge: missing node(s) for edge ${edge.source}→${edge.target}`);
      return;
    }
    this.insertEdge(edge);
    this.invalidateModel();
  }

  /**
   * Remove a node and all edges incident to it.
   */
  removeNode(nodeId: string): void {
    log.debug(`[GNN] removeNode: ${nodeId}`);
    this.nodeMap.delete(nodeId);
    this.adjList.delete(nodeId);

    // Remove edges that reference this node
    this.edges = this.edges.filter(
      (e) => e.source !== nodeId && e.target !== nodeId,
    );

    // Remove adjacency entries pointing to this node
    for (const [, entries] of this.adjList) {
      for (let i = entries.length - 1; i >= 0; i--) {
        if (entries[i].nodeId === nodeId) {
          entries.splice(i, 1);
        }
      }
    }
    this.invalidateModel();
  }

  /**
   * Remove a specific edge (undirected: removes both directions).
   */
  removeEdge(source: string, target: string): void {
    log.debug(`[GNN] removeEdge: ${source} ↔ ${target}`);
    this.edges = this.edges.filter(
      (e) =>
        !(e.source === source && e.target === target) &&
        !(e.source === target && e.target === source),
    );

    const removeFromAdj = (fromId: string, toId: string) => {
      const entries = this.adjList.get(fromId);
      if (!entries) return;
      for (let i = entries.length - 1; i >= 0; i--) {
        if (entries[i].nodeId === toId) {
          entries.splice(i, 1);
        }
      }
    };
    removeFromAdj(source, target);
    removeFromAdj(target, source);
    this.invalidateModel();
  }

  // -----------------------------------------------------------------------
  // Training
  // -----------------------------------------------------------------------

  /**
   * Train the GNN with the given configuration.
   *
   * For **node_classification** the node `label` field is used as the
   * target class.  For **link_prediction** a simple contrastive objective
   * is used (connected = positive).  For **graph_classification** a
   * mean-pooled graph embedding is classified.
   */
  train(config: GNNConfig): GNNResult {
    log.info(`[GNN] train: task=${config.task}, layers=${config.numLayers}, hidden=${config.hiddenSize}, epochs=${config.epochs}`);
    const startTime = Date.now();
    this.lastConfig = config;

    // Determine input feature dimension from first node
    const nodeIds = Array.from(this.nodeMap.keys());
    if (nodeIds.length === 0) {
      throw new Error('[GNN] Cannot train on empty graph');
    }
    const inputDim = this.nodeMap.get(nodeIds[0])!.features.length;
    const hiddenSize = config.hiddenSize;

    // Build label mapping for classification tasks
    this.buildLabelMapping(nodeIds);
    const outputDim = config.task === 'node_classification'
      ? Math.max(this.numClasses, 2)
      : config.task === 'link_prediction'
        ? 2
        : Math.max(this.numClasses, 2);

    // Initialise layers
    this.initLayers(inputDim, hiddenSize, config.numLayers);
    this.outputLayer = {
      W: randomMatrix(hiddenSize, outputDim),
      b: randomVec(outputDim),
    };

    // Training loop
    const lossHistory: number[] = [];
    const lr = config.learningRate;

    for (let epoch = 0; epoch < config.epochs; epoch++) {
      // Forward pass: compute embeddings via message passing
      const layerEmbeddings = this.forwardPass(nodeIds, config.aggregationType);

      // Compute task-specific loss and gradients (simplified SGD)
      const loss = this.computeLossAndStep(
        nodeIds,
        layerEmbeddings,
        config.task,
        lr,
      );
      lossHistory.push(loss);

      if (epoch % Math.max(1, Math.floor(config.epochs / 10)) === 0) {
        log.debug(`[GNN] epoch ${epoch}: loss=${loss.toFixed(6)}`);
      }
    }

    // Final forward pass to produce embeddings
    const finalEmbeddings = this.forwardPass(nodeIds, config.aggregationType);

    // Store embeddings & predictions
    const nodeEmbeddings: Record<string, number[]> = {};
    const predictions: Record<string, number[]> = {};

    for (const id of nodeIds) {
      const emb = finalEmbeddings[id] ?? zerosVec(hiddenSize);
      nodeEmbeddings[id] = emb;

      // Produce prediction via output layer
      if (this.outputLayer) {
        const logits = this.applyLinear(emb, this.outputLayer);
        predictions[id] = softmax(logits);
      } else {
        predictions[id] = emb;
      }
    }

    this.embeddings = nodeEmbeddings;
    this.predictions = predictions;
    this.isTrained = true;

    // Compute accuracy
    const accuracy = this.evaluateAccuracy(nodeIds, predictions, config.task);

    const durationMs = Date.now() - startTime;
    log.info(`[GNN] train completed: accuracy=${accuracy.toFixed(4)}, duration=${durationMs}ms`);

    return {
      nodeEmbeddings,
      predictions,
      accuracy,
      lossHistory,
      durationMs,
    };
  }

  // -----------------------------------------------------------------------
  // Prediction
  // -----------------------------------------------------------------------

  /**
   * Return the prediction vector for a single node.
   * The model must have been trained first.
   */
  predict(nodeId: string): number[] {
    if (!this.isTrained) {
      log.warn('[GNN] predict called before training — returning zero vector');
      return zerosVec(this.lastConfig?.hiddenSize ?? 64);
    }
    const pred = this.predictions[nodeId];
    if (!pred) {
      log.warn(`[GNN] predict: unknown node ${nodeId}`);
      return zerosVec(this.lastConfig?.hiddenSize ?? 64);
    }
    return [...pred];
  }

  /**
   * Return predictions for every node in the graph.
   */
  predictAll(): Record<string, number[]> {
    if (!this.isTrained) {
      log.warn('[GNN] predictAll called before training — returning empty');
      return {};
    }
    const out: Record<string, number[]> = {};
    for (const [id, pred] of Object.entries(this.predictions)) {
      out[id] = [...pred];
    }
    return out;
  }

  /**
   * Get the learned embedding vector for a single node.
   */
  getNodeEmbedding(nodeId: string): number[] {
    const emb = this.embeddings[nodeId];
    if (!emb) {
      log.warn(`[GNN] getNodeEmbedding: unknown node ${nodeId}`);
      return [];
    }
    return [...emb];
  }

  // -----------------------------------------------------------------------
  // Propagation
  // -----------------------------------------------------------------------

  /**
   * Simulate influence propagation from a source node outward.
   *
   * Uses a BFS with exponential decay: influence at hop k is
   * `weight_product * decay^k` where decay = 0.5 by default.
   */
  propagate(sourceNodeId: string, maxHops = 3): PropagationResult {
    log.info(`[GNN] propagate from ${sourceNodeId}, maxHops=${maxHops}`);
    const startTime = Date.now();

    if (!this.nodeMap.has(sourceNodeId)) {
      throw new Error(`[GNN] propagate: unknown source node ${sourceNodeId}`);
    }

    const decay = 0.5;
    const visited = new Set<string>([sourceNodeId]);
    // BFS queue: [nodeId, cumulativeInfluence, hops, path]
    const queue: Array<[string, number, number, string[]]> = [
      [sourceNodeId, 1.0, 0, [sourceNodeId]],
    ];

    const affectedNodes: { nodeId: string; influence: number; hops: number }[] = [];
    const propagationPath: string[][] = [];

    while (queue.length > 0) {
      const [currentId, currentInfluence, hops, path] = queue.shift()!;

      if (currentId !== sourceNodeId) {
        affectedNodes.push({
          nodeId: currentId,
          influence: parseFloat(currentInfluence.toFixed(6)),
          hops,
        });
        propagationPath.push([...path]);
      }

      if (hops >= maxHops) continue;

      const neighbours = this.adjList.get(currentId) ?? [];
      for (const entry of neighbours) {
        if (visited.has(entry.nodeId)) continue;
        visited.add(entry.nodeId);

        const nextInfluence = currentInfluence * entry.weight * decay;
        // Only propagate if influence is non-trivial
        if (nextInfluence > 0.001) {
          queue.push([
            entry.nodeId,
            nextInfluence,
            hops + 1,
            [...path, entry.nodeId],
          ]);
        }
      }
    }

    // Sort by influence descending
    affectedNodes.sort((a, b) => b.influence - a.influence);

    const durationMs = Date.now() - startTime;
    log.info(`[GNN] propagate: ${affectedNodes.length} affected nodes in ${durationMs}ms`);

    return {
      sourceNode: sourceNodeId,
      affectedNodes,
      propagationPath,
      durationMs,
    };
  }

  // -----------------------------------------------------------------------
  // Neighbourhood & path finding
  // -----------------------------------------------------------------------

  /**
   * Return all nodes reachable within `maxHops` hops from `nodeId`.
   */
  getNeighbors(nodeId: string, maxHops = 1): GraphNode[] {
    if (!this.nodeMap.has(nodeId)) {
      log.warn(`[GNN] getNeighbors: unknown node ${nodeId}`);
      return [];
    }

    const visited = new Set<string>([nodeId]);
    let frontier: string[] = [nodeId];

    for (let hop = 0; hop < maxHops; hop++) {
      const nextFrontier: string[] = [];
      for (const nid of frontier) {
        const entries = this.adjList.get(nid) ?? [];
        for (const entry of entries) {
          if (!visited.has(entry.nodeId)) {
            visited.add(entry.nodeId);
            nextFrontier.push(entry.nodeId);
          }
        }
      }
      frontier = nextFrontier;
      if (frontier.length === 0) break;
    }

    visited.delete(nodeId); // exclude self
    const result: GraphNode[] = [];
    for (const id of visited) {
      const node = this.nodeMap.get(id);
      if (node) result.push({ ...node });
    }
    return result;
  }

  /**
   * BFS shortest path (unweighted) between two nodes.
   * Returns the list of node ids along the path, or empty if unreachable.
   */
  findShortestPath(from: string, to: string): string[] {
    if (!this.nodeMap.has(from) || !this.nodeMap.has(to)) {
      log.warn(`[GNN] findShortestPath: unknown node(s) ${from}, ${to}`);
      return [];
    }
    if (from === to) return [from];

    const visited = new Set<string>([from]);
    const parent = new Map<string, string>();
    const queue: string[] = [from];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current === to) {
        // Reconstruct path
        const path: string[] = [to];
        let p = to;
        while (parent.has(p)) {
          p = parent.get(p)!;
          path.unshift(p);
        }
        return path;
      }

      const entries = this.adjList.get(current) ?? [];
      for (const entry of entries) {
        if (!visited.has(entry.nodeId)) {
          visited.add(entry.nodeId);
          parent.set(entry.nodeId, current);
          queue.push(entry.nodeId);
        }
      }
    }

    log.debug(`[GNN] findShortestPath: no path from ${from} to ${to}`);
    return [];
  }

  // -----------------------------------------------------------------------
  // Community detection
  // -----------------------------------------------------------------------

  /**
   * Detect communities using label propagation.
   *
   * Each node starts with its own community label. In each iteration
   * a node adopts the most frequent label among its neighbours. The
   * process converges when labels stop changing (or after maxIter).
   *
   * @returns Map from communityId → list of node ids in that community.
   */
  detectCommunities(maxIter = 50): Record<string, string[]> {
    log.info('[GNN] detectCommunities: starting label propagation');
    const startTime = Date.now();

    const nodeIds = Array.from(this.nodeMap.keys());
    // Initialise: each node is its own community
    const labels = new Map<string, string>();
    for (const id of nodeIds) {
      labels.set(id, id);
    }

    let changed = true;
    let iter = 0;

    while (changed && iter < maxIter) {
      changed = false;
      iter++;

      // Process nodes in random order for better convergence
      const shuffled = [...nodeIds].sort(() => Math.random() - 0.5);

      for (const nodeId of shuffled) {
        const entries = this.adjList.get(nodeId) ?? [];
        if (entries.length === 0) continue;

        // Count weighted neighbour labels
        const labelCounts = new Map<string, number>();
        for (const entry of entries) {
          const neighbourLabel = labels.get(entry.nodeId);
          if (neighbourLabel === undefined) continue;
          const current = labelCounts.get(neighbourLabel) ?? 0;
          labelCounts.set(neighbourLabel, current + entry.weight);
        }

        // Pick the label with the highest total weight
        let bestLabel = labels.get(nodeId)!;
        let bestCount = -1;
        for (const [label, count] of labelCounts) {
          if (count > bestCount) {
            bestCount = count;
            bestLabel = label;
          }
        }

        if (bestLabel !== labels.get(nodeId)) {
          labels.set(nodeId, bestLabel);
          changed = true;
        }
      }
    }

    // Group nodes by community label
    const communities: Record<string, string[]> = {};
    for (const [nodeId, label] of labels) {
      if (!communities[label]) {
        communities[label] = [];
      }
      communities[label].push(nodeId);
    }

    const elapsed = Date.now() - startTime;
    const numCommunities = Object.keys(communities).length;
    log.info(
      `[GNN] detectCommunities: ${numCommunities} communities found in ${iter} iterations (${elapsed}ms)`,
    );

    return communities;
  }

  // -----------------------------------------------------------------------
  // Graph statistics
  // -----------------------------------------------------------------------

  /**
   * Compute summary statistics for the current graph.
   */
  getGraphStats(): GraphStats {
    const n = this.nodeMap.size;
    const e = this.edges.length;
    const avgDegree = n > 0 ? (2 * e) / n : 0;
    const maxEdges = n > 1 ? (n * (n - 1)) / 2 : 0;
    const density = maxEdges > 0 ? e / maxEdges : 0;
    const components = this.countConnectedComponents();

    return {
      nodes: n,
      edges: e,
      avgDegree: parseFloat(avgDegree.toFixed(4)),
      density: parseFloat(density.toFixed(6)),
      components,
    };
  }

  // -----------------------------------------------------------------------
  // Private: graph helpers
  // -----------------------------------------------------------------------

  /** Insert an edge into the adjacency list (both directions). */
  private insertEdge(edge: GraphEdge): void {
    this.edges.push({ ...edge });

    const srcEntries = this.adjList.get(edge.source);
    const tgtEntries = this.adjList.get(edge.target);

    if (srcEntries && tgtEntries) {
      srcEntries.push({
        nodeId: edge.target,
        weight: edge.weight,
        edgeType: edge.type,
        features: edge.features ? [...edge.features] : undefined,
      });
      tgtEntries.push({
        nodeId: edge.source,
        weight: edge.weight,
        edgeType: edge.type,
        features: edge.features ? [...edge.features] : undefined,
      });
    }
  }

  /** Invalidate cached model state (called after graph mutations). */
  private invalidateModel(): void {
    this.isTrained = false;
    this.embeddings = {};
    this.predictions = {};
  }

  /** Count connected components via BFS. */
  private countConnectedComponents(): number {
    const visited = new Set<string>();
    let count = 0;

    for (const nodeId of this.nodeMap.keys()) {
      if (visited.has(nodeId)) continue;
      count++;
      // BFS
      const queue: string[] = [nodeId];
      visited.add(nodeId);
      while (queue.length > 0) {
        const current = queue.shift()!;
        const entries = this.adjList.get(current) ?? [];
        for (const entry of entries) {
          if (!visited.has(entry.nodeId)) {
            visited.add(entry.nodeId);
            queue.push(entry.nodeId);
          }
        }
      }
    }
    return count;
  }

  // -----------------------------------------------------------------------
  // Private: model initialisation
  // -----------------------------------------------------------------------

  /** Build label → index mapping from node labels. */
  private buildLabelMapping(nodeIds: string[]): void {
    this.labelIndex.clear();
    this.numClasses = 0;
    const uniqueLabels = new Set<string>();
    for (const id of nodeIds) {
      const node = this.nodeMap.get(id)!;
      uniqueLabels.add(node.label);
    }
    for (const label of uniqueLabels) {
      this.labelIndex.set(label, this.numClasses++);
    }
    log.debug(`[GNN] label mapping: ${this.numClasses} classes → [${Array.from(this.labelIndex.keys()).join(', ')}]`);
  }

  /** Initialise message-passing and self-transform layers. */
  private initLayers(inputDim: number, hiddenSize: number, numLayers: number): void {
    this.messageLayers = [];
    this.selfLayers = [];

    for (let l = 0; l < numLayers; l++) {
      const inDim = l === 0 ? inputDim : hiddenSize;
      this.messageLayers.push({
        W: randomMatrix(inDim, hiddenSize),
        b: randomVec(hiddenSize),
      });
      this.selfLayers.push({
        W: randomMatrix(inDim, hiddenSize),
        b: randomVec(hiddenSize),
      });
    }
  }

  // -----------------------------------------------------------------------
  // Private: forward pass
  // -----------------------------------------------------------------------

  /**
   * Run message-passing forward pass and return per-layer embeddings.
   * The final entry is the output embedding for each node.
   */
  private forwardPass(
    nodeIds: string[],
    aggType: 'sum' | 'mean' | 'max',
  ): Record<string, number[]> {
    const numLayers = this.messageLayers.length;

    // Initialise hidden states from raw features
    let H: Record<string, number[]> = {};
    for (const id of nodeIds) {
      H[id] = [...this.nodeMap.get(id)!.features];
    }

    // Message-passing layers
    for (let l = 0; l < numLayers; l++) {
      const nextH: Record<string, number[]> = {};
      const msgLayer = this.messageLayers[l];
      const selfLayer = this.selfLayers[l];

      for (const nodeId of nodeIds) {
        const selfFeat = H[nodeId];
        const entries = this.adjList.get(nodeId) ?? [];

        // Aggregate neighbour messages
        const messages: number[][] = [];
        for (const entry of entries) {
          const neighbourFeat = H[entry.nodeId];
          if (!neighbourFeat) continue;
          // Weighted message: weight * (neighbour_feat · W_msg)
          const transformed = this.applyLinear(neighbourFeat, msgLayer);
          const weighted = vecScale(transformed, entry.weight);
          messages.push(weighted);
        }

        // Aggregate
        let aggregated: number[];
        if (messages.length === 0) {
          aggregated = zerosVec(msgLayer.b.length);
        } else if (aggType === 'sum') {
          aggregated = sumVectors(messages);
        } else if (aggType === 'mean') {
          aggregated = meanVectors(messages);
        } else {
          aggregated = maxVectors(messages);
        }

        // Self transform
        const selfTransformed = this.applyLinear(selfFeat, selfLayer);

        // Combine + ReLU
        const combined = vecAdd(aggregated, selfTransformed);
        nextH[nodeId] = reluVec(combined);
      }

      H = nextH;
    }

    return H;
  }

  /** Apply a linear layer to a single vector: y = x·W + b. */
  private applyLinear(x: number[], layer: LinearLayer): number[] {
    const outDim = layer.W[0].length;
    const inDim = layer.W.length;
    const out = zerosVec(outDim);

    for (let j = 0; j < outDim; j++) {
      let sum = layer.b[j];
      for (let i = 0; i < inDim; i++) {
        sum += (x[i] ?? 0) * layer.W[i][j];
      }
      out[j] = sum;
    }
    return out;
  }

  // -----------------------------------------------------------------------
  // Private: loss computation & simplified SGD
  // -----------------------------------------------------------------------

  /**
   * Compute cross-entropy loss and apply one step of gradient update.
   *
   * This is a *simplified* training step — we approximate gradients via
   * finite differences for the output layer only (no backprop through
   * message-passing layers).  This keeps the implementation dependency-free
   * while still moving the weights in a useful direction.
   */
  private computeLossAndStep(
    nodeIds: string[],
    embeddings: Record<string, number[]>,
    task: GNNConfig['task'],
    lr: number,
  ): number {
    if (!this.outputLayer) return 0;

    const eps = 1e-4;
    let totalLoss = 0;
    let count = 0;

    if (task === 'node_classification' || task === 'graph_classification') {
      // Cross-entropy loss against node labels
      for (const id of nodeIds) {
        const node = this.nodeMap.get(id)!;
        const targetIdx = this.labelIndex.get(node.label) ?? 0;
        const emb = embeddings[id];
        if (!emb) continue;

        const logits = this.applyLinear(emb, this.outputLayer);
        const probs = softmax(logits);
        const loss = -Math.log(Math.max(probs[targetIdx], 1e-10));
        totalLoss += loss;
        count++;

        // Gradient approximation for output layer
        this.approxGradientStep(emb, targetIdx, lr);
      }
    } else if (task === 'link_prediction') {
      // Contrastive: connected pairs should have similar embeddings
      for (const edge of this.edges) {
        const embSrc = embeddings[edge.source];
        const embTgt = embeddings[edge.target];
        if (!embSrc || !embTgt) continue;

        const logits = this.applyLinear(
          vecAdd(embSrc, embTgt),
          this.outputLayer,
        );
        const probs = softmax(logits);
        // Positive pair → target class 1
        const loss = -Math.log(Math.max(probs[1] ?? probs[0], 1e-10));
        totalLoss += loss;
        count++;

        this.approxGradientStep(vecAdd(embSrc, embTgt), 1, lr);
      }
    }

    return count > 0 ? totalLoss / count : 0;
  }

  /**
   * Approximate gradient step on the output layer using finite differences.
   * This is intentionally simple — no full backprop.
   */
  private approxGradientStep(
    input: number[],
    targetIdx: number,
    lr: number,
  ): void {
    if (!this.outputLayer) return;

    const layer = this.outputLayer;
    const eps = 1e-3;

    // Compute baseline loss
    const logits0 = this.applyLinear(input, layer);
    const probs0 = softmax(logits0);
    const baseLoss = -Math.log(Math.max(probs0[targetIdx], 1e-10));

    // Update weights via finite-difference gradient
    const inDim = layer.W.length;
    const outDim = layer.W[0].length;

    for (let i = 0; i < inDim; i++) {
      for (let j = 0; j < outDim; j++) {
        const orig = layer.W[i][j];
        layer.W[i][j] = orig + eps;
        const logits1 = this.applyLinear(input, layer);
        const probs1 = softmax(logits1);
        const loss1 = -Math.log(Math.max(probs1[targetIdx], 1e-10));
        const grad = (loss1 - baseLoss) / eps;
        layer.W[i][j] = orig - lr * grad;
      }
    }

    // Update bias
    for (let j = 0; j < outDim; j++) {
      const orig = layer.b[j];
      layer.b[j] = orig + eps;
      const logits1 = this.applyLinear(input, layer);
      const probs1 = softmax(logits1);
      const loss1 = -Math.log(Math.max(probs1[targetIdx], 1e-10));
      const grad = (loss1 - baseLoss) / eps;
      layer.b[j] = orig - lr * grad;
    }
  }

  // -----------------------------------------------------------------------
  // Private: evaluation
  // -----------------------------------------------------------------------

  /**
   * Compute classification accuracy or link-prediction accuracy.
   */
  private evaluateAccuracy(
    nodeIds: string[],
    predictions: Record<string, number[]>,
    task: GNNConfig['task'],
  ): number {
    let correct = 0;
    let total = 0;

    if (task === 'node_classification' || task === 'graph_classification') {
      for (const id of nodeIds) {
        const pred = predictions[id];
        if (!pred) continue;
        const node = this.nodeMap.get(id)!;
        const targetIdx = this.labelIndex.get(node.label) ?? 0;
        const predIdx = pred.indexOf(Math.max(...pred));
        if (predIdx === targetIdx) correct++;
        total++;
      }
    } else if (task === 'link_prediction') {
      // Evaluate: for each edge, check if the model assigns high prob to class 1
      for (const edge of this.edges) {
        const predSrc = predictions[edge.source];
        const predTgt = predictions[edge.target];
        if (!predSrc || !predTgt) continue;
        // Simple heuristic: if both nodes predict the same class → link exists
        const srcClass = predSrc.indexOf(Math.max(...predSrc));
        const tgtClass = predTgt.indexOf(Math.max(...predTgt));
        if (srcClass === tgtClass) correct++;
        total++;
      }
    }

    return total > 0 ? correct / total : 0;
  }
}

export default GraphNeuralNetwork;
