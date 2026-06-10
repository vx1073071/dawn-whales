/**
 * src/locales/I18nProvider.tsx
 * R82 P1-5a: react-i18next I18nProvider wrapper
 *
 * 已初始化 i18next (src/locales/index.ts)，此组件包装 <I18nextProvider>
 * 与现有 src/i18n/I18nProvider.tsx 兼容并存。
 */

import React from 'react';
import { I18nextProvider } from 'react-i18next';
import i18n from './index';

interface I18nProviderProps {
  children: React.ReactNode;
}

export const I18nProvider: React.FC<I18nProviderProps> = ({ children }) => {
  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
};

export default I18nProvider;
