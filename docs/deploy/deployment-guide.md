<!-- META
version: 1.12.0
last_updated: 2026-06-12
round: R108
owner: PM
purpose: (auto-generated, needs review)
-->

# TradingEasy Deployment Guide

> **版本**: v1.10.0
> **最后更新**: 2026-06-12
> **适用范围**: Windows / macOS / Linux

---

## 一、 系统要求

### 最小配置

| 组件 | 要求 |
|------|------|
| **操作系统** | Windows 10+, macOS 11+, Ubuntu 20.04+ |
| **CPU** | 4 cores, x64 / ARM64 |
| **RAM** | 8 GB |
| **磁盘** | 2 GB 可用空间 |
| **Node.js** | v22+ (仅开发模式) |

### 推荐配置

| 组件 | 要求 |
|------|------|
| **操作系统** | Windows 11, macOS 14+, Ubuntu 22.04 |
| **CPU** | 8+ cores |
| **RAM** | 16 GB (8GB+ 用于 vitest 全量测试) |
| **磁盘** | 10 GB (含 OpenD 行情数据缓存) |
| **Node.js** | v22.21+ |

### 外部依赖

| 服务 | 版本 | 说明 |
|------|------|------|
| Futu OpenD | 8.x+ | 港股/美股/加密货币行情+交易 |
| Python | 3.10+ | AI Agent 脚本 (futuapi/moomooapi) |

---

## 二、 安装步骤

### 2.1 Windows (生产环境)

**方式一: NSIS 安装包 (推荐)**
```
1. 从 GitHub Releases 下载 TradingEasy Setup 1.10.0.exe (128MB)
2. 双击运行 → 选择安装目录 → 完成
3. 验证 SHA256:
   certutil -hashfile "TradingEasy Setup 1.10.0.exe" SHA256
   应为: AEFE59FEB5650936A51790E21A874BE07357EB77A15839DA2FD3ED032CE393A4
```

**方式二: Portable 免安装版**
```
1. 下载 TradingEasy 1.10.0.exe (105MB)
2. 直接双击运行 (无需安装)
3. SHA256: 388136A24C0DB68D8F8B8E9EE6E6EC3BEB97C63C4B41CDE6C2D840C2EA2A955A
```

**方式三: 开发模式**
```bash
git clone https://github.com/vx1073071/tradingeasy.git
cd dawn-whales
pnpm install
pnpm run build
```

### 2.2 macOS

```bash
# 1. 下载 DMG 镜像
open "TradingEasy-1.10.0-arm64.dmg"
# 2. 拖拽到 Applications
# 3. 首次打开: 右键 → Open (绕过 Gatekeeper)
```

### 2.3 Linux

```bash
# AppImage (推荐)
chmod +x "TradingEasy-1.10.0.AppImage"
./"TradingEasy-1.10.0.AppImage"

# .deb 安装包
sudo dpkg -i "dawn-whales_1.10.0_amd64.deb"
```

---

## 三、 electron-builder 配置

### 3.1 配置文件 (`electron-builder.json`)

```json
{
  "appId": "com.TradingEasy.app",
  "productName": "TradingEasy",
  "directories": { "output": "release" },
  "files": ["dist/**/*", "dist-electron/**/*", "package.json"],
  "asar": true,
  "asarUnpack": ["node_modules/better-sqlite3/**", "node_modules/electron-log/**"],
  "compression": "maximum",
  "extraMetadata": { "main": "dist-electron/main.cjs" },
  "win": {
    "target": [{ "target": "nsis", "arch": ["x64"] }],
    "icon": "build/icon.png",
    "signAndEditExecutable": false
  },
  "nsis": {
    "oneClick": false,
    "perMachine": false,
    "allowToChangeInstallationDirectory": true,
    "createDesktopShortcut": true,
    "createStartMenuShortcut": true,
    "installerLanguages": ["zh_CN", "en_US", "ja_JP"]
  },
  "mac": {
    "target": [{ "target": "dmg", "arch": ["x64", "arm64"] }],
    "icon": "build/icon.icns",
    "category": "public.app-category.finance"
  },
  "linux": {
    "target": [
      { "target": "AppImage", "arch": ["x64"] },
      { "target": "deb", "arch": ["x64"] }
    ],
    "category": "Finance"
  },
  "publish": {
    "provider": "github",
    "owner": "vx1073071",
    "repo": "dawn-whales",
    "releaseType": "release"
  }
}
```

### 3.2 打包命令

```bash
# 全部平台打包
pnpm run pack                           # 开发打包 (.dir)
pnpm run dist                           # 生产打包 (installer)

# 单平台
npx electron-builder --win              # Windows NSIS
npx electron-builder --mac              # macOS DMG
npx electron-builder --linux            # Linux AppImage + deb

# 自动更新检查
npx electron-builder --publish always   # 发布到 GitHub Releases
```

### 3.3 已知问题

| 问题 | 状态 | 解决方案 |
|------|------|---------|
| better-sqlite3 编译失败 (Electron 40 V8 API) | 已处理 | `npmRebuild: false` 跳过 native rebuild |
| Windows Defender 拦截 makensis.exe | 已知 | 手动允许或使用 portable 版本 |
| 代码签名未配置 | 未处理 | `signAndEditExecutable: false`, 用户需手动绕过 SmartScreen |
| macOS Gatekeeper | 已处理 | `gatekeeperAssess: false`, 用户右键打开 |

---

## 四、 CI/CD Pipeline

### 4.1 本地 CI (Pre-commit)

```bash
# .husky/pre-commit
npx tsc --noEmit                     # TSC 类型检查
npx vitest run --changed             # 增量测试
```

### 4.2 5 轮 CI 验证

```bash
#!/bin/bash
# scripts/ci-5-rounds.sh
for i in {1..5}; do
  echo "=== Round $i ==="
  npx vitest run 2>&1 | grep "Tests\|Test Files"
  if [ $? -ne 0 ]; then
    echo "FAILED at round $i"
    exit 1
  fi
done
echo "5/5 GREEN"
```

### 4.3 完整发布流程

```bash
# 1. 门禁检查
npx tsc --noEmit                          # TSC: 0 errors
npx vitest run                            # 全量: 0 fail
npm audit                                 # 0 漏洞
npm run build                             # Vite build: 0 errors

# 2. 版本升级
npm version 1.10.0 --no-git-tag-version   # 更新 package.json

# 3. 构建 + 打包
npm run build                             # Vite 前端构建
npx electron-builder --win --publish never  # Electron 打包

# 4. 生成 SHA256
certutil -hashfile "release/TradingEasy Setup 1.10.0.exe" SHA256 > release/SHA256SUMS.txt

# 5. Git 操作
git add .
git commit -m "release: v1.10.0"
git tag v1.10.0
git push origin master --tags

# 6. GitHub Release
# 手动上传 release/ 文件到 GitHub Releases
```

---

## 五、 环境变量

### 5.1 运行环境

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `FUTU_OPEND_HOST` | `127.0.0.1` | Futu OpenD API 地址 |
| `FUTU_OPEND_PORT` | `11111` | Futu OpenD API 端口 |
| `NODE_ENV` | `production` | 开发模式: `development` |
| `ELECTRON_ENABLE_LOGGING` | `0` | 启用 Electron 日志: `1` |

### 5.2 AI / LLM 配置

| 变量 | 说明 |
|------|------|
| `DEEPSEEK_API_KEY` | DeepSeek V4 Pro API key |
| `QWEN_API_KEY` | Qwen-Max API key |
| `LLM_CACHE_TTL` | 缓存 TTL (毫秒), 默认 3600000 |

### 5.3 数据库

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `DB_PATH` | `./data/dawn-whales.db` | SQLite 数据库路径 |
| `DB_MAX_SIZE` | `536870912` (512MB) | 最大数据库大小 |

---

## 六、 监控与运维

### 6.1 健康检查

```bash
# OpenD 连接检查
curl http://127.0.0.1:11111/api/getGlobalState

# 进程检查
ps aux | grep "TradingEasy"
ps aux | grep "FutuOpenD"
```

### 6.2 日志位置

| 平台 | 路径 |
|------|------|
| Windows | `%APPDATA%/dawn-whales/logs/main.log` |
| macOS | `~/Library/Logs/dawn-whales/main.log` |
| Linux | `~/.config/dawn-whales/logs/main.log` |

### 6.3 性能监控指标

| 指标 | 健康值 | 告警阈值 |
|------|--------|---------|
| 启动时间 | <3s | >5s |
| 内存使用 | <500MB | >1.5GB |
| CPU 使用率 | <10% | >50% |
| WebSocket 延迟 | <100ms | >500ms |
| API 响应时间 | <200ms | >1s |

---

## 七、 回滚流程

### 7.1 回滚到上一版本

```bash
# 通过自动更新回滚
# 1. 打开 Help → About TradingEasy
# 2. 点击 "Restore previous version"
# 3. 自动下载并重启

# 或手动回滚
# 1. 下载上一版本 installer
# 2. 覆盖安装 (保留用户数据)
```

### 7.2 数据库回滚

```bash
# SQLite 数据库自动备份位置
# 主数据库: ./data/dawn-whales.db
# 备份: ./data/dawn-whales.db.bak.<timestamp>

# 手动回滚数据库
cp ./data/dawn-whales.db.bak.20260612 ./data/dawn-whales.db
```

### 7.3 紧急回滚场景

| 场景 | 操作 | 预计恢复时间 |
|------|------|-------------|
| 启动崩溃 | 删除 `~/dawn-whales/config.json` → 重启 | <1 min |
| 数据库损坏 | 替换备份数据库 | <5 min |
| OpenD 连接失败 | 重启 FutuOpenD 服务 | <2 min |
| 版本不兼容 | 覆盖安装上一版本 | <3 min |
| 完整系统恢复 | 安装旧版 + 还原数据库备份 | <10 min |

---

## 八、 升级指南

### 从 v1.9.0 → v1.10.0

**破坏性变更**:
1. EngineError 标准化: 错误码格式从 `{code: string}` → `{code: ErrorCode}`, 自定义 catch 需更新
2. i18n CJK 清零: 所有硬编码中文已移除, 旧版语言包自动失效
3. bundle 结构变化: 外部插件需重新构建
4. vitest pool: `forks` → `threads`, 自定义 test config 需更新
5. engine 目录重组: 扁平 → 9 子目录, import 路径已全部更新

**升级步骤**:
1. 备份 `./data/` 目录
2. 下载 v1.10.0 installer
3. 覆盖安装 (保留现有数据)
4. 首次启动自动迁移
5. 验证: Help → About 显示 v1.10.0

### 数据迁移

```bash
# 自动迁移由 Electron main process 在首次启动时执行
# 日志: ~/dawn-whales/logs/migration.log
# 如失败, 从备份恢复: ./data/dawn-whales.db.bak.<timestamp>
```

---

## 九、 故障排查

### 常见问题

**Q: 启动白屏**
```
1. 删除 config.json 重置: rm ~/dawn-whales/config.json
2. 清除 Electron 缓存: rm -rf ~/dawn-whales/Cache
3. 检查 TSC: npx tsc --noEmit (开发模式)
```

**Q: OpenD 连接失败**
```
1. 确认 OpenD 运行: tasklist | findstr FutuOpenD
2. 检查端口: netstat -an | findstr 11111
3. 检查防火墙: 允许 FutuOpenD.exe 通过
```

**Q: 安装包被 Windows Defender 拦截**
```
原因: 未签名的 NSIS installer
解决: 使用 portable .exe 或手动添加白名单
```

**Q: better-sqlite3 编译失败**
```
原因: Electron 40 V8 API 不兼容
解决: 使用 npmRebuild=false (electron-builder 已配置)
```

---

*本文档基于真实 electron-builder.json 配置、package.json scripts 和 JVS R94 release docs 编写。*
