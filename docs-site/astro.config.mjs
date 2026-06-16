import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// https://starlight.astro.build/
export default defineConfig({
  site: 'https://docs.dawnwhales.app',
  title: 'DAWN WHALES',
  description: '智能量化交易平台 — 开发者文档 · API参考 · 用户手册',
  locales: {
    root: { label: '简体中文', lang: 'zh-CN' },
    en: { label: 'English', lang: 'en' },
  },
  integrations: [
    starlight({
      title: 'DAWN WHALES 文档',
      logo: {
        src: '/src/assets/logo.svg',
      },
      favicon: '/favicon.ico',
      defaultLocale: 'root',
      locales: {
        root: {
          label: '简体中文',
          lang: 'zh-CN',
        },
        en: {
          label: 'English',
          lang: 'en',
        },
      },
      social: {
        github: 'https://github.com/dawn-whales',
      },
      sidebar: [
        {
          label: '🚀 快速开始',
          collapsed: false,
          items: [
            { label: '产品概述', link: '/' },
            { label: '安装指南', link: '/getting-started/installation' },
            { label: '快速上手', link: '/getting-started/quickstart' },
            { label: '界面导览', link: '/getting-started/tour' },
          ],
        },
        {
          label: '📖 用户手册',
          collapsed: true,
          items: [
            { label: '账户管理', link: '/user-manual/account' },
            { label: '策略配置', link: '/user-manual/strategies' },
            { label: '因子分析', link: '/user-manual/factors' },
            { label: '交易执行', link: '/user-manual/trading' },
            { label: '回测系统', link: '/user-manual/backtest' },
            { label: '风险管理', link: '/user-manual/risk' },
            { label: '数据看板', link: '/user-manual/dashboard' },
            { label: '费用说明', link: '/user-manual/billing' },
          ],
        },
        {
          label: '🔌 券商接入指南',
          collapsed: true,
          items: [
            { label: '概述', link: '/broker/overview' },
            { label: 'Interactive Brokers', link: '/broker/ibkr' },
            { label: 'Long Bridge 长桥', link: '/broker/longbridge' },
            { label: 'Futu 富途', link: '/broker/futu' },
            { label: 'Moomoo', link: '/broker/moomoo' },
            { label: 'eToro', link: '/broker/etoro' },
            { label: 'Schwab', link: '/broker/schwab' },
          ],
        },
        {
          label: '🧬 策略开发指南',
          collapsed: true,
          items: [
            { label: '策略体系概述', link: '/strategy/overview' },
            { label: '因子体系', link: '/strategy/factors' },
            { label: '模板开发', link: '/strategy/templates' },
            { label: '自定义策略', link: '/strategy/custom' },
            { label: '回测与验证', link: '/strategy/backtest' },
            { label: '实盘部署', link: '/strategy/deploy' },
          ],
        },
        {
          label: '📡 API 参考',
          collapsed: true,
          items: [
            { label: 'API 概述', link: '/api/overview' },
            { label: '认证', link: '/api/auth' },
            { label: '行情接口', link: '/api/market' },
            { label: '交易接口', link: '/api/trading' },
            { label: '策略接口', link: '/api/strategy' },
            { label: '回测接口', link: '/api/backtest' },
            { label: 'IPC 通道', link: '/api/ipc' },
          ],
        },
        {
          label: '⚙️ 技术参考',
          collapsed: true,
          items: [
            { label: '架构概览', link: '/reference/architecture' },
            { label: '数据流', link: '/reference/data-flow' },
            { label: '因子体系参考', link: '/reference/factors' },
            { label: '模板参数表', link: '/reference/template-params' },
            { label: '错误码表', link: '/reference/error-codes' },
            { label: '性能指标', link: '/reference/performance' },
            { label: '合规信息', link: '/reference/compliance' },
          ],
        },
        {
          label: '🌍 国际化',
          collapsed: true,
          items: [
            { label: 'i18n 开发指南', link: '/i18n/developer-guide' },
            { label: '翻译贡献', link: '/i18n/contribute' },
          ],
        },
      ],
      customCss: ['./src/styles/custom.css'],
      components: {
        PageTitle: './src/components/PageTitle.astro',
      },
      editLink: {
        baseUrl: 'https://github.com/dawn-whales/docs/edit/main/',
      },
      lastUpdated: true,
      pagination: true,
    }),
  ],
});
