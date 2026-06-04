# 修复 Electron 安装问题
$ErrorActionPreference = "Stop"

Write-Host "开始修复 Electron 安装..." -ForegroundColor Yellow

# 1. 删除现有的 electron 模块
if (Test-Path "node_modules\electron") {
    Write-Host "删除现有的 electron 模块..." -ForegroundColor Gray
    Remove-Item -Path "node_modules\electron" -Recurse -Force
}

# 2. 清理 npm 缓存
Write-Host "清理 npm 缓存..." -ForegroundColor Gray
npm cache clean --force

# 3. 重新安装 electron
Write-Host "重新安装 electron..." -ForegroundColor Gray
npm install electron@33.0.0 --save-dev

# 4. 验证安装
Write-Host "验证 Electron 安装..." -ForegroundColor Gray
$electronPath = npm list electron --depth=0 2>&1 | Select-String "electron@"
if ($electronPath) {
    Write-Host "✅ Electron 安装成功: $electronPath" -ForegroundColor Green
} else {
    Write-Host "❌ Electron 安装验证失败" -ForegroundColor Red
    exit 1
}

# 5. 重新安装所有依赖
Write-Host "重新安装所有依赖..." -ForegroundColor Gray
npm install

Write-Host "✅ Electron 修复完成" -ForegroundColor Green
Write-Host "现在可以运行 E2E 测试了" -ForegroundColor Cyan
Write-Host "执行命令: npx playwright test" -ForegroundColor Cyan
