/**
 * Tests for dividend-calendar — R96 J-01
 */
import { describe, it, expect, vi } from 'vitest';
import {
  getDividendCalendar,
  clearDividendCalendarCache,
} from '../../../../electron/engine/data/dividend-calendar';

vi.mock('https', () => ({ default: { get: vi.fn() } }));
vi.mock('http', () => ({ default: { get: vi.fn() } }));

describe('dividend-calendar exports', () => {
  it('getDividendCalendar is a function', () => {
    expect(typeof getDividendCalendar).toBe('function');
  });
  it('clearDividendCalendarCache is a function', () => {
    expect(typeof clearDividendCalendarCache).toBe('function');
  });
  it('clearDividendCalendarCache does not throw', () => {
    expect(() => clearDividendCalendarCache()).not.toThrow();
  });
});
