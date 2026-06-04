// Q49: Snapshot Testing — Playwright screenshot comparison
// Captures key UI pages and compares against baselines to detect regressions

import { test, expect, Page, ElectronApplication } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

const SNAPSHOT_DIR = path.join(__dirname, '..', 'snapshots');
const BASELINE_DIR = path.join(SNAPSHOT_DIR, 'baseline');
const CURRENT_DIR  = path.join(SNAPSHOT_DIR, 'current');

// Ensure snapshot directories exist
for (const d of [BASELINE_DIR, CURRENT_DIR]) {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
}

interface SnapshotConfig {
  name: string;
  url: string;
  waitFor?: string;   // CSS selector to wait for
  hidden?: string[];  // selectors to hide before screenshot
}

// Key pages/components to snapshot
const SNAPSHOT_TARGETS: SnapshotConfig[] = [
  { name: 'dashboard-main',    url: '/dashboard',    waitFor: '[data-testid="dashboard"]' },
  { name: 'portfolio-table',   url: '/portfolio',     waitFor: '[data-testid="portfolio"]' },
  { name: 'strategy-cards',    url: '/strategy',     waitFor: '[data-testid="strategy-list"]' },
  { name: 'risk-gauge',        url: '/risk',         waitFor: '[data-testid="risk-panel"]' },
  { name: 'market-overview',   url: '/market',       waitFor: '[data-testid="market"]' },
];

// ── Helpers ─────────────────────────────────────────────────────────────────────

async function screenshotPage(
  page: Page,
  config: SnapshotConfig,
  outputPath: string
): Promise<void> {
  await page.goto(`file://${page.context().urls()[0]}${config.url}`, {
    waitUntil: 'domcontentloaded',
  });

  if (config.waitFor) {
    await page.waitForSelector(config.waitFor, { timeout: 10_000 }).catch(() => {/* ignore */});
  }

  // Hide volatile elements that change on every load
  if (config.hidden) {
    for (const sel of config.hidden) {
      await page.locator(sel).evaluate((el: HTMLElement) => {
        el.style.visibility = 'hidden';
      });
    }
  }

  await page.screenshot({
    path: outputPath,
    fullPage: false,
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe.serial('Q49: Snapshot Testing (Playwright)', () => {
  let electronApp: ElectronApplication;
  let mainPage: Page;

  test.beforeAll(async () => {
    electronApp = await ElectronApplication.launch({
      executablePath: require('electron'),
      args: ['.'],
    });
    mainPage = await electronApp.firstWindow();
    await mainPage.waitForLoadState('domcontentloaded');
  });

  test.afterAll(async () => {
    await electronApp.close();
  });

  for (const target of SNAPSHOT_TARGETS) {
    test(`capture: ${target.name}`, async () => {
      const baselinePath = path.join(BASELINE_DIR, `${target.name}.png`);
      const currentPath  = path.join(CURRENT_DIR,  `${target.name}.png`);

      await screenshotPage(mainPage, target, currentPath);

      if (!fs.existsSync(baselinePath)) {
        // First run: save baseline
        fs.copyFileSync(currentPath, baselinePath);
        console.log(`📸 Baseline created for ${target.name}`);
      } else {
        // Compare with baseline
        const currentBuffer = fs.readFileSync(currentPath);
        const baselineBuffer = fs.readFileSync(baselinePath);

        expect(currentBuffer.length).toBeGreaterThan(1000); // sanity check
        // For pixel-level comparison, use pixelmatch in CI
        // Here we just verify the file was captured
        expect(currentBuffer.equals(baselineBuffer) || !fs.existsSync(baselinePath))
          .toBeTruthy();
      }
    });
  }

  test('all snapshot targets are defined', () => {
    expect(SNAPSHOT_TARGETS).toHaveLength(5);
    expect(SNAPSHOT_TARGETS.map((t) => t.name)).toEqual([
      'dashboard-main',
      'portfolio-table',
      'strategy-cards',
      'risk-gauge',
      'market-overview',
    ]);
  });
});
