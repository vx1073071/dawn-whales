/**
 * ID generation utility for engine modules.
 */
import { randomUUID } from 'crypto';

export function generateId(prefix?: string): string {
  const id = randomUUID().replace(/-/g, '').slice(0, 16);
  return prefix ? `${prefix}_${id}` : id;
}
