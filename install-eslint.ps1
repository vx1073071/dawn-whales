# 安装 ESLint 和相关插件
$ErrorActionPreference = "Stop"

Write-Host "═══ 安装 ESLint 依赖 ═══" -ForegroundColor Cyan

# 安装 ESLint 和插件
$packages = @(
    "eslint",
    "@typescript-eslint/parser",
    "@typescript-eslint/eslint-plugin",
    "eslint-plugin-react",
    "eslint-plugin-react-hooks",
    "eslint-config-prettier"
)

foreach ($pkg in $packages) {
    Write-Host "安装 $pkg..." -ForegroundColor Yellow
    npm install -D $pkg
}

Write-Host "`n✅ ESLint 依赖安装完成" -ForegroundColor Green

# 创建 .eslintignore 文件
$eslintignore = @(
    "node_modules/",
    "dist/",
    "dist-electron/",
    "build/",
    "release/",
    "*.config.js",
    "*.config.ts",
    "*.config.cjs",
    "postcss.config.js",
    "tailwind.config.js",
    "vite.config.ts",
    "vite.config.mts",
    "vitest.config.ts",
    "playwright.config.ts",
    "electron-builder.json",
    "CHANGELOG.md",
    "README.md",
    "*.md",
    "tests/",
    "e2e-tests/",
    "scripts/",
    "docs/"
)

$eslintignore | Out-File -FilePath ".eslintignore" -Encoding UTF8
Write-Host "✅ .eslintignore 已创建" -ForegroundColor Green

# 更新 package.json 添加 lint 脚本
Write-Host "`n更新 package.json..." -ForegroundColor Yellow
$packageJson = Get-Content "package.json" -Encoding UTF8 | ConvertFrom-Json
$packageJson.scripts.lint = "eslint src --ext .ts,.tsx"
$packageJson.scripts."lint:fix" = "eslint src --ext .ts,.tsx --fix"
$packageJson | ConvertTo-Json -Depth 10 | Out-File -FilePath "package.json" -Encoding UTF8
Write-Host "✅ package.json 已更新" -ForegroundColor Green

Write-Host "`n═══ 安装完成 ═══" -ForegroundColor Cyan
Write-Host "运行命令:" -ForegroundColor Yellow
Write-Host "  npm run lint        # 检查代码质量" -ForegroundColor Cyan
Write-Host "  npm run lint:fix    # 自动修复问题" -ForegroundColor Cyan
