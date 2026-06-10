// ── Q11: Correlation Visualizer ──────────────────────────────────────────────
// Transforms correlation matrix output into visualization-ready data structures:
// - Hierarchical clustering heatmap (ordered matrix + dendrogram)
// - Minimum Spanning Tree (MST) network graph
// IPC: strategy:correlation-viz

import log from 'electron-log';
import { computeCorrelationMatrix, EquityPoint, CorrelationMatrixResult } from './correlation-matrix';

export { EquityPoint };

// ── Types ──────────────────────────────────────────────────────────────────

export interface HierarchicalCluster {
  id: string;           // node id (strategy/symbol)
  clusterId: string;    // which cluster this belongs to
  distance: number;     // distance to parent cluster (-1 for root)
}

export interface HeatmapCell {
  idA: string;
  idB: string;
  value: number;        // correlation -1 to 1
  color: string;         // CSS color string
  fontColor: string;     // contrasting text color
}

export interface DendrogramNode {
  id: string;            // leaf = strategy id; internal = "c0","c1",...
  label: string;
  height: number;        // merge distance
  children?: string[];   // child node ids (empty for leaves)
  isLeaf: boolean;
}

export interface MstEdge {
  source: string;
  target: string;
  weight: number;        // distance = 1 - |correlation|
  color: string;         // line color by correlation strength
  width: number;         // line thickness
}

export interface CorrelationVizResult {
  heatmap: {
    ids: string[];
    matrix: HeatmapCell[][];
    dendrogram: DendrogramNode[];
  };
  mst: {
    nodes: { id: string; label: string; cluster: string }[];
    edges: MstEdge[];
    diversificationScore: number;
  };
}

// ── Color Mapping ────────────────────────────────────────────────────────────
// correlation -1 (strong inverse) → blue
// correlation  0 (neutral)       → white/gray
// correlation +1 (strong forward) → red

function corrToColor(corr: number): string {
  if (corr >= 0) {
    // 0 → white → red
    const g = Math.round(255 - corr * 200);
    const b = Math.round(255 - corr * 200);
    return `rgb(255,${Math.max(0,g)},${Math.max(0,b)})`;
  } else {
    // 0 → white → blue
    const r = Math.round(255 + corr * 200);
    const g = Math.round(255 + corr * 200);
    return `rgb(${Math.max(0,r)},${Math.max(0,g)},255)`;
  }
}

function fontColor(corr: number): string {
  return Math.abs(corr) > 0.4 ? '#ffffff' : '#1a1a1a';
}

// ── Single-Linkage Agglomerative Clustering ──────────────────────────────────

type Cluster = { id: string; members: Set<string>; height: number };

function buildDendrogram(ids: string[], matrix: number[][]): DendrogramNode[] {
  const n = ids.length;
  if (n === 0) return [];
  if (n === 1) {
    return [{ id: ids[0], label: ids[0], height: 0, children: [], isLeaf: true }];
  }

  // Initialize n singleton clusters
  const clusters: Cluster[] = ids.map((id, i) => ({
    id,
    members: new Set([id]),
    height: 0,
  }));

  const active = new Set(clusters.map((_, i) => i));
  const nodes: DendrogramNode[] = ids.map(id => ({
    id, label: id, height: 0, children: [], isLeaf: true,
  }));

  let nextInternalId = 0;

  while (active.size > 1) {
    // Find pair with minimum distance (maximum correlation = minimum distance)
    let minDist = Infinity;
    let bestI = -1, bestJ = -1;

    const activeList = Array.from(active);
    for (let ai = 0; ai < activeList.length; ai++) {
      for (let aj = ai + 1; aj < activeList.length; aj++) {
        const i = activeList[ai];
        const j = activeList[aj];
        const ci = clusters[i], cj = clusters[j];

        // Single linkage: min distance between any pair of members
        let minPairDist = Infinity;
        for (const mi of ci.members) {
          for (const mj of cj.members) {
            const xi = ids.indexOf(mi);
            const xj = ids.indexOf(mj);
            const dist = 1 - Math.abs(matrix[xi][xj]);
            if (dist < minPairDist) minPairDist = dist;
          }
        }

        if (minPairDist < minDist) {
          minDist = minPairDist;
          bestI = i; bestJ = j;
        }
      }
    }

    if (bestI === -1) break;

    const cI = clusters[bestI], cJ = clusters[bestJ];
    const merged: Cluster = {
      id: `c${nextInternalId++}`,
      members: new Set([...cI.members, ...cJ.members]),
      height: minDist,
    };

    const newNode: DendrogramNode = {
      id: merged.id,
      label: '',
      height: Math.round(minDist * 1000) / 1000,
      children: [cI.id, cJ.id],
      isLeaf: false,
    };

    // Update leaf nodes with parent reference
    for (const mid of cI.members) {
      const ln = nodes.find(n => n.id === mid);
      if (ln) { ln.height = minDist; ln.children = [merged.id]; }
    }
    for (const mid of cJ.members) {
      const ln = nodes.find(n => n.id === mid);
      if (ln) { ln.height = minDist; ln.children = [merged.id]; }
    }
    nodes.push(newNode);

    // Replace bestI with merged, remove bestJ
    clusters[bestI] = merged;
    active.delete(bestJ);
  }

  // Set root height
  const rootNode = nodes.find(n => n.id === `c${nextInternalId - 1}`);
  if (rootNode) rootNode.label = 'All Strategies';

  return nodes;
}

// ── MST (Minimum Spanning Tree) via Prim's Algorithm ──────────────────────────

function buildMst(ids: string[], matrix: number[][]) {
  const n = ids.length;
  if (n === 0) return { nodes: [], edges: [], diversificationScore: 0 };
  if (n === 1) {
    return {
      nodes: [{ id: ids[0], label: ids[0], cluster: 'singleton' }],
      edges: [],
      diversificationScore: 1,
    };
  }

  // Distance = 1 - |correlation|
  const dist = (i: number, j: number) => 1 - Math.abs(matrix[i][j]);

  // Prim's algorithm
  const inMst = new Array(n).fill(false);
  const parent = new Array(n).fill(-1);
  const key = new Array(n).fill(Infinity);
  inMst[0] = true;
  for (let j = 0; j < n; j++) {
    key[j] = dist(0, j);
    parent[j] = 0;
  }

  for (let iter = 1; iter < n; iter++) {
    let minKey = Infinity, u = -1;
    for (let j = 0; j < n; j++) {
      if (!inMst[j] && key[j] < minKey) { minKey = key[j]; u = j; }
    }
    if (u === -1) break;
    inMst[u] = true;
    for (let v = 0; v < n; v++) {
      if (!inMst[v]) {
        const d = dist(u, v);
        if (d < key[v]) { key[v] = d; parent[v] = u; }
      }
    }
  }

  // Assign clusters based on MST connectivity
  const visited = new Array(n).fill(false);
  const clusterIds: string[] = [];
  let clusterIdx = 0;

  function assignCluster(node: number, cid: string) {
    clusterIds[node] = cid;
    visited[node] = true;
    for (let v = 0; v < n; v++) {
      if (!visited[v] && parent[v] === node) assignCluster(v, cid);
    }
  }

  for (let i = 0; i < n; i++) {
    if (!visited[i]) { assignCluster(i, `cluster-${clusterIdx++}`); }
  }

  const nodes = ids.map((id, i) => ({
    id,
    label: id,
    cluster: clusterIds[i],
  }));

  const edges: MstEdge[] = [];
  for (let v = 1; v < n; v++) {
    if (parent[v] >= 0) {
      const corr = matrix[parent[v]][v];
      const d = dist(parent[v], v);
      edges.push({
        source: ids[parent[v]],
        target: ids[v],
        weight: Math.round(d * 1000) / 1000,
        color: corr >= 0.7 ? '#ef4444' : corr <= -0.7 ? '#3b82f6' : '#94a3b8',
        width: Math.abs(corr) > 0.8 ? 4 : Math.abs(corr) > 0.5 ? 2 : 1,
      });
    }
  }

  return {
    nodes,
    edges,
    diversificationScore: 1, // MST always connects all nodes
  };
}

// ── Main: Build Visualization Data ─────────────────────────────────────────

export function buildCorrelationVisualization(
  inputs: { id: string; equityCurve: EquityPoint[] }[]
): CorrelationVizResult {
  log.info('[CorrelationVisualizer] Building viz for', inputs.length, 'items');

  const result = computeCorrelationMatrix(inputs);
  const { ids, matrix } = result;

  // Heatmap cells
  const heatmapCells: HeatmapCell[][] = matrix.map((row, i) =>
    row.map((corr, j) => ({
      idA: ids[i],
      idB: ids[j],
      value: Math.round(corr * 1000) / 1000,
      color: corr === 1 ? '#e5e7eb' : corrToColor(corr),
      fontColor: fontColor(corr),
    }))
  );

  // Dendrogram
  const dendrogram = buildDendrogram(ids, matrix);

  // MST
  const mstResult = buildMst(ids, matrix);

  log.info('[CorrelationVisualizer] Done. MST edges:', mstResult.edges.length);

  return {
    heatmap: { ids, matrix: heatmapCells, dendrogram },
    mst: {
      nodes: mstResult.nodes,
      edges: mstResult.edges,
      diversificationScore: result.diversificationScore,
    },
  };
}