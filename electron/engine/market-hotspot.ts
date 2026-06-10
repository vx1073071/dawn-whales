// ── Market Hotspot Discovery — Trending Topics & Hot Stocks ────────────────
// JVS-8: Aggregates hotspot data from EM hotspot skill + futu news search
// Returns structured hotspot report with trending sectors, themes, stocks

import log from 'electron-log';
import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';

// ── Types ──────────────────────────────────────────────────────────────────

export interface HotspotItem {
  id: string;
  title: string;
  category: 'sector' | 'theme' | 'stock' | 'event' | 'policy';
  heat: number;           // 0-100 heat score
  description: string;
  relatedStocks: string[];
  relatedSectors: string[];
  source: string;
  url: string;
  timestamp: number;
}

export interface HotStock {
  code: string;
  name: string;
  reason: string;         // Why it's hot
  changePct: number;
  heatScore: number;      // 0-100
  mentions: number;       // Number of mentions in news
}

export interface HotspotReport {
  success: boolean;
  hotspots: HotspotItem[];
  hotStocks: HotStock[];
  topSectors: string[];
  topThemes: string[];
  summary: string;
  timestamp: number;
  source: string;
  error?: string;
}

export interface HotspotQuery {
  type?: 'all' | 'sector' | 'stock' | 'theme';
  limit?: number;
}

// ── Script Paths ───────────────────────────────────────────────────────────

const HOTSPOT_SCRIPT_PATHS = [
  path.join('C:', 'Users', 'vx107', '.easyclaw', 'workspace', 'skills', 'em-stock-market-hotspot-discovery', 'scripts', 'get_data.py'),
];

// ── Market Hotspot Service ─────────────────────────────────────────────────

export class MarketHotspotService {
  private scriptPath: string | null = null;
  private cache: { data: HotspotReport; expires: number } | null = null;
  private static CACHE_TTL = 15 * 60 * 1000; // 15 minutes

  constructor() {
    this.detectScript();
    log.info(`[MarketHotspot] Initialized, script: ${this.scriptPath || 'NOT FOUND'}`);
  }

  private detectScript(): void {
    for (const p of HOTSPOT_SCRIPT_PATHS) {
      if (fs.existsSync(p)) { this.scriptPath = p; return; }
    }
  }

  /**
   * Get current market hotspot report
   */
  async getReport(query?: HotspotQuery): Promise<HotspotReport> {
    const now = Date.now();
    const limit = query?.limit || 20;

    // Check cache
    if (this.cache && this.cache.expires > now) {
      return this.filterReport(this.cache.data, query);
    }

    // Fetch from script
    try {
      const rawContent = await this.fetchHotspot();
      const report = this.parseHotspotContent(rawContent);
      this.cache = { data: report, expires: now + MarketHotspotService.CACHE_TTL };
      return this.filterReport(report, query);
    } catch (err: unknown) {
      log.warn('[MarketHotspot] Fetch failed:', err.message);
      return {
        success: false,
        hotspots: [],
        hotStocks: [],
        topSectors: [],
        topThemes: [],
        summary: 'Failed to fetch hotspot data',
        timestamp: now,
        source: 'none',
        error: err.message,
      };
    }
  }

  /**
   * Fetch hotspot data from EM script
   */
  private async fetchHotspot(): Promise<string> {
    if (!this.scriptPath) {
      throw new Error('Hotspot script not found');
    }

    const cmd = `python3 "${this.scriptPath}" --query "今日热点"`;

    return new Promise((resolve, reject) => {
      exec(cmd, {
        encoding: 'utf-8',
        timeout: 30000,
        maxBuffer: 10 * 1024 * 1024,
      }, (err, stdout) => {
        if (err) reject(err);
        else resolve(stdout || '');
      });
    });
  }

  /**
   * Parse Markdown hotspot content into structured data
   */
  private parseHotspotContent(raw: string): HotspotReport {
    const hotspots: HotspotItem[] = [];
    const hotStocks: HotStock[] = [];
    const sectorSet = new Set<string>();
    const themeSet = new Set<string>();

    // Parse sections
    const sections = raw.split(/^##\s+/m).filter(s => s.trim().length > 0);

    for (const section of sections) {
      const lines = section.split('\n');
      const title = lines[0].trim();
      const content = lines.slice(1).join('\n').trim();

      // Detect section type
      if (title.includes('热点') || title.includes('板块') || title.includes('赛道')) {
        const items = this.parseBulletItems(content);
        for (const item of items) {
          const category = this.detectCategory(item.title);
          if (category === 'sector') sectorSet.add(item.title);
          if (category === 'theme') themeSet.add(item.title);

          hotspots.push({
            id: `hs-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            title: item.title,
            category,
            heat: item.score || this.estimateHeat(item.content),
            description: item.content,
            relatedStocks: this.extractStockCodes(item.content),
            relatedSectors: this.extractSectors(item.content),
            source: 'East Money',
            url: '',
            timestamp: Date.now(),
          });
        }
      }

      if (title.includes('热股') || title.includes('活跃') || title.includes('龙头')) {
        const stockItems = this.parseStockList(content);
        hotStocks.push(...stockItems);
      }
    }

    // Sort by heat
    hotspots.sort((a, b) => b.heat - a.heat);
    hotStocks.sort((a, b) => b.heatScore - a.heatScore);

    const topSectors = [...sectorSet].slice(0, 5);
    const topThemes = [...themeSet].slice(0, 5);

    const summary = this.generateSummary(hotspots, hotStocks, topSectors);

    return {
      success: hotspots.length > 0 || hotStocks.length > 0,
      hotspots: hotspots.slice(0, 30),
      hotStocks: hotStocks.slice(0, 20),
      topSectors,
      topThemes,
      summary,
      timestamp: Date.now(),
      source: 'em-hotspot',
    };
  }

  private parseBulletItems(content: string): { title: string; content: string; score?: number }[] {
    const items: { title: string; content: string; score?: number }[] = [];
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      // Match bullet points: - item, * item, 1. item
      const match = trimmed.match(/^(?:[-*•]\s*|\d+[.)]\s*)(.+)/);
      if (match) {
        const text = match[1].trim();
        // Try to split title: description
        const colonIdx = text.indexOf('：') !== -1 ? text.indexOf('：') : text.indexOf(':');
        if (colonIdx > 0 && colonIdx < 20) {
          items.push({
            title: text.slice(0, colonIdx).trim(),
            content: text.slice(colonIdx + 1).trim(),
          });
        } else {
          items.push({ title: text, content: '' });
        }
      }
    }

    return items;
  }

  private parseStockList(content: string): HotStock[] {
    const stocks: HotStock[] = [];
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      // Match stock mentions: code + name or just name
      const codeMatch = trimmed.match(/([036]\d{5})/);
      const nameMatch = trimmed.match(/[\u4e00-\u9fa5]{2,8}(?:股份|科技|电子|集团|控股|医药|能源|汽车|银行)?/);

      if (codeMatch || nameMatch) {
        const code = codeMatch ? codeMatch[1] : '';
        const name = nameMatch ? nameMatch[0] : '';
        const pctMatch = trimmed.match(/[+-]?\d+\.?\d*%/);
        const changePct = pctMatch ? parseFloat(pctMatch[0]) : 0;

        stocks.push({
          code,
          name,
          reason: trimmed,
          changePct,
          heatScore: this.estimateHeat(trimmed),
          mentions: 1,
        });
      }
    }

    return stocks;
  }

  private detectCategory(title: string): HotspotItem['category'] {
    if (title.includes('板块') || title.includes('行业') || title.includes('产业')) return 'sector';
    if (title.includes('概念') || title.includes('主题') || title.includes('题材')) return 'theme';
    if (title.includes('股') || title.includes('公司') || title.match(/[036]\d{5}/)) return 'stock';
    if (title.includes('政策') || title.includes('监管') || title.includes('法规')) return 'policy';
    return 'event';
  }

  private estimateHeat(text: string): number {
    let heat = 50; // Base
    // Boost for hot keywords
    const hotWords = ['暴涨', '涨停', '突破', '新高', '爆发', '井喷', '火爆', '大涨', '领涨'];
    for (const w of hotWords) {
      if (text.includes(w)) heat += 10;
    }
    // Reduce for cool words
    const coolWords = ['下跌', '回调', '调整', '走弱'];
    for (const w of coolWords) {
      if (text.includes(w)) heat -= 5;
    }
    return Math.max(0, Math.min(100, heat));
  }

  private extractStockCodes(text: string): string[] {
    const codes = text.match(/[036]\d{5}/g);
    return codes ? [...new Set(codes)] : [];
  }

  private extractSectors(text: string): string[] {
    const sectors: string[] = [];
    const sectorPatterns = [
      /([\u4e00-\u9fa5]{2,6})板块/,
      /([\u4e00-\u9fa5]{2,6})行业/,
      /([\u4e00-\u9fa5]{2,6})产业/,
    ];
    for (const p of sectorPatterns) {
      const matches = text.matchAll(p);
      for (const m of matches) {
        sectors.push(m[1]);
      }
    }
    return [...new Set(sectors)];
  }

  private generateSummary(
    hotspots: HotspotItem[],
    hotStocks: HotStock[],
    topSectors: string[]
  ): string {
    const parts: string[] = [];

    if (hotspots.length > 0) {
      parts.push(`${hotspots.length} hot topics detected`);
    }

    if (topSectors.length > 0) {
      parts.push(`Top sectors: ${topSectors.slice(0, 3).join(', ')}`);
    }

    if (hotStocks.length > 0) {
      parts.push(`${hotStocks.length} trending stocks`);
    }

    return parts.join('. ') || 'No significant market hotspots detected';
  }

  private filterReport(report: HotspotReport, query?: HotspotQuery): HotspotReport {
    if (!query || query.type === 'all') return report;

    const filtered = { ...report };

    if (query.type === 'sector') {
      filtered.hotspots = report.hotspots.filter(h => h.category === 'sector');
    } else if (query.type === 'stock') {
      filtered.hotspots = report.hotspots.filter(h => h.category === 'stock');
      filtered.hotStocks = report.hotStocks; // Keep all hot stocks
    } else if (query.type === 'theme') {
      filtered.hotspots = report.hotspots.filter(h => h.category === 'theme');
    }

    if (query.limit) {
      filtered.hotspots = filtered.hotspots.slice(0, query.limit);
    }

    return filtered;
  }

  clearCache(): void {
    this.cache = null;
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────

let hotspotServiceInstance: MarketHotspotService | null = null;

export function getMarketHotspotService(): MarketHotspotService {
  if (!hotspotServiceInstance) {
    hotspotServiceInstance = new MarketHotspotService();
  }
  return hotspotServiceInstance;
}
