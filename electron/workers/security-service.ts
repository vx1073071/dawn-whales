// T89: Security Hardening + Input Sanitization
export class SecurityService {
  // SQL injection prevention
  sanitizeSql(input: string): string {
    return input.replace(/['";\\]/g, '');
  }

  // XSS prevention
  sanitizeHtml(input: string): string {
    return input
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  }

  // Input validation
  validateSymbol(symbol: string): boolean {
    return /^[A-Z0-9.]+$/i.test(symbol) && symbol.length <= 20;
  }

  validateOrderQuantity(qty: number): boolean {
    return Number.isInteger(qty) && qty > 0 && qty <= 10000000;
  }

  validatePrice(price: number): boolean {
    return price > 0 && price <= 100000000 && isFinite(price);
  }

  // Rate limiting check for auth endpoints
  checkBruteForce(attempts: number, maxAttempts = 5, windowMs = 300000): boolean {
    return attempts <= maxAttempts;
  }

  // API key masking
  maskApiKey(key: string): string {
    if (key.length <= 8) return '****';
    return key.slice(0, 4) + '****' + key.slice(-4);
  }

  // Token validation
  validateJwtStructure(token: string): boolean {
    const parts = token.split('.');
    return parts.length === 3 && parts.every(p => p.length > 0);
  }

  // Check for common attack patterns
  detectAttackPayload(input: string): { safe: boolean; reason?: string } {
    const patterns = [
      { regex: /<script/i, name: 'XSS' },
      { regex: /(\bDROP\b|\bDELETE\b|\bINSERT\b|\bUPDATE\b)/i, name: 'SQL Injection' },
      { regex: /\${.*}/, name: 'Template Injection' },
      { regex: /\.\.\//, name: 'Path Traversal' },
      { regex: /\|.*rm\b/, name: 'Command Injection' },
    ];
    for (const p of patterns) {
      if (p.regex.test(input)) {
        return { safe: false, reason: `Detected ${p.name} pattern` };
      }
    }
    return { safe: true };
  }

  // Password strength check
  checkPasswordStrength(password: string): { score: number; feedback: string[] } {
    const feedback: string[] = [];
    let score = 0;

    if (password.length >= 8) score += 2;
    else feedback.push('Min 8 characters');

    if (/[A-Z]/.test(password)) score += 2;
    else feedback.push('Add uppercase');

    if (/[a-z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 2;
    else feedback.push('Add numbers');

    if (/[^A-Za-z0-9]/.test(password)) score += 2;
    else feedback.push('Add special chars');

    if (password.length >= 16) score += 1;

    return { score, feedback };
  }
}

export const security = new SecurityService();
