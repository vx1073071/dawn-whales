// ── J-70-02: Platform Packaging & CI Configuration (v1.7.0 GA) ────────────
// electron-builder config for Win/Mac/Linux, code signing, auto-update
// artifact verification, CI pipeline (GitHub Actions).

// ── Types ──────────────────────────────────────────────────────────────────

export type Platform = "win" | "mac" | "linux";

export interface PackageConfig {
  appId: string;
  productName: string;
  version: string;
  platforms: Platform[];
  outputDir: string;
  win: WindowsSignConfig;
  mac: MacSignConfig;
  linux: LinuxPackageConfig;
  autoUpdate: AutoUpdateConfig;
}

export interface WindowsSignConfig {
  certificateFile: string;
  certificatePassword: string;
  publisherName: string;
}

export interface MacSignConfig {
  identity: string;
  appleId: string;
  notarize: boolean;
}

export interface LinuxPackageConfig {
  target: "AppImage" | "deb" | "rpm";
  category: string;
}

export interface AutoUpdateConfig {
  provider: "github" | "generic";
  url: string;
  channel: "latest" | "beta" | "alpha";
}

export interface ArtifactInfo {
  platform: Platform;
  fileName: string;
  sizeBytes: number;
  sha256: string;
  signed: boolean;
}

export interface CIStep {
  name: string;
  run: string;
  platform: string;
}

export interface CIConfig {
  name: string;
  on: string[];
  jobs: CIJob[];
}

export interface CIJob {
  name: string;
  runsOn: string;
  steps: CIStep[];
}

// ── Default Package Config ─────────────────────────────────────────────────

const DEFAULT_PACKAGE_CONFIG: PackageConfig = {
  appId: "com.QuantMoo.desktop",
  productName: "QUANT MOO",
  version: "1.7.0",
  platforms: ["win", "mac", "linux"],
  outputDir: "dist/release",
  win: {
    certificateFile: "certs/code-signing.pfx",
    certificatePassword: "${WIN_CERT_PASSWORD}",
    publisherName: "QUANT MOO Inc.",
  },
  mac: {
    identity: "${APPLE_DEVELOPER_ID}",
    appleId: "${APPLE_ID}",
    notarize: true,
  },
  linux: {
    target: "AppImage",
    category: "Finance",
  },
  autoUpdate: {
    provider: "github",
    url: "https://github.com/quant-moo/quant-moo/releases",
    channel: "latest",
  },
};

// ── Package Manager ─────────────────────────────────────────────────────────

export class PackageManager {
  private config: PackageConfig;

  constructor(config?: Partial<PackageConfig>) {
    this.config = { ...DEFAULT_PACKAGE_CONFIG, ...config };
  }

  // ── Electron Builder Config ───────────────────────────────────────────────

  generateElectronBuilderConfig(): Record<string, unknown> {
    return {
      appId: this.config.appId,
      productName: this.config.productName,
      version: this.config.version,
      directories: {
        output: this.config.outputDir,
        buildResources: "build",
      },
      files: ["dist/**/*", "node_modules/**/*", "package.json"],
      win: {
        target: ["nsis"],
        icon: "build/icon.ico",
        certificateFile: this.config.win.certificateFile,
        certificatePassword: this.config.win.certificatePassword,
        publisherName: this.config.win.publisherName,
        signingHashAlgorithms: ["sha256"],
      },
      nsis: {
        oneClick: false,
        perMachine: true,
        allowToChangeInstallationDirectory: true,
        createDesktopShortcut: true,
        createStartMenuShortcut: true,
        shortcutName: "QUANT MOO",
      },
      mac: {
        target: ["dmg", "zip"],
        icon: "build/icon.icns",
        identity: this.config.mac.identity,
        hardenedRuntime: true,
        gatekeeperAssess: false,
        entitlements: "build/entitlements.mac.plist",
        entitlementsInherit: "build/entitlements.mac.plist",
      },
      linux: {
        target: [this.config.linux.target],
        icon: "build/icons",
        category: this.config.linux.category,
        desktop: {
          Name: "QUANT MOO",
          Comment: "AI-powered trading strategy platform",
          Categories: "Finance;Office;",
        },
      },
      publish: {
        provider: this.config.autoUpdate.provider,
        url: this.config.autoUpdate.url,
        channel: this.config.autoUpdate.channel,
      },
    };
  }

  // ── Expected Artifacts ────────────────────────────────────────────────────

  getExpectedArtifacts(): ArtifactInfo[] {
    const v = this.config.version;
    return [
      {
        platform: "win",
        fileName: `quant-moo-Setup-${v}.exe`,
        sizeBytes: 0,
        sha256: "",
        signed: true,
      },
      {
        platform: "mac",
        fileName: `quant-moo-${v}.dmg`,
        sizeBytes: 0,
        sha256: "",
        signed: true,
      },
      {
        platform: "linux",
        fileName: `quant-moo-${v}.AppImage`,
        sizeBytes: 0,
        sha256: "",
        signed: false,
      },
    ];
  }

  // ── Artifact Validation ───────────────────────────────────────────────────

  validateArtifact(artifact: ArtifactInfo): string[] {
    const issues: string[] = [];

    if (artifact.fileName.includes("undefined")) {
      issues.push("File name contains undefined version");
    }

    if (artifact.platform === "win" && !artifact.signed) {
      issues.push("Windows artifact must be signed");
    }

    if (artifact.platform === "mac" && !artifact.signed) {
      issues.push("macOS artifact must be signed and notarized");
    }

    const name = artifact.fileName.toLowerCase();
    switch (artifact.platform) {
      case "win":
        if (!name.endsWith(".exe")) issues.push("Windows artifact must be .exe");
        break;
      case "mac":
        if (!name.endsWith(".dmg") && !name.endsWith(".zip"))
          issues.push("macOS artifact must be .dmg or .zip");
        break;
      case "linux":
        if (!name.endsWith(".appimage") && !name.endsWith(".deb") && !name.endsWith(".rpm"))
          issues.push("Linux artifact must be .AppImage/.deb/.rpm");
        break;
    }

    return issues;
  }

  // ── CI Pipeline Generator (GitHub Actions) ───────────────────────────────

  generateGithubActionsConfig(): CIConfig {
    const v = this.config.version;

    return {
      name: `Build and Release v${v}`,
      on: ["push"],
      jobs: [
        {
          name: "build-windows",
          runsOn: "windows-latest",
          steps: [
            { name: "Checkout", run: "actions/checkout@v4", platform: "all" },
            { name: "Setup Node", run: "actions/setup-node@v4", platform: "all" },
            { name: "Install", run: "npm ci", platform: "all" },
            { name: "Test", run: "npm test", platform: "all" },
            { name: "Build & Package", run: "npm run dist:win", platform: "win" },
            {
              name: "Upload Artifact",
              run: `actions/upload-artifact@v4 --name quant-moo-Setup-${v}.exe`,
              platform: "win",
            },
          ],
        },
        {
          name: "build-macos",
          runsOn: "macos-latest",
          steps: [
            { name: "Checkout", run: "actions/checkout@v4", platform: "all" },
            { name: "Setup Node", run: "actions/setup-node@v4", platform: "all" },
            { name: "Install", run: "npm ci", platform: "all" },
            { name: "Test", run: "npm test", platform: "all" },
            { name: "Build & Package", run: "npm run dist:mac", platform: "mac" },
            {
              name: "Notarize",
              run: "npx electron-notarize $APPLE_ID $APPLE_PASSWORD",
              platform: "mac",
            },
            {
              name: "Upload Artifact",
              run: `actions/upload-artifact@v4 --name quant-moo-${v}.dmg`,
              platform: "mac",
            },
          ],
        },
        {
          name: "build-linux",
          runsOn: "ubuntu-latest",
          steps: [
            { name: "Checkout", run: "actions/checkout@v4", platform: "all" },
            { name: "Setup Node", run: "actions/setup-node@v4", platform: "all" },
            { name: "Install", run: "npm ci", platform: "all" },
            { name: "Test", run: "npm test", platform: "all" },
            { name: "Build & Package", run: "npm run dist:linux", platform: "linux" },
            {
              name: "Upload Artifact",
              run: `actions/upload-artifact@v4 --name quant-moo-${v}.AppImage`,
              platform: "linux",
            },
          ],
        },
        {
          name: "create-release",
          runsOn: "ubuntu-latest",
          steps: [
            { name: "Download All Artifacts", run: "actions/download-artifact@v4", platform: "all" },
            {
              name: "Generate SHA256",
              run: "sha256sum quant-moo-* > SHA256SUMS",
              platform: "all",
            },
            {
              name: "Create Release",
              run: `npx gh release create v${v} quant-moo-* SHA256SUMS --title "v${v} GA" --generate-notes`,
              platform: "all",
            },
          ],
        },
      ],
    };
  }

  // ── Package.json scripts generator ────────────────────────────────────────

  generatePackageJsonScripts(): Record<string, string> {
    return {
      "dist:win": "electron-builder --win --x64",
      "dist:mac": "electron-builder --mac --x64 --arm64",
      "dist:linux": "electron-builder --linux --x64",
      "dist:all": "electron-builder --win --mac --linux --x64",
      "sign:win": 'signtool sign /fd sha256 /f certs/code-signing.pfx /p "%CERT_PASSWORD%" dist/release/*.exe',
      "notarize:mac": 'npx electron-notarize --apple-id="$APPLE_ID" --apple-password="$APPLE_PASSWORD"',
    };
  }

  // ── Auto-update config ────────────────────────────────────────────────────

  generateAutoUpdateConfig(): Record<string, unknown> {
    return {
      provider: this.config.autoUpdate.provider,
      url: this.config.autoUpdate.url,
      channel: this.config.autoUpdate.channel,
      updaterCacheDirName: "quant-moo-updater",
    };
  }

  getConfig(): PackageConfig {
    return { ...this.config };
  }
}

// ── Factory ────────────────────────────────────────────────────────────────

export function createPackageManager(
  config?: Partial<PackageConfig>,
): PackageManager {
  return new PackageManager(config);
}
