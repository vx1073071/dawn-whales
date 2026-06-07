/**
 * JVS-94: Graph Neural Network Risk Control - Tests
 * Graph-based risk analysis and anomaly detection
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  GraphNeuralNetwork,
  GNNConfig,
  StockNode,
  StockEdge,
} from '../electron/engine/graph-neural-network';

describe('GraphNeuralNetwork', () => {
  let gnn: GraphNeuralNetwork;

  beforeEach(() => {
    gnn = new GraphNeuralNetwork({
      hiddenSize: 64,
      numLayers: 2,
      learningRate: 0.01,
    });
  });

  describe('Initialization', () => {
    it('should initialize with default config', () => {
      const defaultGNN = new GraphNeuralNetwork();
      const config = defaultGNN.getConfig();
      expect(config.hiddenSize).toBe(64);
      expect(config.numLayers).toBe(2);
      expect(config.learningRate).toBe(0.01);
    });

    it('should initialize with custom config', () => {
      const config = gnn.getConfig();
      expect(config.hiddenSize).toBe(64);
      expect(config.numLayers).toBe(2);
      expect(config.learningRate).toBe(0.01);
    });

    it('should have zero nodes and edges initially', () => {
      const metrics = gnn.getMetrics();
      expect(metrics.nodeCount).toBe(0);
      expect(metrics.edgeCount).toBe(0);
    });
  });

  describe('Node Management', () => {
    it('should add nodes', () => {
      const node: StockNode = {
        id: 'AAPL',
        sector: 'Technology',
        marketCap: 2500000000000,
        volatility: 0.25,
        returns: [0.05, 0.03, -0.02, 0.04],
      };

      gnn.addNode(node);

      const metrics = gnn.getMetrics();
      expect(metrics.nodeCount).toBe(1);
    });

    it('should add multiple nodes', () => {
      const nodes: StockNode[] = [
        { id: 'AAPL', sector: 'Technology', marketCap: 2500000000000, volatility: 0.25, returns: [0.05, 0.03] },
        { id: 'MSFT', sector: 'Technology', marketCap: 2000000000000, volatility: 0.22, returns: [0.04, 0.02] },
        { id: 'GOOGL', sector: 'Technology', marketCap: 1800000000000, volatility: 0.28, returns: [0.06, 0.04] },
      ];

      nodes.forEach(node => gnn.addNode(node));

      const metrics = gnn.getMetrics();
      expect(metrics.nodeCount).toBe(3);
    });

    it('should get node by id', () => {
      const node: StockNode = {
        id: 'AAPL',
        sector: 'Technology',
        marketCap: 2500000000000,
        volatility: 0.25,
        returns: [0.05, 0.03],
      };

      gnn.addNode(node);
      const retrieved = gnn.getNode('AAPL');

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe('AAPL');
    });

    it('should return undefined for non-existent node', () => {
      const node = gnn.getNode('NONEXISTENT');
      expect(node).toBeUndefined();
    });
  });

  describe('Edge Management', () => {
    it('should add edges', () => {
      const node1: StockNode = {
        id: 'AAPL',
        sector: 'Technology',
        marketCap: 2500000000000,
        volatility: 0.25,
        returns: [0.05, 0.03],
      };

      const node2: StockNode = {
        id: 'MSFT',
        sector: 'Technology',
        marketCap: 2000000000000,
        volatility: 0.22,
        returns: [0.04, 0.02],
      };

      gnn.addNode(node1);
      gnn.addNode(node2);

      const edge: StockEdge = {
        source: 'AAPL',
        target: 'MSFT',
        correlation: 0.85,
        weight: 0.85,
      };

      gnn.addEdge(edge);

      const metrics = gnn.getMetrics();
      expect(metrics.edgeCount).toBe(1);
    });

    it('should add multiple edges', () => {
      const nodes: StockNode[] = [
        { id: 'AAPL', sector: 'Technology', marketCap: 2500000000000, volatility: 0.25, returns: [0.05, 0.03] },
        { id: 'MSFT', sector: 'Technology', marketCap: 2000000000000, volatility: 0.22, returns: [0.04, 0.02] },
        { id: 'GOOGL', sector: 'Technology', marketCap: 1800000000000, volatility: 0.28, returns: [0.06, 0.04] },
      ];

      nodes.forEach(node => gnn.addNode(node));

      const edges: StockEdge[] = [
        { source: 'AAPL', target: 'MSFT', correlation: 0.85, weight: 0.85 },
        { source: 'AAPL', target: 'GOOGL', correlation: 0.78, weight: 0.78 },
        { source: 'MSFT', target: 'GOOGL', correlation: 0.82, weight: 0.82 },
      ];

      edges.forEach(edge => gnn.addEdge(edge));

      const metrics = gnn.getMetrics();
      expect(metrics.edgeCount).toBe(3);
    });

    it('should get neighbors', () => {
      const nodes: StockNode[] = [
        { id: 'AAPL', sector: 'Technology', marketCap: 2500000000000, volatility: 0.25, returns: [0.05, 0.03] },
        { id: 'MSFT', sector: 'Technology', marketCap: 2000000000000, volatility: 0.22, returns: [0.04, 0.02] },
        { id: 'GOOGL', sector: 'Technology', marketCap: 1800000000000, volatility: 0.28, returns: [0.06, 0.04] },
      ];

      nodes.forEach(node => gnn.addNode(node));

      const edges: StockEdge[] = [
        { source: 'AAPL', target: 'MSFT', correlation: 0.85, weight: 0.85 },
        { source: 'AAPL', target: 'GOOGL', correlation: 0.78, weight: 0.78 },
      ];

      edges.forEach(edge => gnn.addEdge(edge));

      const neighbors = gnn.getNeighbors('AAPL');
      expect(neighbors.length).toBe(2);
    });

    it('should return empty array for node with no neighbors', () => {
      const node: StockNode = {
        id: 'AAPL',
        sector: 'Technology',
        marketCap: 2500000000000,
        volatility: 0.25,
        returns: [0.05, 0.03],
      };

      gnn.addNode(node);
      const neighbors = gnn.getNeighbors('AAPL');
      expect(neighbors.length).toBe(0);
    });
  });

  describe('Risk Analysis', () => {
    it('should analyze risk', () => {
      const nodes: StockNode[] = [
        { id: 'AAPL', sector: 'Technology', marketCap: 2500000000000, volatility: 0.25, returns: [0.05, 0.03, -0.02, 0.04] },
        { id: 'MSFT', sector: 'Technology', marketCap: 2000000000000, volatility: 0.22, returns: [0.04, 0.02, -0.01, 0.03] },
      ];

      nodes.forEach(node => gnn.addNode(node));

      const edge: StockEdge = {
        source: 'AAPL',
        target: 'MSFT',
        correlation: 0.85,
        weight: 0.85,
      };

      gnn.addEdge(edge);

      const risk = gnn.analyzeRisk();

      expect(risk).toHaveProperty('systemicRisk');
      expect(risk).toHaveProperty('concentrationRisk');
      expect(risk).toHaveProperty('volatilityRisk');
      expect(risk).toHaveProperty('correlationRisk');
    });

    it('should detect high correlation risk', () => {
      const nodes: StockNode[] = [
        { id: 'AAPL', sector: 'Technology', marketCap: 2500000000000, volatility: 0.25, returns: [0.05, 0.03] },
        { id: 'MSFT', sector: 'Technology', marketCap: 2000000000000, volatility: 0.22, returns: [0.04, 0.02] },
        { id: 'GOOGL', sector: 'Technology', marketCap: 1800000000000, volatility: 0.28, returns: [0.06, 0.04] },
      ];

      nodes.forEach(node => gnn.addNode(node));

      const edges: StockEdge[] = [
        { source: 'AAPL', target: 'MSFT', correlation: 0.95, weight: 0.95 },
        { source: 'AAPL', target: 'GOOGL', correlation: 0.92, weight: 0.92 },
        { source: 'MSFT', target: 'GOOGL', correlation: 0.90, weight: 0.90 },
      ];

      edges.forEach(edge => gnn.addEdge(edge));

      const risk = gnn.analyzeRisk();
      expect(risk.correlationRisk).toBeGreaterThan(0.5);
    });

    it('should detect concentration risk', () => {
      const nodes: StockNode[] = [
        { id: 'AAPL', sector: 'Technology', marketCap: 2500000000000, volatility: 0.25, returns: [0.05, 0.03] },
        { id: 'MSFT', sector: 'Technology', marketCap: 2000000000000, volatility: 0.22, returns: [0.04, 0.02] },
        { id: 'GOOGL', sector: 'Technology', marketCap: 1800000000000, volatility: 0.28, returns: [0.06, 0.04] },
      ];

      nodes.forEach(node => gnn.addNode(node));

      const risk = gnn.analyzeRisk();
      expect(risk.concentrationRisk).toBeGreaterThan(0);
    });
  });

  describe('Anomaly Detection', () => {
    it('should detect anomalies', () => {
      const nodes: StockNode[] = [
        { id: 'AAPL', sector: 'Technology', marketCap: 2500000000000, volatility: 0.25, returns: [0.05, 0.03, -0.02, 0.04] },
        { id: 'MSFT', sector: 'Technology', marketCap: 2000000000000, volatility: 0.22, returns: [0.04, 0.02, -0.01, 0.03] },
        { id: 'VOLATILE', sector: 'Technology', marketCap: 1000000000, volatility: 0.85, returns: [0.5, -0.4, 0.6, -0.3] },
      ];

      nodes.forEach(node => gnn.addNode(node));

      const anomalies = gnn.detectAnomalies();

      expect(Array.isArray(anomalies)).toBe(true);
    });

    it('should detect high volatility as anomaly', () => {
      const nodes: StockNode[] = [
        { id: 'AAPL', sector: 'Technology', marketCap: 2500000000000, volatility: 0.25, returns: [0.05, 0.03, -0.02, 0.04] },
        { id: 'MSFT', sector: 'Technology', marketCap: 2000000000000, volatility: 0.22, returns: [0.04, 0.02, -0.01, 0.03] },
        { id: 'VOLATILE', sector: 'Technology', marketCap: 1000000000, volatility: 0.95, returns: [0.8, -0.7, 0.9, -0.6] },
      ];

      nodes.forEach(node => gnn.addNode(node));

      const anomalies = gnn.detectAnomalies();
      expect(anomalies.length).toBeGreaterThan(0);
    });
  });

  describe('Metrics', () => {
    it('should return metrics', () => {
      const metrics = gnn.getMetrics();
      expect(metrics).toHaveProperty('nodeCount');
      expect(metrics).toHaveProperty('edgeCount');
      expect(metrics).toHaveProperty('avgDegree');
      expect(metrics).toHaveProperty('density');
    });

    it('should calculate average degree', () => {
      const nodes: StockNode[] = [
        { id: 'AAPL', sector: 'Technology', marketCap: 2500000000000, volatility: 0.25, returns: [0.05, 0.03] },
        { id: 'MSFT', sector: 'Technology', marketCap: 2000000000000, volatility: 0.22, returns: [0.04, 0.02] },
        { id: 'GOOGL', sector: 'Technology', marketCap: 1800000000000, volatility: 0.28, returns: [0.06, 0.04] },
      ];

      nodes.forEach(node => gnn.addNode(node));

      const edges: StockEdge[] = [
        { source: 'AAPL', target: 'MSFT', correlation: 0.85, weight: 0.85 },
        { source: 'AAPL', target: 'GOOGL', correlation: 0.78, weight: 0.78 },
        { source: 'MSFT', target: 'GOOGL', correlation: 0.82, weight: 0.82 },
      ];

      edges.forEach(edge => gnn.addEdge(edge));

      const metrics = gnn.getMetrics();
      expect(metrics.avgDegree).toBeGreaterThan(0);
      expect(metrics.density).toBeGreaterThan(0);
    });
  });

  describe('Reset', () => {
    it('should reset graph', () => {
      const node: StockNode = {
        id: 'AAPL',
        sector: 'Technology',
        marketCap: 2500000000000,
        volatility: 0.25,
        returns: [0.05, 0.03],
      };

      gnn.addNode(node);

      gnn.reset();

      const metrics = gnn.getMetrics();
      expect(metrics.nodeCount).toBe(0);
      expect(metrics.edgeCount).toBe(0);
    });
  });

  describe('Configuration', () => {
    it('should get config', () => {
      const config = gnn.getConfig();
      expect(config).toBeDefined();
      expect(config.hiddenSize).toBe(64);
      expect(config.numLayers).toBe(2);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty graph', () => {
      const risk = gnn.analyzeRisk();
      expect(risk.systemicRisk).toBe(0);
      expect(risk.concentrationRisk).toBe(0);
    });

    it('should handle single node', () => {
      const node: StockNode = {
        id: 'AAPL',
        sector: 'Technology',
        marketCap: 2500000000000,
        volatility: 0.25,
        returns: [0.05, 0.03],
      };

      gnn.addNode(node);

      const risk = gnn.analyzeRisk();
      expect(risk.concentrationRisk).toBeGreaterThan(0);
    });

    it('should handle disconnected graph', () => {
      const nodes: StockNode[] = [
        { id: 'AAPL', sector: 'Technology', marketCap: 2500000000000, volatility: 0.25, returns: [0.05, 0.03] },
        { id: 'MSFT', sector: 'Technology', marketCap: 2000000000000, volatility: 0.22, returns: [0.04, 0.02] },
      ];

      nodes.forEach(node => gnn.addNode(node));

      // No edges added
      const risk = gnn.analyzeRisk();
      expect(risk.correlationRisk).toBe(0);
    });
  });
});
