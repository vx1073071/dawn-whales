/**
 * Tests for earnings-calendar — R96 J-01
 */
import { describe, it, expect, vi } from 'vitest';
import {
  getEarningsCalendar,
  clearEarningsCalendarCache,
} from '../../../../electron/engine/data/earnings-calendar';

vi.mock('https', () => ({ default: { get: vi.fn() } }));
vi.mock('http', () => ({ default: { get: vi.fn() } }));

describe('earnings-calendar exports', () => {
  it('getEarningsCalendar is a function', () => {
    expect(typeof getEarningsCalendar).toBe('function');
  });
  it('clearEarningsCalendarCache is a function', () => {
    expect(typeof clearEarningsCalendarCache).toBe('function');
  });
  it('clearEarningsCalendarCache does not throw', () => {
    expect(() => clearEarningsCalendarCache()).not.toThrow();
  });
});
