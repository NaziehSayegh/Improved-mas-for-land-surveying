import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Lock, AlertTriangle } from 'lucide-react';
import { motion } from 'framer-motion';
import { API_LOOPBACK_URL } from '../config';
import PageLoader from './PageLoader';

/**
 * LicenseGuard — wraps protected routes.
 * On mount it fetches /api/license/status:
 *   - is_valid: false + status 'no_license'  → redirect to /license
 *   - status 'expired'                        → show full-screen expired modal (blocks all navigation)
 *   - backend unreachable                     → soft warning toast, allow access
 *   - is_valid: true                          → render children normally
 */
// The last good answer from the license check, kept while the app is open.
// Every screen has its own guard, so without this each move between screens would
// show "Verifying license…" again while it waits for the backend.
let rememberedState = null; // 'valid' | 'offline' | null

const LicenseGuard = ({ children }) => {
  const navigate = useNavigate();
  // 'checking' | 'valid' | 'no_license' | 'expired' | 'blocked' | 'offline'
  const [state, setStateRaw] = useState(rememberedState || 'checking');

  useEffect(() => {
    const setState = (next) => {
      rememberedState = (next === 'valid' || next === 'offline') ? next : null;
      setStateRaw(next);
    };
    // Already verified on another screen: show this one at once and re-check quietly (one attempt).
    let isInitial = !rememberedState;
    const check = async () => {
      const maxAttempts = isInitial ? 8 : 1;
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
          const token = sessionStorage.getItem('sessionToken');
          const headers = {};
          if (token) {
            headers['X-Session-Token'] = token;
          }

          const res = await fetch(`${API_LOOPBACK_URL}/api/license/status`, { 
            cache: 'no-store',
            headers
          });
          const data = await res.json();

          if (data.status === 'blocked') {
            setState('blocked');
          } else if (data.is_valid) {
            setState('valid');
          } else if (data.status === 'expired') {
            setState('expired');
          } else {
            // no_license or invalid
            setState('no_license');
            navigate('/license', { replace: true });
          }
          isInitial = false;
          return;
        } catch (err) {
          if (attempt < maxAttempts - 1) {
            await new Promise((resolve) => setTimeout(resolve, 500));
          } else {
            // Backend unreachable — allow access (graceful degradation)
            setState('offline');
          }
        }
      }
      isInitial = false;
    };

    check();
    const intervalId = setInterval(check, 300000); // Check every 5 minutes, not every 5 seconds
    return () => clearInterval(intervalId);
  }, [navigate]);

  // ── Loading ───────────────────────────────────────────────────
  if (state === 'checking') {
    return (
      <div className="page-container items-center justify-center">
        <PageLoader label="Verifying license" />
      </div>
    );
  }

  // ── Blocked ───────────────────────────────────────────────────
  if (state === 'blocked') {
    return (
      <div className="page-container items-center justify-center bg-dark-900">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass rounded-2xl p-10 max-w-md w-full mx-4 text-center shadow-glass"
        >
          <div className="w-16 h-16 rounded-full bg-red-500/20 border border-red-500/50
                          flex items-center justify-center mx-auto mb-5">
            <Lock className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">
            Account Suspended
          </h2>
          <p className="text-dark-300 mb-6">
            Your account has been disabled. Please contact the administrator.
          </p>
          <button
            onClick={() => {
              const url = 'mailto:nsayegh2003@yahoo.com';
              if (window.electronAPI?.openExternal) window.electronAPI.openExternal(url);
              else window.open(url, '_blank');
            }}
            className="btn-primary w-full py-3 text-base"
          >
            Contact Support
          </button>
          <button
            onClick={() => {
              // Clear session token/userId and reload to go to login
              localStorage.removeItem('userId');
              localStorage.removeItem('userEmail');
              localStorage.removeItem('accountType');
              sessionStorage.removeItem('sessionToken');
              window.location.reload();
            }}
            className="btn-ghost w-full mt-3 text-sm justify-center"
          >
            Log Out
          </button>
        </motion.div>
      </div>
    );
  }

  // ── Expired ───────────────────────────────────────────────────
  if (state === 'expired') {
    return (
      <div className="page-container items-center justify-center bg-dark-900">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass rounded-2xl p-10 max-w-md w-full mx-4 text-center shadow-glass"
        >
          <div className="w-16 h-16 rounded-full bg-red-500/20 border border-red-500/50
                          flex items-center justify-center mx-auto mb-5">
            <Lock className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">
            Trial Expired
          </h2>
          <p className="text-dark-300 mb-6">
            Your free trial has expired. Purchase a license to continue using Parcel Tools.
          </p>
          <button
            onClick={() => {
              const url = 'https://sayegh8.gumroad.com/l/uaupi';
              if (window.electronAPI?.openExternal) window.electronAPI.openExternal(url);
              else window.open(url, '_blank');
            }}
            className="btn-primary w-full py-3 text-base"
          >
            <Shield className="w-5 h-5" />
            Get License — $100.00
          </button>
          <button
            onClick={() => navigate('/license')}
            className="btn-ghost w-full mt-3 text-sm justify-center"
          >
            Already have a license? Activate
          </button>
          <button
            onClick={() => navigate('/')}
            className="btn-ghost w-full mt-2 text-sm justify-center"
          >
            Go to Main Menu
          </button>
        </motion.div>
      </div>
    );
  }

  // ── Offline warning banner + children ────────────────────────
  if (state === 'offline') {
    return (
      <>
        <div className="flex-shrink-0 bg-yellow-900/30 border-b border-yellow-700/50 px-4 py-1.5
                        flex items-center gap-2 text-xs text-yellow-400">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
          License server unreachable — running in offline mode.
        </div>
        {children}
      </>
    );
  }

  // ── Valid (or redirecting for no_license) ─────────────────────
  return children;
};

export default LicenseGuard;
