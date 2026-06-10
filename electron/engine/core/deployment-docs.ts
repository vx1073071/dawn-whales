// ── J-71-02: Packaging & Deployment Guide (v1.7.0 GA) ─────────────────────
// Generates Win/Mac/Linux installation instructions + API deployment manual.

// ── Types ──────────────────────────────────────────────────────────────────

export interface InstallGuide {
  platform: string;
  title: string;
  steps: string[];
}

export interface DeployManual {
  sections: DeploySection[];
  version: string;
  generatedAt: string;
}

export interface DeploySection {
  id: string;
  title: string;
  content: string;
  subsections?: DeploySection[];
}

// ── Installation Guides ────────────────────────────────────────────────────

export class DeploymentGuide {
  constructor(private version: string = "1.7.0") {}

  generateWindowsGuide(): InstallGuide {
    return {
      platform: "Windows",
      title: `Dawn Whales v${this.version} — Windows 安装指南`,
      steps: [
        `1. 下载 Dawn-Whales-Setup-${this.version}.exe`,
        "2. 双击 .exe 运行安装程序",
        "3. 如 SmartScreen 拦截，点击「更多信息」→「仍要运行」",
        "4. 选择安装目录（默认 C:\\Program Files\\Dawn Whales）",
        "5. 勾选「创建桌面快捷方式」",
        "6. 安装完成后启动，进入注册/登录页",
        "7. 首次启动自动激活 7 天免费试用",
        "8. 系统要求: Windows 10+ / x64 / 4GB RAM+",
      ],
    };
  }

  generateMacGuide(): InstallGuide {
    return {
      platform: "macOS",
      title: `Dawn Whales v${this.version} — macOS 安装指南`,
      steps: [
        `1. 下载 Dawn-Whales-${this.version}.dmg`,
        "2. 双击 .dmg 挂载镜像",
        "3. 将「Dawn Whales」拖入 Applications 文件夹",
        `4. 首次打开若提示「无法验证开发者」，前往 系统设置→隐私与安全性→仍要打开`,
        "5. 双击 Applications 中的 Dawn Whales 启动",
        "6. 进入注册/登录页，首次启动自动激活 7 天免费试用",
        "7. 系统要求: macOS 12+ / Apple Silicon 或 Intel / 4GB RAM+",
      ],
    };
  }

  generateLinuxGuide(): InstallGuide {
    return {
      platform: "Linux",
      title: `Dawn Whales v${this.version} — Linux 安装指南`,
      steps: [
        `1. 下载 Dawn-Whales-${this.version}.AppImage`,
        "2. 打开终端，进入下载目录: cd ~/Downloads",
        `3. 赋予执行权限: chmod +x Dawn-Whales-${this.version}.AppImage`,
        `4. 运行: ./Dawn-Whales-${this.version}.AppImage`,
        "5. 如需桌面集成，安装 AppImageLauncher: sudo apt install appimagelauncher",
        "6. 进入注册/登录页，首次启动自动激活 7 天免费试用",
        "7. 系统要求: Ubuntu 22.04+ / x64 / 4GB RAM+",
      ],
    };
  }

  getAllGuides(): InstallGuide[] {
    return [
      this.generateWindowsGuide(),
      this.generateMacGuide(),
      this.generateLinuxGuide(),
    ];
  }

  // ── API Deployment Manual ─────────────────────────────────────────────────

  generateDeployManual(): DeployManual {
    const v = this.version;
    return {
      version: v,
      generatedAt: new Date().toISOString(),
      sections: [
        {
          id: "prerequisites",
          title: "前置要求",
          content:
            "服务器: Ubuntu 22.04+ / CentOS 8+，Node.js 20+，Nginx 1.24+，PM2 (npm i -g pm2)，域名已解析到服务器 IP，SSL 证书 (推荐 Let's Encrypt / certbot)",
        },
        {
          id: "deploy-steps",
          title: "部署步骤",
          content: "",
          subsections: [
            {
              id: "step-1-clone",
              title: "步骤 1: 获取代码",
              content: `git clone https://github.com/dawn-whales/dawn-whales.git && cd dawn-whales && git checkout v${v} && npm ci`,
            },
            {
              id: "step-2-env",
              title: "步骤 2: 环境变量",
              content: `cp .env.example .env\n# 编辑 .env:\nDEEPSEEK_API_KEY=sk-your-key\nJWT_SECRET=<随机128字符>\nADMIN_API_TOKEN=<随机64字符>\nPORT=3000\nADMIN_PORT=3001\nDOMAIN=dawnwhales.com`,
            },
            {
              id: "step-3-build",
              title: "步骤 3: 构建",
              content: "npm run build && mkdir -p logs public",
            },
            {
              id: "step-4-pm2",
              title: "步骤 4: PM2 启动",
              content: `pm2 start ecosystem.config.json --env production\npm2 save\npm2 startup  # 开机自启`,
            },
            {
              id: "step-5-nginx",
              title: "步骤 5: Nginx 反向代理",
              content: `cp nginx/dawnwhales.conf /etc/nginx/sites-available/ && ln -s /etc/nginx/sites-available/dawnwhales.conf /etc/nginx/sites-enabled/ && nginx -t && systemctl reload nginx`,
            },
            {
              id: "step-6-ssl",
              title: "步骤 6: SSL 证书",
              content: "certbot --nginx -d dawnwhales.com -d api.dawnwhales.com",
            },
            {
              id: "step-7-verify",
              title: "步骤 7: 验证",
              content: `curl https://api.dawnwhales.com/api/health\n# 返回 {"status":"ok","version":"${v}"}`,
            },
          ],
        },
        {
          id: "update",
          title: "更新流程",
          content: `git pull origin master && git checkout v<new-version> && npm ci && npm run build && pm2 reload dawn-whales-api`,
        },
        {
          id: "troubleshoot",
          title: "常见问题",
          content:
            "- PM2 进程未启动: pm2 logs dawn-whales-api 查看日志\n- Nginx 502: 确认 Node 进程在监听 localhost:3000\n- SSL 证书过期: certbot renew\n- DeepSeek 调用失败: 检查 .env 中 DEEPSEEK_API_KEY 是否有效",
        },
        {
          id: "monitoring",
          title: "监控建议",
          content:
            "- PM2: pm2 monit (CPU/内存实时)\n- 日志: pm2 logs dawn-whales-api --lines 100\n- 健康检查: GET /api/health (建议每 30s)\n- 限流监控: PM2 日志中搜索 '429'\n- 磁盘: 日志目录 logs/ 建议 logrotate 配置",
        },
      ],
    };
  }

  // ── Summary ───────────────────────────────────────────────────────────────

  getSummary(): string {
    const guides = this.getAllGuides();
    const manual = this.generateDeployManual();
    return [
      `# Dawn Whales v${this.version} GA 部署文档`,
      "",
      `## 桌面端安装`,
      ...guides.map(
        (g) =>
          `### ${g.platform}\n${g.steps.map((s) => `- ${s}`).join("\n")}`,
      ),
      "",
      `## 服务器部署`,
      ...manual.sections.map((s) => {
        let sec = `### ${s.title}\n${s.content}`;
        if (s.subsections) {
          sec +=
            "\n" +
            s.subsections
              .map((sub) => `#### ${sub.title}\n\`\`\`\n${sub.content}\n\`\`\``)
              .join("\n");
        }
        return sec;
      }),
    ].join("\n\n");
  }
}

// ── Factory ────────────────────────────────────────────────────────────────

export function createDeploymentGuide(version?: string): DeploymentGuide {
  return new DeploymentGuide(version);
}
