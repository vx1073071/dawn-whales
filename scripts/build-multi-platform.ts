/**
 * Multi-Platform Build & Package Script — ML-48-02 [P0]
 * R48+R49: Windows .exe + macOS .dmg + Linux .AppImage/.deb
 *
 * Usage:
 *   npm run dist:win    → Windows NSIS installer (.exe)
 *   npm run dist:mac    → macOS DMG (x64 + arm64)
 *   npm run dist:linux  → Linux AppImage + deb
 *   npm run dist:all    → All platforms (CI)
 *
 * Prerequisites:
 *   - Windows: No extra deps (NSIS bundled with electron-builder)
 *   - macOS: Xcode Command Line Tools + valid Apple Developer cert
 *   - Linux: dpkg-dev, fakeroot (for .deb)
 */

import { execSync } from 'child_process';
import { existsSync, mkdirSync, copyFileSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '..');
const RELEASE_DIR = join(ROOT, 'release');

interface BuildResult {
  platform: string;
  target: string;
  path: string;
  size: number;
  success: boolean;
}

function formatSize(bytes: number): string {
  if (bytes > 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes > 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

function buildPlatform(platform: 'win' | 'mac' | 'linux'): BuildResult[] {
  const results: BuildResult[] = [];

  console.log(`\n📦 Building for ${platform}...`);

  try {
    // Run vite build first
    execSync('npm run build', { cwd: ROOT, stdio: 'inherit' });

    // Run electron-builder for the platform
    execSync(`npx electron-builder --${platform} --publish never`, {
      cwd: ROOT,
      stdio: 'inherit',
      env: { ...process.env, CSC_IDENTITY_AUTO_DISCOVERY: 'false' },
    });

    // Collect results
    if (!existsSync(RELEASE_DIR)) {
      console.warn(`⚠️  Release directory not found: ${RELEASE_DIR}`);
      return results;
    }

    const { readdirSync, statSync } = require('fs');
    const files = readdirSync(RELEASE_DIR).filter(
      (f: string) => f.endsWith('.exe') || f.endsWith('.dmg') || f.endsWith('.AppImage') || f.endsWith('.deb')
    );

    for (const file of files) {
      const fullPath = join(RELEASE_DIR, file);
      const stat = statSync(fullPath);
      results.push({
        platform,
        target: file.includes('.exe') ? 'nsis' : file.includes('.dmg') ? 'dmg' : file.includes('.AppImage') ? 'AppImage' : 'deb',
        path: fullPath,
        size: stat.size,
        success: true,
      });
    }
  } catch (err: any) {
    console.error(`❌ Build failed for ${platform}:`, err.message);
    results.push({
      platform,
      target: platform,
      path: '',
      size: 0,
      success: false,
    });
  }

  return results;
}

function printSummary(results: BuildResult[]) {
  console.log('\n' + '='.repeat(60));
  console.log('  📦 DAWN WHALES — Multi-Platform Build Summary');
  console.log('='.repeat(60));

  const byPlatform: Record<string, BuildResult[]> = {};
  for (const r of results) {
    if (!byPlatform[r.platform]) byPlatform[r.platform] = [];
    byPlatform[r.platform].push(r);
  }

  for (const [platform, items] of Object.entries(byPlatform)) {
    const allSuccess = items.every(r => r.success);
    const icon = allSuccess ? '✅' : '❌';
    console.log(`\n  ${icon} ${platform.toUpperCase()}:`);
    for (const item of items) {
      if (item.success) {
        console.log(`     └─ ${item.target}: ${item.path} (${formatSize(item.size)})`);
      } else {
        console.log(`     └─ ${item.target}: ❌ Failed`);
      }
    }
  }

  const totalSuccess = results.filter(r => r.success).length;
  console.log(`\n  📊 Total: ${totalSuccess}/${results.length} artifacts built`);
  console.log('='.repeat(60) + '\n');
}

// ── Main ────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const platform = args[0] || 'all';

  if (!['win', 'mac', 'linux', 'all'].includes(platform)) {
    console.error(`Usage: npx tsx scripts/build-multi-platform.ts [win|mac|linux|all]`);
    process.exit(1);
  }

  // Ensure release directory
  if (!existsSync(RELEASE_DIR)) {
    mkdirSync(RELEASE_DIR, { recursive: true });
  }

  const results: BuildResult[] = [];

  if (platform === 'all') {
    results.push(...buildPlatform('win'));
    results.push(...buildPlatform('mac'));
    results.push(...buildPlatform('linux'));
  } else {
    results.push(...buildPlatform(platform as 'win' | 'mac' | 'linux'));
  }

  printSummary(results);

  const hasFailure = results.some(r => !r.success);
  process.exit(hasFailure ? 1 : 0);
}

main().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
