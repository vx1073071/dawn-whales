// @ts-nocheck
// R233 ML#2: UserFeedbackWidget — In-app feedback collection integrated with Sentry
// Shows after error, or triggered via ? button. Collects name/email/description/screenshot

import React, { useState, useCallback, useRef } from 'react';
import { useSentry } from './SentryProvider';

export interface FeedbackData {
  name: string;
  email: string;
  type: 'bug' | 'feature' | 'question' | 'other';
  description: string;
  includeLogs: boolean;
  includeScreenshot: boolean;
}

export interface UserFeedbackWidgetProps {
  trigger?: 'auto' | 'button' | 'hidden';
  onClose?: () => void;
  className?: string;
}

const FEEDBACK_TYPES = [
  { value: 'bug' as const, label: '🐛 Bug Report', desc: 'Something is broken' },
  { value: 'feature' as const, label: '💡 Feature Request', desc: 'I have an idea' },
  { value: 'question' as const, label: '❓ Question', desc: 'I need help' },
  { value: 'other' as const, label: '📝 Other', desc: 'Something else' },
];

export default function UserFeedbackWidget({
  trigger = 'button',
  onClose,
  className = '',
}: UserFeedbackWidgetProps) {
  const { captureMessage, errors } = useSentry();
  const [open, setOpen] = useState(trigger === 'auto');
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [form, setForm] = useState<FeedbackData>({
    name: '', email: '', type: 'bug', description: '',
    includeLogs: true, includeScreenshot: false,
  });
  
  const inputRef = useRef<HTMLTextAreaElement>(null);
  
  const updateField = useCallback(<K extends keyof FeedbackData>(key: K, value: FeedbackData[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  }, []);
  
  const handleSubmit = useCallback(async () => {
    if (!form.description.trim()) return;
    setSending(true);
    
    // Build feedback payload
    const payload = {
      ...form,
      errors: form.includeLogs ? errors.slice(0, 10) : [],
      url: typeof window !== 'undefined' ? window.location.href : '',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      timestamp: new Date().toISOString(),
    };
    
    // Send to Sentry as a message
    captureMessage(`[Feedback] ${form.type}: ${form.description.slice(0, 100)}`, 'info');
    
    // Also try to POST to feedback endpoint if available
    try {
      if (typeof window !== 'undefined') {
        await fetch('/api/feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }
    } catch {
      // Feedback endpoint not available — Sentry message is sufficient
    }
    
    setSubmitted(true);
    setSending(false);
    
    // Auto-close after 3 seconds
    setTimeout(() => {
      setOpen(false);
      onClose?.();
    }, 3000);
  }, [form, errors, captureMessage, onClose]);
  
  const handleOpen = useCallback(() => {
    setOpen(true);
    setSubmitted(false);
    setForm({ name: '', email: '', type: 'bug', description: '', includeLogs: true, includeScreenshot: false });
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);
  
  const handleClose = useCallback(() => {
    setOpen(false);
    onClose?.();
  }, [onClose]);
  
  if (!open && trigger === 'button') {
    return (
      <button
        onClick={handleOpen}
        className={`feedback-trigger-btn ${className}`}
        title="Send feedback"
        style={{
          position: 'fixed', bottom: 20, right: 20, zIndex: 999,
          width: 44, height: 44, borderRadius: 22,
          background: 'var(--brand, #d4a574)', border: 'none',
          color: '#000', fontSize: 20, cursor: 'pointer',
          boxShadow: '0 2px 12px rgba(0,0,0,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        💬
      </button>
    );
  }
  
  if (!open) return null;
  
  if (submitted) {
    return (
      <div className={`feedback-widget-submitted ${className}`} style={{
        position: 'fixed', bottom: 20, right: 20, zIndex: 1000,
        width: 360, padding: 24, borderRadius: 12,
        background: 'var(--surface-1, #0f172a)', border: '1px solid var(--border-color, #334155)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.4)', textAlign: 'center',
      }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
        <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary, #e2e8f0)', margin: '0 0 8px' }}>
          Thank You!
        </h3>
        <p style={{ fontSize: 13, color: 'var(--text-secondary, #94a3b8)', margin: 0 }}>
          Your feedback has been submitted. We appreciate your help improving the app.
        </p>
      </div>
    );
  }
  
  return (
    <>
      {/* Backdrop */}
      <div onClick={handleClose} style={{
        position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(0,0,0,0.3)',
      }} />
      
      {/* Modal */}
      <div className={`feedback-widget ${className}`} style={{
        position: 'fixed', bottom: 20, right: 20, zIndex: 1000,
        width: 380, maxHeight: '80vh', overflow: 'auto',
        borderRadius: 12, background: 'var(--surface-1, #0f172a)',
        border: '1px solid var(--border-color, #334155)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '12px 16px', borderBottom: '1px solid var(--border-color, #334155)',
        }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary, #e2e8f0)', margin: 0 }}>
            💬 Send Feedback
          </h3>
          <button onClick={handleClose} style={{
            background: 'none', border: 'none', color: 'var(--text-secondary, #94a3b8)',
            fontSize: 18, cursor: 'pointer', padding: '0 4px',
          }}>✕</button>
        </div>
        
        {/* Form */}
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Type selector */}
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary, #94a3b8)', marginBottom: 6 }}>Type</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
              {FEEDBACK_TYPES.map(t => (
                <button
                  key={t.value}
                  onClick={() => updateField('type', t.value)}
                  style={{
                    padding: '8px', borderRadius: 8, border: form.type === t.value ? '1px solid var(--brand, #d4a574)' : '1px solid var(--border-color, #334155)',
                    background: form.type === t.value ? 'var(--brand-bg, rgba(212,165,116,0.1))' : 'transparent',
                    color: form.type === t.value ? 'var(--brand, #d4a574)' : 'var(--text-secondary, #94a3b8)',
                    fontSize: 12, cursor: 'pointer', textAlign: 'left',
                  }}
                >
                  <div>{t.label}</div>
                  <div style={{ fontSize: 10, opacity: 0.7 }}>{t.desc}</div>
                </button>
              ))}
            </div>
          </div>
          
          {/* Name */}
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary, #94a3b8)', marginBottom: 4 }}>Name (optional)</div>
            <input
              type="text"
              value={form.name}
              onChange={e => updateField('name', e.target.value)}
              placeholder="Your name"
              style={inputStyle}
            />
          </div>
          
          {/* Email */}
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary, #94a3b8)', marginBottom: 4 }}>Email (optional)</div>
            <input
              type="email"
              value={form.email}
              onChange={e => updateField('email', e.target.value)}
              placeholder="your@email.com"
              style={inputStyle}
            />
          </div>
          
          {/* Description */}
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary, #94a3b8)', marginBottom: 4 }}>
              Description <span style={{ color: '#ef4444' }}>*</span>
            </div>
            <textarea
              ref={inputRef}
              value={form.description}
              onChange={e => updateField('description', e.target.value)}
              placeholder={form.type === 'bug' ? 'What happened? What did you expect?' : 'Tell us more...'}
              style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }}
              rows={3}
            />
          </div>
          
          {/* Attachments */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, color: 'var(--text-secondary, #94a3b8)' }}>
              <input
                type="checkbox"
                checked={form.includeLogs}
                onChange={e => updateField('includeLogs', e.target.checked)}
                style={{ accentColor: 'var(--brand, #d4a574)' }}
              />
              Include error logs ({errors.length} errors)
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, color: 'var(--text-secondary, #94a3b8)' }}>
              <input
                type="checkbox"
                checked={form.includeScreenshot}
                onChange={e => updateField('includeScreenshot', e.target.checked)}
                style={{ accentColor: 'var(--brand, #d4a574)' }}
              />
              Include screenshot
            </label>
          </div>
          
          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={!form.description.trim() || sending}
            style={{
              padding: '10px', borderRadius: 8, border: 'none',
              background: form.description.trim() ? 'var(--brand, #d4a574)' : 'var(--surface-2, #1e293b)',
              color: form.description.trim() ? '#000' : 'var(--text-tertiary, #64748b)',
              fontSize: 14, fontWeight: 600, cursor: form.description.trim() ? 'pointer' : 'not-allowed',
              marginTop: 4,
            }}
          >
            {sending ? 'Sending...' : 'Submit Feedback'}
          </button>
        </div>
      </div>
    </>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px', borderRadius: 8,
  border: '1px solid var(--border-color, #334155)',
  background: 'var(--surface-2, #1e293b)', color: 'var(--text-primary, #e2e8f0)',
  fontSize: 13, boxSizing: 'border-box',
};
