// T98: Data Lineage Tracker
export interface LineageNode {
  id: string;
  type: 'source' | 'transform' | 'sink';
  name: string;
  inputTables: string[];
  outputTables: string[];
  transform?: string;
  timestamp: number;
}

export interface LineageGraph {
  nodes: LineageNode[];
  edges: { from: string; to: string; through: string }[];
}

export class DataLineage {
  private nodes = new Map<string, LineageNode>();

  trackSource(table: string, name: string): void {
    this.nodes.set(table, {
      id: `source:${table}`,
      type: 'source',
      name,
      inputTables: [],
      outputTables: [table],
      timestamp: Date.now(),
    });
  }

  trackTransform(id: string, name: string, inputTables: string[], outputTables: string[], transform: string): void {
    this.nodes.set(id, {
      id,
      type: 'transform',
      name,
      inputTables,
      outputTables,
      transform,
      timestamp: Date.now(),
    });
  }

  trackSink(table: string, name: string, inputTables: string[]): void {
    this.nodes.set(`sink:${table}`, {
      id: `sink:${table}`,
      type: 'sink',
      name,
      inputTables,
      outputTables: [],
      timestamp: Date.now(),
    });
  }

  trace(table: string, direction: 'upstream' | 'downstream' = 'upstream'): LineageGraph {
    const visited = new Set<string>();
    const nodes: LineageNode[] = [];
    const edges: { from: string; to: string; through: string }[] = [];

    const queue = [table];
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);

      // Find all nodes producing or consuming this table
      for (const [, node] of this.nodes) {
        if (direction === 'upstream' && node.outputTables.includes(current)) {
          nodes.push(node);
          edges.push({ from: node.id, to: current, through: node.name });
          queue.push(...node.inputTables);
        }
        if (direction === 'downstream' && node.inputTables.includes(current)) {
          nodes.push(node);
          edges.push({ from: current, to: node.id, through: node.name });
          queue.push(...node.outputTables);
        }
      }
    }

    return { nodes, edges };
  }

  impactAnalysis(table: string): { affectedTables: string[]; affectedTransforms: string[] } {
    const graph = this.trace(table, 'downstream');
    return {
      affectedTables: [...new Set(graph.nodes.flatMap(n => n.outputTables))],
      affectedTransforms: graph.nodes.filter(n => n.type === 'transform').map(n => n.name),
    };
  }

  getDAG(): LineageGraph {
    const allNodes = Array.from(this.nodes.values());
    const edges: { from: string; to: string; through: string }[] = [];
    for (const node of allNodes) {
      for (const out of node.outputTables) {
        edges.push({ from: node.id, to: out, through: node.name });
      }
    }
    return { nodes: allNodes, edges };
  }
}
