# T26: 端到端加密通信 (AES-256-GCM)

> 状态: ✅ 设计 | 规格

## 方案
- 密钥: PBKDF2 + 随机salt (16 bytes)
- 加密: AES-256-GCM (auth tag 16 bytes)
- IPC 层: withSchema() 前自动加解密
- 存储密钥: electron-safe-storage

## 安全审计
- 密钥不落盘（内存 only）
- IV 随机 + 一次性
- Auth tag 防篡改
