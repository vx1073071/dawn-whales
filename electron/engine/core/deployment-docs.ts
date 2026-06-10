import i18n from '../../../src/i18n';
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
      title: i18n.t('deploymentDocs.k1'),
      steps: [
        i18n.t('deploymentDocs.k2'),
        i18n.t('deploymentDocs.k3'),
        i18n.t('deploymentDocs.k4'),
        i18n.t('deploymentDocs.k5'),
        i18n.t('deploymentDocs.k6'),
        i18n.t('deploymentDocs.k7'),
        i18n.t('deploymentDocs.k8'),
        i18n.t('deploymentDocs.k9'),
      ],
    };
  }

  generateMacGuide(): InstallGuide {
    return {
      platform: "macOS",
      title: i18n.t('deploymentDocs.k10'),
      steps: [
        i18n.t('deploymentDocs.k11'),
        i18n.t('deploymentDocs.k12'),
        i18n.t('deploymentDocs.k13'),
        i18n.t('deploymentDocs.k14'),
        i18n.t('deploymentDocs.k15'),
        i18n.t('deploymentDocs.k16'),
        i18n.t('deploymentDocs.k17'),
      ],
    };
  }

  generateLinuxGuide(): InstallGuide {
    return {
      platform: "Linux",
      title: i18n.t('deploymentDocs.k18'),
      steps: [
        i18n.t('deploymentDocs.k19'),
        i18n.t('deploymentDocs.k20'),
        i18n.t('deploymentDocs.k21'),
        i18n.t('deploymentDocs.k22'),
        i18n.t('deploymentDocs.k23'),
        i18n.t('deploymentDocs.k24'),
        i18n.t('deploymentDocs.k25'),
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
          title: i18n.t('deploymentDocs.k26'),
          content:
            i18n.t('deploymentDocs.k27'),
        },
        {
          id: "deploy-steps",
          title: i18n.t('deploymentDocs.k28'),
          content: "",
          subsections: [
            {
              id: "step-1-clone",
              title: i18n.t('deploymentDocs.k29'),
              content: `git clone https://github.com/dawn-whales/dawn-whales.git && cd dawn-whales && git checkout v${v} && npm ci`,
            },
            {
              id: "step-2-env",
              title: i18n.t('deploymentDocs.k30'),
              content: i18n.t('deploymentDocs.k31'),
            },
            {
              id: "step-3-build",
              title: i18n.t('deploymentDocs.k32'),
              content: "npm run build && mkdir -p logs public",
            },
            {
              id: "step-4-pm2",
              title: i18n.t('deploymentDocs.k33'),
              content: i18n.t('deploymentDocs.k34'),
            },
            {
              id: "step-5-nginx",
              title: i18n.t('deploymentDocs.k35'),
              content: `cp nginx/dawnwhales.conf /etc/nginx/sites-available/ && ln -s /etc/nginx/sites-available/dawnwhales.conf /etc/nginx/sites-enabled/ && nginx -t && systemctl reload nginx`,
            },
            {
              id: "step-6-ssl",
              title: i18n.t('deploymentDocs.k36'),
              content: "certbot --nginx -d dawnwhales.com -d api.dawnwhales.com",
            },
            {
              id: "step-7-verify",
              title: i18n.t('deploymentDocs.k37'),
              content: i18n.t('deploymentDocs.k38'),
            },
          ],
        },
        {
          id: "update",
          title: i18n.t('deploymentDocs.k39'),
          content: `git pull origin master && git checkout v<new-version> && npm ci && npm run build && pm2 reload dawn-whales-api`,
        },
        {
          id: "troubleshoot",
          title: i18n.t('deploymentDocs.k40'),
          content:
            i18n.t('deploymentDocs.k41'),
        },
        {
          id: "monitoring",
          title: i18n.t('deploymentDocs.k42'),
          content:
            i18n.t('deploymentDocs.k43'),
        },
      ],
    };
  }

  // ── Summary ───────────────────────────────────────────────────────────────

  getSummary(): string {
    const guides = this.getAllGuides();
    const manual = this.generateDeployManual();
    return [
      i18n.t('deploymentDocs.k44'),
      "",
      i18n.t('deploymentDocs.k45'),
      ...guides.map(
        (g) =>
          `### ${g.platform}\n${g.steps.map((s) => `- ${s}`).join("\n")}`,
      ),
      "",
      i18n.t('deploymentDocs.k46'),
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
