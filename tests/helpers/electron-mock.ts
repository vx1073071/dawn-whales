// Mock electron for vitest
// Provides minimal stubs for electron API used in engine code.

export const app = {
  getPath: (name: string): string => {
    const paths: Record<string, string> = {
      downloads: '/tmp/dawn-whales-tests/downloads',
      userData: '/tmp/dawn-whales-tests/userData',
      appData: '/tmp/dawn-whales-tests/appData',
      temp: '/tmp/dawn-whales-tests/temp',
    };
    return paths[name] || '/tmp/dawn-whales-tests';
  },
  getName: () => 'Dawn Whales',
  getVersion: () => '1.0.0-test',
  isPackaged: false,
};

export const BrowserWindow = {};
export const ipcMain = {};
export const ipcRenderer = {};
