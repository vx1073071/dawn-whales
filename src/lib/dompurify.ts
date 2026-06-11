// ── DAWN WHALES — DOMPurify XSS Protection (R92 J-01) ─────────────────────
// Provides HTML sanitization for user-generated content to prevent XSS attacks.
// Usage: import { sanitizeHtml, sanitizeText } from '@/lib/dompurify';

import DOMPurify from 'dompurify';

/**
 * Sanitize HTML content for safe rendering.
 * Use this when displaying user-generated HTML content (descriptions, comments, etc.)
 * 
 * @param html - Raw HTML string from user input
 * @returns Sanitized HTML string safe for rendering
 */
export function sanitizeHtml(html: string): string {
  if (!html || typeof html !== 'string') {
    return '';
  }
  
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'b', 'i', 'em', 'strong', 'u', 's', 'strike', 'del',
      'p', 'br', 'hr', 'div', 'span',
      'ul', 'ol', 'li',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'a', 'code', 'pre', 'blockquote',
    ],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'title', 'class', 'id'],
    FORBID_TAGS: ['style', 'script', 'iframe', 'object', 'embed', 'form', 'input'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover'],
  });
}

/**
 * Sanitize plain text content (strips all HTML tags).
 * Use this when you want to ensure no HTML is rendered.
 * 
 * @param text - Raw text string that may contain HTML
 * @returns Plain text with all HTML tags removed
 */
export function sanitizeText(text: string): string {
  if (!text || typeof text !== 'string') {
    return '';
  }
  
  return DOMPurify.sanitize(text, { ALLOWED_TAGS: [] });
}

/**
 * Check if a string contains potentially dangerous content.
 * Returns true if the string appears safe, false if it contains suspicious patterns.
 * 
 * @param input - String to check
 * @returns true if safe, false if suspicious
 */
export function isSafeContent(input: string): boolean {
  if (!input || typeof input !== 'string') {
    return true;
  }
  
  // Check for common XSS patterns
  const dangerousPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i,  // onclick, onload, etc.
    /<iframe/i,
    /<object/i,
    /<embed/i,
    /data:/i,
  ];
  
  return !dangerousPatterns.some(pattern => pattern.test(input));
}
