/**
 * SecurityCenter — ML-62-03 [P1]
 * R62: v1.5.0-alpha — 2FA setup + security center (v15商业基建)
 *
 * Features:
 * - TOTP 2FA setup flow: scan QR → enter code → enable
 * - Backup codes generation (8 one-time codes)
 * - 2FA status indicator (enabled/disabled)
 * - Security event log (login/2FA/withdrawal/password change)
 * - Recovery flow: use backup code to disable 2FA
 * - 2FA required for: login + withdrawal
 */

import React, { useState, useCallback } from 'react';

// ── Types ───────────────────────────────────────────────────────────────

export type SecurityEventType = 'login' | 'login_2fa' | '2fa_enabled' | '2fa_disabled' | 'backup_code_used' | 'password_changed' | 'withdrawal' | 'withdrawal_2fa';

export interface SecurityEvent {
  id: string;
  type: SecurityEventType;
  detail: string;
  ip: string;
  location: string;
  timestamp: string;
  success: boolean;
}

export interface SecurityCenterProps {
  twoFactorEnabled?: boolean;
  backupCodes?: string[];
  events?: SecurityEvent[];
  onEnable2FA?: (code: string) => void;
  onDisable2FA?: (backupCode: string) => void;
  onRegenerateCodes?: () => void;
  className?: string;
}

// ── Mock ────────────────────────────────────────────────────────────────

const mockEvents: SecurityEvent[] = [
  { id: 'se-01', type: 'login', detail: 'Password login', ip: '192.168.1.100', location: 'Hong Kong', timestamp: '2026-06-09T05:00:00Z', success: true },
  { id: 'se-02', type: 'login_2fa', detail: '2FA TOTP verified', ip: '192.168.1.100', location: 'Hong Kong', timestamp: '2026-06-09T05:00:05Z', success: true },
  { id: 'se-03', type: 'withdrawal', detail: '100 USDT withdrawal requested', ip: '192.168.1.100', location: 'Hong Kong', timestamp: '2026-06-08T15:30:00Z', success: true },
  { id: 'se-04', type: 'withdrawal_2fa', detail: '2FA TOTP verified for withdrawal', ip: '192.168.1.100', location: 'Hong Kong', timestamp: '2026-06-08T15:30:10Z', success: true },
  { id: 'se-05', type: 'password_changed', detail: 'Password updated', ip: '192.168.1.100', location: 'Hong Kong', timestamp: '2026-06-01T10:00:00Z', success: true },
  { id: 'se-06', type: 'login', detail: 'Password login', ip: '203.0.113.42', location: 'Unknown', timestamp: '2026-06-07T03:15:00Z', success: false },
];

const mockBackupCodes = ['A8K2-9XQ1-MP4V', 'B3F7-WN5T-JH2R', 'C6Y8-DL3U-KP9M', 'D1Q4-RS7V-ZN5F', 'E9J2-TH6W-XM8C', 'F5L8-PB3Y-QR1G', 'G7M1-VK4N-DS2A', 'H2X5-ZC8J-TP6B'];

// ── Helpers ─────────────────────────────────────────────────────────────

const eventIcon: Record<SecurityEventType, string> = {
  login: 'KEY', login_2fa: 'PHONE', ['2fa_enabled']: 'SHIELD', ['2fa_disabled']: 'WARN',
  backup_code_used: 'LOCK', password_changed: 'PWD', withdrawal: 'CASH', withdrawal_2fa: 'PHONE',
};

const eventLabel: Record<SecurityEventType, string> = {
  login: 'Login', login_2fa: '2FA Verify', ['2fa_enabled']: '2FA Enabled', ['2fa_disabled']: '2FA Disabled',
  backup_code_used: 'Backup Code', password_changed: 'Password', withdrawal: 'Withdrawal', withdrawal_2fa: 'Withdrawal 2FA',
};

// ── SecurityCenter ──────────────────────────────────────────────────────

const SecurityCenter: React.FC<SecurityCenterProps> = ({
  twoFactorEnabled: input2FA = false,
  backupCodes: inputCodes,
  events: inputEvents,
  onEnable2FA,
  onDisable2FA,
  onRegenerateCodes,
  className = '',
}) => {
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(input2FA);
  const [backupCodes, setBackupCodes] = useState<string[]>(inputCodes ?? []);
  const [events] = useState<SecurityEvent[]>(inputEvents ?? mockEvents);
  const [step, setStep] = useState<'idle' | 'setup' | 'verify' | 'done' | 'disable'>('idle');
  const [totpCode, setTotpCode] = useState('');
  const [backupInput, setBackupInput] = useState('');
  const [showCodes, setShowCodes] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // ── Enable 2FA flow ──────────────────────────────────────────────────
  const startSetup = useCallback(() => {
    setStep('setup');
    setError('');
  }, []);

  const handleVerifyTOTP = useCallback(() => {
    if (totpCode.length < 6) { setError('Enter 6-digit code'); return; }
    // Mock: any 6-digit code works
    setTwoFactorEnabled(true);
    const codes = mockBackupCodes;
    setBackupCodes(codes);
    setStep('done');
    setSuccess('2FA enabled! Save your backup codes.');
    onEnable2FA?.(totpCode);
    setTotpCode('');
    setTimeout(() => setSuccess(''), 8000);
  }, [totpCode, onEnable2FA]);

  const handleDisable = useCallback(() => {
    if (!backupInput.trim()) { setError('Enter a backup code'); return; }
    const matched = backupCodes.includes(backupInput.trim().toUpperCase());
    if (!matched) { setError('Invalid backup code'); return; }
    setTwoFactorEnabled(false);
    setBackupCodes([]);
    setStep('idle');
    setSuccess('2FA disabled');
    onDisable2FA?.(backupInput);
    setBackupInput('');
    setTimeout(() => setSuccess(''), 5000);
  }, [backupInput, backupCodes, onDisable2FA]);

  const handleRegenCodes = useCallback(() => {
    const codes = mockBackupCodes.map(c => c.replace(/[A-Z0-9]/g, () => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[Math.floor(Math.random() * 36)]));
    setBackupCodes(codes);
    onRegenerateCodes?.();
  }, [onRegenerateCodes]);

  return (
    <div className={`security-center ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-slate-800">🔐 Security Center</h2>
        <span className={`text-xs font-bold px-3 py-1 rounded-full ${
          twoFactorEnabled ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
        }`}>
          {twoFactorEnabled ? '🛡 2FA Active' : '⚠️ No 2FA'}
        </span>
      </div>

      {/* 2FA Status Card */}
      <div className={`rounded-xl border p-4 mb-4 ${twoFactorEnabled ? 'bg-emerald-50/50 border-emerald-200' : 'bg-red-50/50 border-red-200'}`}>
        <h3 className="text-sm font-bold text-slate-700 mb-3">Two-Factor Authentication (TOTP)</h3>

        {step === 'idle' && !twoFactorEnabled && (
          <div>
            <p className="text-xs text-slate-600 mb-3">
              Add an extra layer of security. 2FA will be required for <strong>login</strong> and <strong>withdrawals</strong>.
              Uses Google Authenticator compatible TOTP.
            </p>
            <button onClick={startSetup}
              className="text-xs font-bold bg-slate-800 text-white hover:bg-slate-900 px-5 py-2.5 rounded-xl shadow-md transition-all">
              🛡 Enable 2FA
            </button>
          </div>
        )}

        {step === 'idle' && twoFactorEnabled && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">🟢</span>
              <span className="text-sm font-bold text-emerald-700">2FA is active</span>
            </div>
            <p className="text-xs text-slate-600 mb-3">Required for login and withdrawals. {backupCodes.length > 0 ? `${backupCodes.length} backup codes remaining.` : ''}</p>
            <div className="flex gap-2">
              <button onClick={() => setStep('disable')}
                className="text-xs font-medium text-red-500 bg-red-50 hover:bg-red-100 px-3 py-2 rounded-lg transition-colors">
                ⚠️ Disable 2FA
              </button>
              <button onClick={handleRegenCodes}
                className="text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-2 rounded-lg transition-colors">
                🔄 New Codes
              </button>
            </div>
          </div>
        )}

        {/* Setup Step: Show QR / Manual Key */}
        {step === 'setup' && (
          <div>
            <p className="text-xs text-slate-600 mb-3">Scan this QR code with Google Authenticator (or any TOTP app):</p>
            {/* Simulated QR */}
            <div className="bg-white rounded-xl border-2 border-slate-300 p-4 mb-3 flex items-center justify-center" style={{ width: 160, height: 160, margin: '0 auto' }}>
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: 49 }).map((_, i) => (
                  <div key={i} className={`w-3 h-3 rounded-sm ${Math.random() > 0.5 ? 'bg-slate-800' : 'bg-white border border-slate-200'}`} />
                ))}
              </div>
            </div>
            <p className="text-[10px] text-slate-400 text-center mb-3">
              Manual key: <code className="bg-slate-100 px-2 py-0.5 rounded font-mono">JBSWY3DPEHPK3PXP</code>
            </p>
            <button onClick={() => setStep('verify')}
              className="w-full text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 px-4 py-2.5 rounded-xl shadow-md transition-all">
              Next: Verify Code →
            </button>
          </div>
        )}

        {/* Verify Step */}
        {step === 'verify' && (
          <div>
            <p className="text-xs text-slate-600 mb-3">Enter the 6-digit code from your authenticator app:</p>
            <input type="text" value={totpCode} onChange={e => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="w-full text-lg font-mono text-center border-2 border-slate-200 rounded-xl px-4 py-3 mb-3 tracking-widest focus:ring-2 focus:ring-blue-300 outline-none"
              placeholder="000000" maxLength={6} />
            {error && <p className="text-[10px] text-red-500 mb-2">{error}</p>}
            <div className="flex gap-2">
              <button onClick={() => { setStep('setup'); setError(''); }}
                className="flex-1 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 px-3 py-2.5 rounded-xl">← Back</button>
              <button onClick={handleVerifyTOTP} disabled={totpCode.length < 6}
                className={`flex-1 text-xs font-bold px-3 py-2.5 rounded-xl transition-all ${
                  totpCode.length === 6 ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}>
                ✅ Verify & Enable
              </button>
            </div>
          </div>
        )}

        {/* Done Step: Show backup codes */}
        {step === 'done' && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xl">✅</span>
              <span className="text-sm font-bold text-emerald-700">2FA Enabled!</span>
            </div>
            <p className="text-xs text-slate-600 mb-2">
              <strong>Save these backup codes.</strong> Each can be used once to disable 2FA if you lose your device.
            </p>
            <div className="bg-slate-100 rounded-xl p-3 mb-3 font-mono text-xs">
              {showCodes ? (
                <div className="grid grid-cols-2 gap-1.5">
                  {backupCodes.map((code, i) => (
                    <div key={i} className="bg-white rounded px-2 py-1.5 text-[11px] text-slate-700 border border-slate-200">{code}</div>
                  ))}
                </div>
              ) : (
                <button onClick={() => setShowCodes(true)}
                  className="w-full text-xs font-semibold text-blue-600 py-3 hover:text-blue-700">
                  👁 Click to reveal backup codes
                </button>
              )}
            </div>
            <button onClick={() => { setStep('idle'); setShowCodes(false); }}
              className="w-full text-xs font-bold bg-slate-800 text-white hover:bg-slate-900 px-4 py-2.5 rounded-xl shadow-md">
              Done
            </button>
          </div>
        )}

        {/* Disable Step */}
        {step === 'disable' && (
          <div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3">
              <p className="text-xs text-red-700 font-semibold">⚠️ Warning: Disabling 2FA reduces account security.</p>
            </div>
            <p className="text-xs text-slate-600 mb-3">Enter a backup code to disable 2FA:</p>
            <input type="text" value={backupInput} onChange={e => setBackupInput(e.target.value.toUpperCase())}
              className="w-full text-sm font-mono border border-slate-200 rounded-lg px-3 py-2.5 mb-2 focus:ring-2 focus:ring-red-300 outline-none"
              placeholder="XXXX-XXXX-XXXX" />
            {error && <p className="text-[10px] text-red-500 mb-2">{error}</p>}
            <div className="flex gap-2">
              <button onClick={() => { setStep('idle'); setError(''); }}
                className="flex-1 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 px-3 py-2.5 rounded-xl">Cancel</button>
              <button onClick={handleDisable} disabled={!backupInput.trim()}
                className={`flex-1 text-xs font-bold px-3 py-2.5 rounded-xl transition-all ${
                  backupInput.trim() ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}>
                ⚠️ Disable 2FA
              </button>
            </div>
          </div>
        )}

        {success && <div className="mt-3 bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-xs text-emerald-700 font-semibold">✅ {success}</div>}
      </div>

      {/* Security Event Log */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <h3 className="text-xs font-bold text-slate-700 mb-3">📜 Security Event Log</h3>
        <div className="space-y-2 max-h-[300px] overflow-y-auto">
          {events.map(e => (
            <div key={e.id} className={`flex items-center justify-between py-2 border-b border-slate-100 last:border-0 ${!e.success ? 'bg-red-50/30 -mx-3 px-3 rounded' : ''}`}>
              <div className="flex items-center gap-2.5">
                <span className="text-sm">{eventIcon[e.type]}</span>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-slate-700">{eventLabel[e.type]}</span>
                    {!e.success && <span className="text-[10px] text-red-500 font-bold">FAILED</span>}
                  </div>
                  <span className="text-[10px] text-slate-400">{e.detail}</span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-slate-400">{e.ip} · {e.location}</div>
                <div className="text-[9px] text-slate-400">{new Date(e.timestamp).toLocaleString()}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SecurityCenter;
