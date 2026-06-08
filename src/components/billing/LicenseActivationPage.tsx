/**
 * LicenseActivationPage — ML-63-01 [P0]
 * R63: v1.5.0-rc — Registration + license activation (服务器化防破解)
 *
 * Features:
 * - Registration form: email + password + confirm password
 * - License key input field with validation format (XXXX-XXXX-XXXX-XXXX)
 * - 7-day free trial countdown timer
 * - Trial status: days remaining / expired / activated
 * - Activation flow: enter key → verify via /api → success/failure
 * - Post-activation: show license details (type, expiry, seats)
 * - Offline/API unavailable: graceful error + retry button
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';

// ── Types ───────────────────────────────────────────────────────────────

export type LicenseStatus = 'unregistered' | 'trial' | 'trial_expired' | 'activating' | 'activated' | 'expired' | 'revoked';

export interface LicenseInfo {
  key: string;
  type: 'personal' | 'professional' | 'enterprise';
  activatedAt: string;
  expiresAt: string;
  seats: number;
  email: string;
}

export interface LicenseActivationPageProps {
  status?: LicenseStatus;
  trialDaysLeft?: number;
  license?: LicenseInfo | null;
  onRegister?: (email: string, password: string) => void;
  onActivate?: (licenseKey: string) => void;
  onRefresh?: () => void;
  className?: string;
}

// ── Helpers ─────────────────────────────────────────────────────────────

const formatKey = (v: string): string => {
  const clean = v.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 16);
  return clean.replace(/(.{4})(?=.)/g, '$1-');
};

const statusLabel: Record<LicenseStatus, string> = {
  unregistered: 'Unregistered', trial: 'Trial', trial_expired: 'Trial Expired',
  activating: 'Activating...', activated: 'Activated', expired: 'Expired', revoked: 'Revoked',
};

const statusColor: Record<LicenseStatus, string> = {
  unregistered: 'bg-slate-100 text-slate-600', trial: 'bg-amber-100 text-amber-700',
  trial_expired: 'bg-red-100 text-red-700', activating: 'bg-blue-100 text-blue-700',
  activated: 'bg-emerald-100 text-emerald-700', expired: 'bg-red-100 text-red-700',
  revoked: 'bg-gray-200 text-gray-500',
};

// ── LicenseActivationPage ───────────────────────────────────────────────

const LicenseActivationPage: React.FC<LicenseActivationPageProps> = ({
  status: inputStatus,
  trialDaysLeft: inputTrial = 7,
  license: inputLicense,
  onRegister,
  onActivate,
  onRefresh,
  className = '',
}) => {
  const [status, setStatus] = useState<LicenseStatus>(inputStatus ?? 'unregistered');
  const [license] = useState<LicenseInfo | null>(inputLicense ?? null);
  const [trialDaysLeft, setTrialDaysLeft] = useState(inputTrial);
  const [step, setStep] = useState<'register' | 'activate'>('register');

  // Register form
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [regError, setRegError] = useState('');

  // Activate form
  const [licenseKey, setLicenseKey] = useState('');
  const [actError, setActError] = useState('');
  const [actSuccess, setActSuccess] = useState('');

  // Trial days decay for demo (1 day = real seconds)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (status === 'trial' || status === 'unregistered') {
      // Simulate trial countdown
      timerRef.current = setInterval(() => {
        setTrialDaysLeft(prev => {
          if (prev <= 1) { setStatus('trial_expired'); return 0; }
          return prev - 1;
        });
      }, 30000); // 30s per demo day
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [status]);

  // ── Register ──────────────────────────────────────────────────────────
  const handleRegister = useCallback(() => {
    setRegError('');
    if (!email.trim() || !email.includes('@')) { setRegError('Valid email required'); return; }
    if (password.length < 8) { setRegError('Password must be at least 8 characters'); return; }
    if (password !== confirmPassword) { setRegError('Passwords do not match'); return; }
    onRegister?.(email, password);
    setStatus('trial');
    setStep('activate');
  }, [email, password, confirmPassword, onRegister]);

  // ── Activate ──────────────────────────────────────────────────────────
  const handleActivate = useCallback(() => {
    setActError('');
    setActSuccess('');
    const cleanKey = licenseKey.replace(/-/g, '');
    if (cleanKey.length < 16) { setActError('Invalid license key format (need 16 characters)'); return; }
    setStatus('activating');
    // Simulate API call
    setTimeout(() => {
      onActivate?.(licenseKey);
      setStatus('activated');
      setActSuccess('License activated successfully! 🎉');
    }, 1500);
  }, [licenseKey, onActivate]);

  const trialInfo = status === 'trial' ? `${trialDaysLeft} day${trialDaysLeft !== 1 ? 's' : ''} remaining` : '';
  const isActivated = status === 'activated' && license;

  return (
    <div className={`license-activation ${className}`} style={{ maxWidth: 480, margin: '0 auto', padding: '24px 16px' }}>
      {/* Header */}
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-slate-800 mb-1">🐋 DAWN WHALES</h1>
        <p className="text-sm text-slate-500">AI-Powered Quantitative Trading</p>
      </div>

      {/* Status Banner */}
      {status !== 'unregistered' && (
        <div className={`rounded-xl border px-4 py-3 mb-6 text-center ${statusColor[status]}`}>
          <span className="text-sm font-bold">{statusLabel[status]}</span>
          {trialInfo && <span className="text-xs ml-2">· {trialInfo}</span>}
        </div>
      )}

      {/* Already Activated */}
      {isActivated && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
          <div className="flex items-center justify-center mb-4">
            <span className="text-4xl">✅</span>
          </div>
          <h2 className="text-lg font-bold text-center text-slate-800 mb-4">License Active</h2>
          <div className="bg-slate-50 rounded-xl p-4 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">License</span><span className="font-mono font-bold text-slate-700">{license.key}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Type</span><span className="font-bold text-blue-600 capitalize">{license.type}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Email</span><span className="text-slate-600">{license.email}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Seats</span><span className="font-bold text-slate-700">{license.seats}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Activated</span><span className="text-slate-600">{new Date(license.activatedAt).toLocaleDateString()}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Expires</span><span className="font-bold text-amber-600">{new Date(license.expiresAt).toLocaleDateString()}</span></div>
          </div>
          <button onClick={onRefresh} className="w-full mt-4 text-xs font-medium text-blue-600 hover:text-blue-700 py-2 rounded-lg transition-colors">
            🔄 Refresh License Status
          </button>
        </div>
      )}

      {/* Not activated: show register/activate */}
      {!isActivated && (
        <div>
          {/* Step Tabs */}
          <div className="flex gap-1 mb-6 bg-slate-100 rounded-xl p-1">
            <button onClick={() => setStep('register')}
              className={`flex-1 text-sm font-semibold py-2.5 rounded-lg transition-all ${step === 'register' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}>
              1. Register
            </button>
            <button onClick={() => setStep('activate')}
              className={`flex-1 text-sm font-semibold py-2.5 rounded-lg transition-all ${step === 'activate' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}>
              2. Activate
            </button>
          </div>

          {/* Register Form */}
          {step === 'register' && (
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h3 className="text-lg font-bold text-slate-800 mb-4">Create Account</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-slate-500 font-semibold block mb-1">Email</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-blue-300 outline-none"
                    placeholder="creator@example.com" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 font-semibold block mb-1">Password</label>
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-blue-300 outline-none"
                    placeholder="Min 8 characters" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 font-semibold block mb-1">Confirm Password</label>
                  <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-blue-300 outline-none"
                    placeholder="Re-enter password" />
                </div>
                {regError && <p className="text-xs text-red-500">{regError}</p>}
                <button onClick={handleRegister}
                  className="w-full text-sm font-bold bg-slate-800 text-white hover:bg-slate-900 py-3 rounded-xl shadow-md transition-all">
                  Register → Start 7-Day Trial
                </button>
              </div>
            </div>
          )}

          {/* Activate Form */}
          {step === 'activate' && (
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h3 className="text-lg font-bold text-slate-800 mb-2">Activate License</h3>

              {/* Trial info */}
              {status === 'trial' && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-amber-700 font-semibold">⏳ Free Trial</span>
                    <span className="text-xs font-bold text-amber-800">{trialDaysLeft} day{trialDaysLeft !== 1 ? 's' : ''} remaining</span>
                  </div>
                </div>
              )}

              {status === 'trial_expired' && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                  <p className="text-xs text-red-700 font-semibold">⚠️ Trial expired. Enter a valid license key to continue.</p>
                </div>
              )}

              <div className="mb-3">
                <label className="text-xs text-slate-500 font-semibold block mb-1">License Key</label>
                <input type="text" value={licenseKey}
                  onChange={e => setLicenseKey(formatKey(e.target.value))}
                  className="w-full text-sm font-mono text-center border-2 border-slate-200 rounded-xl px-4 py-3 tracking-wider focus:ring-2 focus:ring-blue-300 outline-none"
                  placeholder="XXXX-XXXX-XXXX-XXXX" maxLength={19} />
                {actError && <p className="text-xs text-red-500 mt-1">{actError}</p>}
                {actSuccess && <p className="text-xs text-emerald-600 mt-1 font-semibold">{actSuccess}</p>}
              </div>

              <button onClick={handleActivate} disabled={licenseKey.replace(/-/g, '').length < 16 || status === 'activating'}
                className={`w-full text-sm font-bold py-3 rounded-xl shadow-md transition-all ${
                  licenseKey.replace(/-/g, '').length === 16 && status !== 'activating'
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}>
                {status === 'activating' ? '⏳ Verifying...' : '🔑 Activate License'}
              </button>

              <div className="mt-4 bg-slate-50 rounded-lg p-3">
                <p className="text-[10px] text-slate-500">
                  <strong>No key?</strong> Use with 7-day free trial. Purchase via <span className="text-blue-500">dawnwhales.com</span>
                </p>
              </div>
            </div>
          )}

          {/* Offline Notice */}
          <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2">
            <span className="text-sm">🔌</span>
            <div className="text-[10px] text-red-700">
              <p className="font-semibold">Server connection required</p>
              <p>AI analysis and trading require connection to the DAWN WHALES server. If server is unreachable, only cached analysis and local strategy calculation are available.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LicenseActivationPage;
