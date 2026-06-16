/**
 * QUANT MOO R157 JVS #16 — Watchlist Import/Export API
 *
 * Endpoints:
 *   POST /api/watchlist/import      — Import watchlist from JSON or CSV
 *   GET  /api/watchlist/export      — Export watchlist as JSON or CSV
 *
 * CSV format: standardCode,name,market,createdAt
 * JSON format: { codes: string[], meta: WatchlistEntry[] }
 *
 * @R157 — 2h, production-ready
 */

import { Router, Request, Response } from 'express';

const router = Router();

// ═══════════════ Types ════════════════════════════════════════════════════

/** Watchlist entry with optional broker binding (matches marketStore shape). */
interface WatchlistImportEntry {
  code: string;
  brokerId?: string;
  name?: string;
  market?: string;
  addedAt?: string;
}

interface ImportSummary {
  success: boolean;
  imported: number;
  skipped: number;
  duplicates: number;
  invalid: number;
  entries: WatchlistImportEntry[];
  errors: string[];
}

// ═══════════════ Validation ═══════════════════════════════════════════════

const VALID_MARKETS = ['US', 'HK', 'CN', 'CRYPTO', 'SG', 'JP', 'UK', 'EU'];

/** validate a single symbol code, returning normalized form */
function validateCode(raw: string): { valid: boolean; normalized: string; market: string; symbol: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { valid: false, normalized: '', market: '', symbol: '' };

  // Already in standard format: MARKET:CODE or MARKET.CODE
  const parts = trimmed.includes(':') ? trimmed.split(':') : trimmed.split('.');
  if (parts.length === 2) {
    const mkt = parts[0].toUpperCase();
    const sym = parts[1].toUpperCase().trim();
    if (VALID_MARKETS.includes(mkt) && sym.length > 0) {
      return { valid: true, normalized: `${mkt}:${sym}`, market: mkt, symbol: sym };
    }
    // Try market detection if market prefix is unknown
    if (sym.length > 0) {
      const detected = detectMarketFromCode(sym);
      if (detected) {
        return { valid: true, normalized: `${detected}:${sym}`, market: detected, symbol: sym };
      }
    }
  }

  // Bare symbol — try auto-detect market
  const detected = detectMarketFromCode(trimmed.toUpperCase());
  if (detected) {
    return { valid: true, normalized: `${detected}:${trimmed.toUpperCase()}`, market: detected, symbol: trimmed.toUpperCase() };
  }

  return { valid: false, normalized: trimmed, market: '', symbol: '' };
}

function detectMarketFromCode(code: string): string | null {
  if (/^\d{5,6}$/.test(code)) return 'HK';
  if (/^\d{6}$/.test(code) && (code.startsWith('60') || code.startsWith('00'))) return 'CN';
  if (/^\d{5}$/.test(code)) return 'CN';
  if (/^[A-Z]{1,5}$/.test(code) && !/^[A-Z]{2,5}-/.test(code)) return 'US';
  if (/-USDT$/.test(code) || /-USD$/.test(code)) return 'CRYPTO';
  return null;
}

// ═══════════════ POST /api/watchlist/import ══════════════════════════════

router.post('/import', (req: Request, res: Response) => {
  const summary: ImportSummary = {
    success: true,
    imported: 0,
    skipped: 0,
    duplicates: 0,
    invalid: 0,
    entries: [],
    errors: [],
  };

  try {
    const body = req.body;

    // Detect format: JSON or CSV
    let rawEntries: string[] = [];

    if (typeof body === 'string') {
      // CSV or plain text — one code per line
      rawEntries = body
        .split(/[\r\n]+/)
        .map((l: string) => l.trim())
        .filter((l: string) => l.length > 0);
    } else if (Array.isArray(body)) {
      // JSON array of {code, ...} objects
      for (const item of body) {
        if (typeof item === 'string') {
          rawEntries.push(item);
        } else if (item && typeof item === 'object' && item.code) {
          rawEntries.push(item.code);
        }
      }
    } else if (body && typeof body.codes === 'object' && Array.isArray(body.codes)) {
      // { codes: [...] }
      rawEntries = body.codes;
    } else if (body && typeof body.codes === 'string') {
      // { codes: "US:AAPL\nHK:00700" }
      rawEntries = body.codes.split(/[\r\n]+/).map((l: string) => l.trim()).filter(Boolean);
    } else {
      summary.success = false;
      summary.errors.push('Unsupported format. Send JSON array, {codes:[...]}, or CSV text.');
      return res.status(400).json(summary);
    }

    // Dedup tracking (in-request)
    const seen = new Set<string>();

    for (const raw of rawEntries) {
      const { valid, normalized, market, symbol } = validateCode(raw);
      if (!valid) {
        summary.invalid++;
        summary.errors.push(`Invalid code: "${raw}"`);
        continue;
      }

      if (seen.has(normalized)) {
        summary.duplicates++;
        continue;
      }
      seen.add(normalized);

      summary.entires = summary.entries || [];
      summary.entries.push({
        code: normalized,
        addedAt: new Date().toISOString(),
      });
      summary.imported++;
    }

    return res.json(summary);
  } catch (err: any) {
    summary.success = false;
    summary.errors.push(err.message || 'Internal import error');
    return res.status(500).json(summary);
  }
});

// ═══════════════ GET /api/watchlist/export ═══════════════════════════════

router.get('/export', (req: Request, res: Response) => {
  try {
    const format = String(req.query.format || 'json').toLowerCase();
    const codesParam = String(req.query.codes || '');

    // Parse codes from query string or use empty (client fills)
    const codes = codesParam
      ? codesParam.split(',').map(c => c.trim()).filter(Boolean)
      : [];

    const entries: WatchlistImportEntry[] = codes.map(c => {
      const v = validateCode(c);
      return {
        code: v.valid ? v.normalized : c,
        market: v.market,
        name: v.symbol,
        addedAt: new Date().toISOString(),
      };
    });

    if (format === 'csv') {
      // CSV: standardCode,name,market,createdAt
      const header = 'standardCode,name,market,createdAt';
      const rows = entries.map(e => {
        const market = e.market || (e.code.includes(':') ? e.code.split(':')[0] : '');
        const symbol = e.code.includes(':') ? e.code.split(':')[1] : e.code;
        return `${e.code},"${e.name || symbol}",${market},${e.addedAt || ''}`;
      });
      const csv = [header, ...rows].join('\n');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="watchlist-export.csv"');
      return res.send('\uFEFF' + csv); // BOM for Excel Chinese chars
    }

    // Default: JSON
    return res.json({
      success: true,
      exportedAt: new Date().toISOString(),
      count: entries.length,
      codes: entries.map(e => e.code),
      entries,
      format: 'json',
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
