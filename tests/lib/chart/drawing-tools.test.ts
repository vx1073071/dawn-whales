import { describe, it, expect } from 'vitest';
import {
  createTrendLine, createFibRetracement, createFibExtension,
  createParallelChannel, createPitchfork, createRectangle,
  createTextAnnotation, createLabelCallout, createArrowMarker,
  createDrawingCollection, addDrawing, removeDrawing,
  updateDrawing, selectDrawing, undoDrawing, redoDrawing,
  clearDrawings, clearAllDrawings,
  computeFibLevels, computeFibExtensionLevels,
  computeChannelOffset, pointNearLine, getDrawingColor,
  serializeDrawing, deserializeDrawing,
  serializeCollection, deserializeCollection,
} from '../../../src/lib/chart/drawing-tools';
import type { DrawingCollection } from '../../../src/lib/chart/drawing-tools';

function makePt(price: number, time: number, x = 100, y = 100): import('../../../src/lib/chart/drawing-tools').Point {
  return { x: x + price * 2, y: y - price * 2, price, time };
}

describe('Drawing Tools Core R113', () => {
  describe('Factory functions', () => {
    const p1 = makePt(100, 1000);
    const p2 = makePt(110, 2000);

    it('createTrendLine', () => {
      const d = createTrendLine(p1, p2);
      expect(d.type).toBe('trend-line');
      expect(d.points).toHaveLength(2);
      expect(d.extendRight).toBe(true);
    });

    it('createFibRetracement', () => {
      const d = createFibRetracement(p1, p2);
      expect(d.type).toBe('fib-retracement');
      expect(d.levels).toEqual([0, 0.236, 0.382, 0.5, 0.618, 0.786, 1]);
    });

    it('createFibExtension', () => {
      const p3 = makePt(120, 3000);
      const d = createFibExtension(p1, p2, p3);
      expect(d.type).toBe('fib-extension');
      expect(d.points).toHaveLength(3);
      expect(d.levels).toContain(1.618);
    });

    it('createParallelChannel', () => {
      const p3 = makePt(115, 2500);
      const d = createParallelChannel(p1, p2, p3);
      expect(d.type).toBe('parallel-channel');
      expect(d.points).toHaveLength(3);
    });

    it('createPitchfork', () => {
      const p3 = makePt(115, 2500);
      const d = createPitchfork(p1, p2, p3);
      expect(d.type).toBe('pitchfork');
      expect(d.levels).toContain(0.5);
    });

    it('createRectangle', () => {
      const d = createRectangle(p1, p2);
      expect(d.type).toBe('rectangle');
      expect(d.filled).toBe(false);
    });

    it('createTextAnnotation', () => {
      const d = createTextAnnotation(p1, 'Test');
      expect(d.type).toBe('text');
      expect(d.content).toBe('Test');
    });

    it('createLabelCallout', () => {
      const d = createLabelCallout(p1, p2, 'Note');
      expect(d.type).toBe('label-callout');
      expect(d.points).toHaveLength(2);
    });

    it('createArrowMarker', () => {
      const d = createArrowMarker(p1, p2);
      expect(d.type).toBe('arrow-marker');
      expect(d.tipType).toBe('arrow');
    });
  });

  describe('Collection management', () => {
    let coll: DrawingCollection;

    beforeEach(() => {
      coll = createDrawingCollection();
    });

    it('starts empty', () => {
      expect(coll.drawings).toHaveLength(0);
      expect(coll.selectedId).toBeNull();
    });

    it('addDrawing', () => {
      const d = createTrendLine(makePt(100, 1000), makePt(110, 2000));
      coll = addDrawing(coll, d);
      expect(coll.drawings).toHaveLength(1);
      expect(coll.drawings[0].type).toBe('trend-line');
    });

    it('removeDrawing', () => {
      const d = createTrendLine(makePt(100, 1000), makePt(110, 2000));
      coll = addDrawing(coll, d);
      coll = removeDrawing(coll, d.id);
      expect(coll.drawings).toHaveLength(0);
    });

    it('selectDrawing', () => {
      const d = createTrendLine(makePt(100, 1000), makePt(110, 2000));
      coll = addDrawing(coll, d);
      coll = selectDrawing(coll, d.id);
      expect(coll.selectedId).toBe(d.id);
    });

    it('updateDrawing', () => {
      const d = createTrendLine(makePt(100, 1000), makePt(110, 2000));
      coll = addDrawing(coll, d);
      coll = updateDrawing(coll, d.id, { locked: true, label: 'Updated' });
      expect(coll.drawings[0].locked).toBe(true);
      expect(coll.drawings[0].label).toBe('Updated');
    });

    it('undo/redo', () => {
      const d1 = createTrendLine(makePt(100, 1000), makePt(110, 2000));
      coll = addDrawing(coll, d1);
      expect(coll.undoStack).toHaveLength(1); // has previous state

      coll = undoDrawing(coll);
      expect(coll.drawings).toHaveLength(0);
      expect(coll.redoStack).toHaveLength(1);

      coll = redoDrawing(coll);
      expect(coll.drawings).toHaveLength(1);
    });

    it('clearDrawings saves undo state', () => {
      const d = createTrendLine(makePt(100, 1000), makePt(110, 2000));
      coll = addDrawing(coll, d);
      coll = clearDrawings(coll);
      expect(coll.drawings).toHaveLength(0);
      expect(coll.undoStack).toHaveLength(1);
    });

    it('clearAllDrawings wipes everything', () => {
      const d = createTrendLine(makePt(100, 1000), makePt(110, 2000));
      coll = addDrawing(coll, d);
      coll = clearAllDrawings(coll);
      expect(coll.drawings).toHaveLength(0);
      expect(coll.undoStack).toHaveLength(0);
    });
  });

  describe('Geometry helpers', () => {
    const p1 = makePt(100, 1000, 0, 200);
    const p2 = makePt(120, 2000, 80, 40);

    it('computeFibLevels', () => {
      const levels = computeFibLevels(p1, p2, [0, 0.618, 1]);
      expect(levels).toHaveLength(3);
      expect(levels[0].price).toBeCloseTo(120, 2); // level 0 = at p2
      expect(levels[2].price).toBeCloseTo(100, 2); // level 1 = at p1
    });

    it('computeFibExtensionLevels', () => {
      const p3 = makePt(105, 3000);
      const levels = computeFibExtensionLevels(p1, p2, p3, [0, 1.618]);
      expect(levels).toHaveLength(2);
      expect(levels[1].level).toBe(1.618);
    });

    it('pointNearLine detects proximity', () => {
      expect(pointNearLine(50, 120, 0, 200, 80, 40, 10)).toBe(true);
      expect(pointNearLine(0, 0, 0, 200, 80, 40, 10)).toBe(false);
    });
  });

  describe('Serialization', () => {
    it('roundtrips drawing', () => {
      const d = createTrendLine(makePt(100, 1000), makePt(110, 2000));
      const json = serializeDrawing(d);
      const d2 = deserializeDrawing(json);
      expect(d2.type).toBe('trend-line');
      expect(d2.id).toBe(d.id);
    });

    it('roundtrips collection', () => {
      let coll = createDrawingCollection();
      const d = createTrendLine(makePt(100, 1000), makePt(110, 2000));
      coll = addDrawing(coll, d);
      const json = serializeCollection(coll);
      const c2 = deserializeCollection(json);
      expect(c2.drawings).toHaveLength(1);
      expect(c2.drawings[0].type).toBe('trend-line');
    });
  });

  describe('getDrawingColor', () => {
    it('returns correct colors for types', () => {
      expect(typeof getDrawingColor('trend-line')).toBe('string');
      expect(typeof getDrawingColor('fib-retracement')).toBe('string');
      expect(typeof getDrawingColor('rectangle')).toBe('string');
      expect(typeof getDrawingColor('unknown' as any)).toBe('string');
    });
  });

  describe('Unique IDs', () => {
    it('generates unique IDs', () => {
      const p = makePt(100, 1000);
      const d1 = createTrendLine(p, p);
      const d2 = createTrendLine(p, p);
      expect(d1.id).not.toBe(d2.id);
    });
  });
});