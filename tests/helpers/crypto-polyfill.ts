// Polyfill for Node `crypto` module in jsdom environment
// Used via vite alias: 'crypto' → this file
// Re-exports Node.js crypto so engine files can use it in vitest jsdom

// eslint-disable-next-line @typescript-eslint/no-var-requires
let nodeCrypto: any;
try {
  nodeCrypto = require('node:crypto');
} catch {
  // Fallback: use globalThis crypto if available
  nodeCrypto = (globalThis as any).crypto;
}

if (!nodeCrypto) {
  console.error('[crypto-polyfill] FAILED to load node:crypto');
}

export const randomBytes = nodeCrypto.randomBytes;
export const createHash = nodeCrypto.createHash;
export const createHmac = nodeCrypto.createHmac;
export const createCipheriv = nodeCrypto.createCipheriv;
export const createDecipheriv = nodeCrypto.createDecipheriv;
export const createSign = nodeCrypto.createSign;
export const createVerify = nodeCrypto.createVerify;
export const createDiffieHellman = nodeCrypto.createDiffieHellman;
export const createECDH = nodeCrypto.createECDH;
export const pbkdf2 = nodeCrypto.pbkdf2;
export const pbkdf2Sync = nodeCrypto.pbkdf2Sync;
export const scrypt = nodeCrypto.scrypt;
export const scryptSync = nodeCrypto.scryptSync;
export const generateKeyPair = nodeCrypto.generateKeyPair;
export const generateKeyPairSync = nodeCrypto.generateKeyPairSync;
export const publicEncrypt = nodeCrypto.publicEncrypt;
export const privateDecrypt = nodeCrypto.privateDecrypt;
export const randomUUID = nodeCrypto.randomUUID;

export default nodeCrypto;
