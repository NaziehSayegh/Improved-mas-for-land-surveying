import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield, Check, AlertCircle, Clock, CreditCard,
  ExternalLink, Key, Mail, Loader, AlertTriangle,
  RefreshCw, Lock, CheckCircle2, ChevronDown, ChevronUp
} from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { customConfirm } from '../utils/dialogs';
import PageLayout from '../components/PageLayout';

export default function LicensePage() {
  const toast = useToast();
  const navigate = useNavigate();
  const [licenseStatus, setLicenseStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState(false);
  const [email, setEmail] = useState('');
  const [licenseKey, setLicenseKey] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showSupport, setShowSupport] = useState(false);
  const [backendOnline, setBackendOnline] = useState(null);

  // ESC to go back
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') navigate('/'); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [navigate]);

  // Always fetch from backend — never trust only local state
  const checkStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch('http://127.0.0.1:5000/api/license/status', { cache: 'no-store' });
      const data = await res.json();
      setLicenseStatus(data);
      setBackendOnline(true);
    } catch {
      setBackendOnline(false);
      setLicenseStatus({ status: 'no_license', is_valid: false, message: 'Could not connect to license server' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { checkStatus(); }, []);

  // Auto-format license key as XXXX-XXXX-XXXX-XXXX
  const handleKeyChange = (e) => {
    const raw = e.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 16);
    const formatted = raw.match(/.{1,4}/g)?.join('-') ?? raw;
    setLicenseKey(formatted);
  };

  const handleBuyNow = () => {
    const url = 'https://sayegh8.gumroad.com/l/uaupi';
    if (window.electronAPI?.openExternal) window.electronAPI.openExternal(url);
    else window.open(url, '_blank');
  };

  const handleActivateLicense = async (e) => {
    e.preventDefault();
    if (!email || !licenseKey) { setError('Please enter both email and license key.'); return; }
    setActivating(true); setError(''); setSuccess('');
    try {
      const res = await fetch('http://127.0.0.1:5000/api/license/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), license_key: licenseKey.trim() })
      });
      const data = await res.json();
      if (data.success) {
        setSuccess('License activated successfully! 🎉');
        setEmail(''); setLicenseKey('');
        await checkStatus(); // re-fetch from backend
        toast.success('✅ License activated! Enjoy Parcel Tools.');
      } else {
        setError(data.error || 'Invalid license key or email.');
      }
    } catch {
      setError('Activation failed. Check your internet connection and try again.');
    } finally {
      setActivating(false);
    }
  };

  const handleDeactivate = async () => {
    const confirmed = await customConfirm('Are you sure you want to deactivate this license? You will need your key to re-activate.');
    if (!confirmed) return;
    setActivating(true); setError('');
    try {
      const res = await fetch('http://127.0.0.1:5000/api/license/deactivate', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        toast.success('License deactivated.');
        await checkStatus();
      } else {
        setError(data.error || 'Deactivation failed.');
      }
    } catch {
      setError('Deactivation failed: network error.');
    } finally {
      setActivating(false);
    }
  };

  // ── Status helpers ───────────────────────────────────────────
  const isActivated = licenseStatus?.status === 'activated';
  const isTrial = licenseStatus?.status === 'trial';
  const isExpired = licenseStatus?.status === 'expired';
  const isNoLicense = !isActivated && !isTrial;

  if (loading) {
    return (
      <div className="page-container items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader className="w-10 h-10 text-primary animate-spin" />
          <p className="text-dark-300 text-sm">Verifying license…</p>
        </div>
      </div>
    );
  }

  return (
    <PageLayout
      title="License Management"
      backPath="/"
      backLabel="Main Menu"
      showLicense={false}
      headerRight={
        <div className="flex items-center gap-2">
          {backendOnline === false && (
            <span className="flex items-center gap-1.5 text-xs text-yellow-400 bg-yellow-900/30
                             border border-yellow-700/50 px-2.5 py-1 rounded-full">
              <AlertTriangle className="w-3 h-3" /> Offline
            </span>
          )}
          {backendOnline === true && (
            <span className="flex items-center gap-1.5 text-xs text-green-400 bg-green-900/20
                             border border-green-700/40 px-2.5 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" /> Engine Connected
            </span>
          )}
          <button onClick={checkStatus} disabled={loading}
            className="btn-ghost py-1.5 px-2.5 text-xs" title="Re-check status">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      }
    >
      {/* ── Main 2-column layout ─────────────────────────────── */}
      <div className="h-full flex gap-4 p-4 overflow-hidden">

        {/* ── Left Column: Status + Activation ─────────────── */}
        <div className="flex flex-col gap-4 w-full lg:w-[52%] overflow-y-auto no-scrollbar">

          {/* Status Card */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass rounded-xl p-5"
          >
            <h2 className="text-sm font-bold text-dark-300 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Shield className="w-4 h-4" /> Current License Status
            </h2>

            {isActivated && (
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 bg-green-900/20 border border-green-700/50 rounded-lg">
                  <div className="w-10 h-10 rounded-full bg-green-500/20 border border-green-500/40 flex items-center justify-center flex-shrink-0 animate-badge-pulse">
                    <CheckCircle2 className="w-5 h-5 text-green-400" />
                  </div>
                  <div>
                    <p className="font-bold text-green-400">Licensed ✓</p>
                    <p className="text-xs text-dark-400">{licenseStatus.message}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-dark-700/50 rounded-lg p-3">
                    <p className="text-dark-400 mb-1">Licensed Email</p>
                    <p className="text-dark-100 font-medium truncate">{licenseStatus.email || 'N/A'}</p>
                  </div>
                  <div className="bg-dark-700/50 rounded-lg p-3">
                    <p className="text-dark-400 mb-1">Activated On</p>
                    <p className="text-dark-100 font-medium">
                      {licenseStatus.activated_date
                        ? new Date(licenseStatus.activated_date).toLocaleDateString()
                        : 'N/A'}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-dark-500 flex items-center gap-1">
                  <Lock className="w-3 h-3" /> License is machine-locked to this device.
                </p>
                <button onClick={handleDeactivate} disabled={activating}
                  className="text-xs text-red-500 hover:text-red-400 transition-colors flex items-center gap-1">
                  {activating ? <Loader className="w-3 h-3 animate-spin" /> : null}
                  Deactivate license on this device
                </button>
              </div>
            )}

            {isTrial && (
              <div className="flex items-center gap-3 p-3 bg-yellow-900/20 border border-yellow-700/50 rounded-lg">
                <div className="w-10 h-10 rounded-full bg-yellow-500/20 border border-yellow-500/40 flex items-center justify-center flex-shrink-0 animate-warn-pulse">
                  <Clock className="w-5 h-5 text-yellow-400" />
                </div>
                <div>
                  <p className="font-bold text-yellow-400">Free Trial — {licenseStatus.days_left} days left</p>
                  <p className="text-xs text-dark-400">{licenseStatus.message}</p>
                </div>
              </div>
            )}

            {isNoLicense && (
              <div className="flex items-center gap-3 p-3 bg-red-900/20 border border-red-700/50 rounded-lg">
                <div className="w-10 h-10 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center flex-shrink-0 animate-danger-pulse">
                  <AlertCircle className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <p className="font-bold text-red-400">
                    {isExpired ? 'Trial Expired' : 'No License'}
                  </p>
                  <p className="text-xs text-dark-400">{licenseStatus?.message}</p>
                </div>
              </div>
            )}
          </motion.div>

          {/* Alerts */}
          <AnimatePresence>
            {error && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-red-900/20 border border-red-700/50 rounded-xl p-4 flex items-start gap-3">
                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                <span className="text-red-300 text-sm">{error}</span>
              </motion.div>
            )}
            {success && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-green-900/20 border border-green-700/50 rounded-xl p-4 flex items-start gap-3">
                <Check className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                <span className="text-green-300 text-sm">{success}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Activation Form */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="glass rounded-xl p-5"
          >
            <h3 className="text-sm font-bold text-dark-300 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Key className="w-4 h-4 text-yellow-400" /> Activate License Key
            </h3>

            {isActivated ? (
              <p className="text-dark-400 text-sm">
                ✅ Your license is already active. No action needed.
              </p>
            ) : (
              <>
                <p className="text-dark-400 text-xs mb-4">
                  Already purchased? Enter your email and license key below.
                  <br />Your key was emailed after payment on Gumroad.
                </p>
                <form onSubmit={handleActivateLicense} className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-dark-300 mb-1.5">
                      <Mail className="w-3.5 h-3.5 inline mr-1.5 mb-0.5" />
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your@email.com"
                      className="input-field text-sm"
                      disabled={activating}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-dark-300 mb-1.5">
                      <Key className="w-3.5 h-3.5 inline mr-1.5 mb-0.5" />
                      License Key
                    </label>
                    <input
                      type="text"
                      value={licenseKey}
                      onChange={handleKeyChange}
                      placeholder="XXXX-XXXX-XXXX-XXXX"
                      className="input-field text-sm font-mono tracking-widest"
                      disabled={activating}
                      maxLength={19}
                      spellCheck={false}
                    />
                    <p className="text-xs text-dark-500 mt-1">
                      Key is auto-formatted as you type.
                    </p>
                  </div>
                  <button
                    type="submit"
                    disabled={activating || !email || licenseKey.replace(/-/g, '').length < 16}
                    className="btn-primary w-full py-2.5"
                  >
                    {activating ? (
                      <><Loader className="w-4 h-4 animate-spin" /> Activating…</>
                    ) : (
                      <><Key className="w-4 h-4" /> Activate License</>
                    )}
                  </button>
                </form>
              </>
            )}
          </motion.div>

          {/* Support (collapsible) */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="glass rounded-xl overflow-hidden"
          >
            <button
              onClick={() => setShowSupport(v => !v)}
              className="w-full flex items-center justify-between px-5 py-3 text-sm font-medium
                         text-dark-300 hover:text-dark-100 transition-colors"
            >
              <span className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-primary" /> Need Help?
              </span>
              {showSupport ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            <AnimatePresence>
              {showSupport && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="px-5 pb-4 space-y-2 text-xs text-dark-400 border-t border-dark-700">
                    <div className="pt-3" />
                    <p>📧 <strong className="text-dark-200">Email:</strong>{' '}
                      <a href="mailto:nsayegh2003@gmail.com" className="text-primary hover:underline">
                        nsayegh2003@gmail.com
                      </a>
                    </p>
                    <p>⏱ <strong className="text-dark-200">Response:</strong> Usually within 2–4 hours</p>
                    <ul className="list-disc list-inside space-y-1 mt-2 text-dark-500">
                      <li>Lost key? Email us with your Gumroad receipt.</li>
                      <li>Activation issue? Make sure you're online.</li>
                      <li>Refund? 30-day money-back guarantee.</li>
                    </ul>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>

        {/* ── Right Column: Purchase Card ───────────────────── */}
        <div className="hidden lg:flex lg:w-[48%] flex-col gap-4 overflow-y-auto no-scrollbar">
          <motion.div
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15 }}
            className="flex-1 rounded-xl border-2 border-green-600/60 overflow-hidden
                       bg-gradient-to-br from-green-900/20 via-dark-800 to-dark-800
                       flex flex-col"
          >
            {/* Header */}
            <div className="px-6 pt-6 pb-4 border-b border-green-700/30">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold
                              bg-green-500/20 border border-green-500/40 text-green-400 mb-3">
                🔒 SECURE CHECKOUT via Gumroad
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-black text-white">$29.99</span>
                <span className="text-dark-400 text-base">one-time</span>
              </div>
              <p className="text-dark-300 text-sm mt-1">Lifetime license — no subscriptions.</p>
            </div>

            {/* Features */}
            <div className="px-6 py-4 flex-1 space-y-2.5">
              {[
                'Lifetime license — never expires',
                'All features unlocked immediately',
                'Free updates forever',
                'Priority email support',
                '30-day money-back guarantee',
                'Machine-locked for your security',
              ].map((f) => (
                <div key={f} className="flex items-center gap-2.5 text-sm text-dark-200">
                  <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
                  {f}
                </div>
              ))}
            </div>

            {/* CTA */}
            <div className="px-6 pb-6">
              <button
                onClick={handleBuyNow}
                className="w-full py-4 px-6 bg-green-600 hover:bg-green-500 active:scale-[0.98]
                           text-white text-lg font-bold rounded-xl transition-all duration-200
                           flex items-center justify-center gap-3 shadow-glow-green"
              >
                <CreditCard className="w-5 h-5" />
                Buy Now — $29.99
                <ExternalLink className="w-4 h-4 opacity-70" />
              </button>
              <p className="text-center text-xs text-dark-500 mt-3">
                💳 Accepts PayPal · Visa · Mastercard · Amex<br />
                Instant license key delivery via email
              </p>
            </div>
          </motion.div>

          {/* Already purchased hint */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="glass rounded-xl p-4 text-center"
          >
            <p className="text-dark-400 text-xs">
              Already purchased?{' '}
              <span className="text-primary">Enter your key in the Activate form on the left.</span>
              <br />Check your email inbox (and spam folder) for the license key.
            </p>
          </motion.div>
        </div>
      </div>
    </PageLayout>
  );
}
