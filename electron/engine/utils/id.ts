/**
 * ID generation utility for engine modules.
 */
import { randomUUID, randomBytes } from 'crypto';

export function generateId(prefix?: string): string {
  let id: string;
  try {
    id = randomUUID().replace(/-/g, '').slice(0, 16);
  } catch {
    // Fallback for environments without randomUUID
    id = randomBytes(8).toString('hex');
  }
  return prefix ? `${prefix}_${id}` : id;
}
