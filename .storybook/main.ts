import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(ts|tsx)'],
  addons: [
    '@storybook/addon-essentials',
    '@storybook/addon-interactions',
    '@storybook/addon-themes',
  ],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  typescript: {
    reactDocgen: 'react-docgen-typescript',
  },
  viteFinal: async (config) => {
    // Exclude electron-specific plugins from Storybook build
    config.plugins = (config.plugins || []).filter(
      (p: any) => p?.name !== 'vite-plugin-electron' && p?.name !== 'vite-plugin-electron-renderer'
    );
    return config;
  },
};

export default config;
