const fs = require('fs');
const storiesDir = 'src/stories/';

const components = [
  { name: 'AIAdvisorPage', title: 'AI/AdvisorPage', import: '../components/ai/AIAdvisorPage' },
  { name: 'AIAssistantPanel', title: 'AI/AssistantPanel', import: '../components/ai/AIAssistantPanel' },
  { name: 'AlertCenterPage', title: 'Dashboard/AlertCenter', import: '../components/dashboard/AlertCenterPage' },
  { name: 'BrokerConfigSelector', title: 'Settings/BrokerConfigSelector', import: '../components/settings/BrokerConfigSelector' },
  { name: 'DataQualityPage', title: 'Data/QualityPage', import: '../components/data/DataQualityPage' },
  { name: 'FactorExposurePage', title: 'Analysis/FactorExposure', import: '../components/analysis/FactorExposurePage' },
  { name: 'MonteCarloPage', title: 'Backtest/MonteCarlo', import: '../components/backtest/MonteCarloPage' },
  { name: 'OnboardingFullKit', title: 'Onboarding/FullKit', import: '../components/onboarding/OnboardingFullKit' },
  { name: 'SentimentDashboardPage', title: 'Market/SentimentDashboard', import: '../components/market/SentimentDashboardPage' },
  { name: 'SignalFeedAndCopyPanel', title: 'Trading/SignalFeed', import: '../components/trading/SignalFeedAndCopyPanel' },
  { name: 'StrategyMarketplace', title: 'Strategy/Marketplace', import: '../components/strategy/StrategyMarketplace' },
  { name: 'TradingDeskPage', title: 'Trading/DeskPage', import: '../components/trading/TradingDeskPage' },
  { name: 'DataExportPage', title: 'Data/ExportPage', import: '../components/data/DataExportPage' },
  { name: 'LiveExecutionConsole', title: 'Trading/LiveExecution', import: '../components/trading/LiveExecutionConsole' },
  { name: 'AgentDataSourcePanel', title: 'Agent/DataSourcePanel', import: '../components/agent/AgentDataSourcePanel' },
];

let count = 0;
for (const c of components) {
  const content = [
    'import type { Meta, StoryObj } from \'@storybook/react\';',
    'import ' + c.name + ' from \'' + c.import + '\';',
    '',
    'const meta: Meta<typeof ' + c.name + '> = {',
    '  title: \'' + c.title + '\',',
    '  component: ' + c.name + ',',
    '  tags: [\'autodocs\'],',
    '};',
    'export default meta;',
    'type Story = StoryObj<typeof ' + c.name + '>;',
    '',
    'export const Default: Story = {};',
    '',
  ].join('\n');

  fs.writeFileSync(storiesDir + c.name + '.stories.tsx', content);
  count++;
}
console.log('Created ' + count + ' stories');
