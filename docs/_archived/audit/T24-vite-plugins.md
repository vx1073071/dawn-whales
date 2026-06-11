# T24: 自定义 Vite 插件系统

> 状态: ✅ 设计 | 产出: 2个插件规格

## vite-plugin-electron-ipc
自动从 22 个 IPC handler 模块生成 preload API 声明文件。

## vite-plugin-i18n-extract
构建时扫描未使用的 locale key，产出 unused-keys.json。

## 实现方案
参考 vite-plugin-electron 源码结构，使用 Vite Plugin API (configResolved + transform)。
