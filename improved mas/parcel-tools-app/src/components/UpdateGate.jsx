import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Download, RefreshCw, ShieldAlert } from 'lucide-react';

const STATUS_URL = 'http://localhost:5000/api/app/version-status';
const RECHECK_MS = 5 * 60 * 1000;

/**
 * Full-screen block shown when the admin has set a minimum version and this copy of the app is older.
 * The backend refuses every request in that case, so this screen is how the user learns what to do.
 */
export default function UpdateGate() {
  const [status, setStatus] = useState(null);
  const [phase, setPhase] = useState('idle');          // idle | checking | downloading | ready | manual
  const [percent, setPercent] = useState(0);
  const phaseRef = useRef('idle');
  const setPhaseBoth = (p) => { phaseRef.current = p; setPhase(p); };

  const check = useCallback(async () => {
    try {
      const res = await fetch(STATUS_URL);
      if (res.ok) setStatus(await res.json());
    } catch { /* backend not up yet: try again later */ }
  }, []);

  useEffect(() => {
    check();
    const t = setInterval(check, RECHECK_MS);
    const onFocus = () => check();
    window.addEventListener('focus', onFocus);
    window.addEventListener('parcel-update-required', onFocus);
    return () => { clearInterval(t); window.removeEventListener('focus', onFocus); window.removeEventListener('parcel-update-required', onFocus); };
  }, [check]);

  const api = typeof window !== 'undefined' ? window.electronAPI : null;

  const openDownloadPage = () => {
    const url = status?.downloadUrl;
    if (!url) return;
    if (api?.openExternal) api.openExternal(url); else window.open(url, '_blank', 'noopener');
  };

  const startUpdate = async () => {
    if (!api?.checkForUpdates) { openDownloadPage(); setPhaseBoth('manual'); return; }
    setPhaseBoth('checking');
    api.removeUpdateListeners?.();
    api.onUpdateAvailable?.(async () => {
      setPhaseBoth('downloading');
      try { await api.startDownloadUpdate(); } catch { setPhaseBoth('manual'); }
    });
    api.onUpdateProgress?.((p) => setPercent(Math.round(p?.percent || 0)));
    api.onUpdateDownloaded?.(() => { setPhaseBoth('ready'); api.quitAndInstallUpdate?.(); });
    api.onUpdateError?.(() => setPhaseBoth('manual'));
    try { await api.checkForUpdates(); } catch { setPhaseBoth('manual'); }
    // No update offered (e.g. the release is not published yet): fall back to the download page
    setTimeout(() => { if (phaseRef.current === 'checking') setPhaseBoth('manual'); }, 20000);
  };

  if (!status?.updateRequired) return null;

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 2147483000, background: 'rgba(5,7,12,.97)', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div className="max-w-md w-full text-center bg-dark-900 border border-dark-700 rounded-2xl p-8 shadow-2xl">
        <ShieldAlert className="w-12 h-12 mx-auto mb-4 text-amber-400" />
        <h1 className="text-2xl font-bold text-white mb-2">Update required</h1>
        <p className="text-sm text-dark-300 mb-5">{status.message}</p>
        <div className="flex justify-center gap-6 text-xs text-dark-400 mb-6">
          <span>Your version: <b className="text-dark-200">v{status.currentVersion}</b></span>
          <span>Required: <b className="text-green-400">v{status.minimumVersion}</b> or newer</span>
        </div>

        {phase === 'downloading' && (
          <div className="mb-4">
            <div className="h-2 rounded-full bg-dark-800 overflow-hidden"><div className="h-full bg-primary transition-all" style={{ width: `${percent}%` }} /></div>
            <p className="text-xs text-dark-400 mt-2">Downloading update… {percent}%</p>
          </div>
        )}
        {phase === 'ready' && <p className="text-sm text-green-400 mb-4">Update downloaded — restarting to install…</p>}
        {phase === 'manual' && (
          <p className="text-xs text-amber-300 mb-4">Automatic update isn't available right now. Download the installer from the page below and run it.</p>
        )}

        <div className="flex flex-col gap-2">
          {(phase === 'idle' || phase === 'checking') && (
            <button onClick={startUpdate} disabled={phase === 'checking'}
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-primary hover:bg-primary/90 disabled:opacity-60 text-white font-semibold text-sm">
              {phase === 'checking' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {phase === 'checking' ? 'Checking for the update…' : 'Update now'}
            </button>
          )}
          <button onClick={openDownloadPage}
            className="px-4 py-2.5 rounded-xl bg-dark-800 hover:bg-dark-700 border border-dark-700 text-dark-200 text-sm">
            Open the download page
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
