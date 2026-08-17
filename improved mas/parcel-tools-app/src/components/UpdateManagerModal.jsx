import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Sparkles, Download, CheckCircle2, ArrowRight, X, 
    RefreshCw, AlertCircle, ShieldCheck, Minimize2 
} from 'lucide-react';

export default function UpdateManagerModal() {
    const [updateState, setUpdateState] = useState(null); // null | 'available' | 'downloading' | 'ready' | 'installing' | 'error'
    const [updateInfo, setUpdateInfo] = useState(null);
    const [progress, setProgress] = useState({ percent: 0, transferred: 0, total: 0, bytesPerSecond: 0 });
    const [errorMessage, setErrorMessage] = useState('');
    const [isMinimized, setIsMinimized] = useState(true); // Default to non-intrusive floating pill

    // Format bytes helper
    const formatBytes = (bytes) => {
        if (!bytes || isNaN(bytes)) return '0 MB';
        const mb = bytes / (1024 * 1024);
        return `${mb.toFixed(1)} MB`;
    };

    const formatSpeed = (bytesPerSec) => {
        if (!bytesPerSec || isNaN(bytesPerSec)) return '';
        const mbps = bytesPerSec / (1024 * 1024);
        return `${mbps.toFixed(2)} MB/s`;
    };

    useEffect(() => {
        if (typeof window === 'undefined' || !window.electronAPI) return;

        // 1. Update Available Listener
        if (window.electronAPI.onUpdateAvailable) {
            window.electronAPI.onUpdateAvailable((info) => {
                console.log('[Update UI] Update available:', info);
                
                // Check if user already dismissed this specific version
                const dismissedVersion = localStorage.getItem('dismissed_update_version');
                if (dismissedVersion === info.version) {
                    console.log(`[Update UI] Version ${info.version} was previously dismissed by user.`);
                    return;
                }

                setUpdateInfo(info);
                setUpdateState('available');
                setIsMinimized(true); // Keep as subtle corner notification — never block the screen!
            });
        }

        // 2. Download Progress Listener
        if (window.electronAPI.onUpdateProgress) {
            window.electronAPI.onUpdateProgress((prog) => {
                if (typeof prog === 'number') {
                    setProgress({ percent: prog, transferred: 0, total: 0, bytesPerSecond: 0 });
                } else if (prog && typeof prog === 'object') {
                    setProgress({
                        percent: prog.percent || 0,
                        transferred: prog.transferred || 0,
                        total: prog.total || 0,
                        bytesPerSecond: prog.bytesPerSecond || 0
                    });
                }
                setUpdateState(prev => (prev === 'ready' || prev === 'installing') ? prev : 'downloading');
            });
        }

        // 3. Update Downloaded Listener
        if (window.electronAPI.onUpdateDownloaded) {
            window.electronAPI.onUpdateDownloaded((info) => {
                console.log('[Update UI] Update downloaded:', info);
                setUpdateState('ready');
                setIsMinimized(false); // Open modal when ready to restart
            });
        }

        // 4. Update Error Listener
        if (window.electronAPI.onUpdateError) {
            window.electronAPI.onUpdateError((err) => {
                console.error('[Update UI] Update error:', err);
                setErrorMessage(typeof err === 'string' ? err : 'Could not download update');
                setUpdateState('error');
            });
        }

        return () => {
            if (window.electronAPI.removeUpdateListeners) {
                window.electronAPI.removeUpdateListeners();
            }
        };
    }, []);

    // Action handlers
    const handleStartDownload = async () => {
        try {
            setUpdateState('downloading');
            setIsMinimized(false);
            if (window.electronAPI?.startDownloadUpdate) {
                await window.electronAPI.startDownloadUpdate();
            }
        } catch (err) {
            setErrorMessage(err.message || 'Failed to start download');
            setUpdateState('error');
        }
    };

    const handleRestartAndInstall = async () => {
        try {
            setUpdateState('installing');
            if (window.electronAPI?.quitAndInstallUpdate) {
                await window.electronAPI.quitAndInstallUpdate();
            }
        } catch (err) {
            setErrorMessage(err.message || 'Failed to restart application');
            setUpdateState('error');
        }
    };

    const handleDismissPermanently = () => {
        if (updateInfo?.version) {
            localStorage.setItem('dismissed_update_version', updateInfo.version);
        }
        setUpdateState(null);
    };

    const handleDismiss = () => {
        if (updateState === 'downloading') {
            setIsMinimized(true);
        } else if (updateState === 'available') {
            handleDismissPermanently();
        } else {
            setUpdateState(null);
        }
    };

    if (!updateState) return null;

    return (
        <>
            {/* ── Non-Intrusive Floating Corner Notification (Never blocks work) ── */}
            {isMinimized && (
                <motion.div
                    initial={{ opacity: 0, y: 50, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="fixed bottom-6 right-6 z-[99999] bg-dark-900/95 border border-primary/50 text-white px-4 py-3 rounded-2xl shadow-2xl backdrop-blur-xl flex items-center gap-3 select-none"
                >
                    <div 
                        onClick={() => setIsMinimized(false)}
                        className="flex items-center gap-3 cursor-pointer group"
                    >
                        <div className="w-8 h-8 rounded-xl bg-primary/20 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                            {updateState === 'downloading' ? (
                                <Download className="w-4 h-4 animate-bounce" />
                            ) : (
                                <Sparkles className="w-4 h-4 text-cyan-400" />
                            )}
                        </div>
                        <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-white">
                                    {updateState === 'downloading' ? 'Downloading Update' : `Update v${updateInfo?.version || '2.0.12'} Available`}
                                </span>
                                {updateState === 'downloading' && (
                                    <span className="text-xs font-mono font-bold text-primary">{progress.percent}%</span>
                                )}
                            </div>
                            <span className="text-[10px] text-dark-400 group-hover:text-primary transition-colors">
                                {updateState === 'downloading' ? 'Click to view progress' : 'Click to review & install'}
                            </span>
                        </div>
                    </div>

                    <button
                        onClick={handleDismiss}
                        className="ml-2 text-dark-400 hover:text-white p-1 hover:bg-dark-800 rounded-lg transition-colors"
                        title="Dismiss notification"
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                </motion.div>
            )}

            {/* ── Full Interactive Modal (Only shown when user clicks to expand or when download completes) ── */}
            <AnimatePresence>
                {!isMinimized && (
                    <div className="fixed inset-0 z-[999999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.92, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.92, y: 20 }}
                            transition={{ type: "spring", stiffness: 450, damping: 30 }}
                            className="bg-dark-900 border border-dark-700/80 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden relative text-white"
                        >
                            {/* Top Decorative Glow */}
                            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 via-primary to-emerald-500" />

                            {/* Header */}
                            <div className="p-6 border-b border-dark-800 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center text-primary shadow-[0_0_15px_rgba(6,182,212,0.2)]">
                                        {updateState === 'ready' ? (
                                            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                                        ) : updateState === 'error' ? (
                                            <AlertCircle className="w-5 h-5 text-rose-400" />
                                        ) : (
                                            <Sparkles className="w-5 h-5 text-yellow-400" />
                                        )}
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-white tracking-tight">
                                            {updateState === 'available' && 'Software Update Available'}
                                            {updateState === 'downloading' && 'Downloading Latest Version'}
                                            {updateState === 'ready' && 'Update Ready to Install!'}
                                            {updateState === 'installing' && 'Installing & Restarting...'}
                                            {updateState === 'error' && 'Update Download Error'}
                                        </h3>
                                        <p className="text-xs text-dark-400">
                                            {updateState === 'available' && 'A newer version of Parcel Tools is ready for you.'}
                                            {updateState === 'downloading' && 'You can continue working while the update downloads.'}
                                            {updateState === 'ready' && 'Download verified. Restart to apply in seconds.'}
                                            {updateState === 'installing' && 'Please wait a moment while the app restarts.'}
                                            {updateState === 'error' && 'Encountered an issue downloading the update.'}
                                        </p>
                                    </div>
                                </div>

                                {updateState !== 'installing' && (
                                    <button
                                        onClick={handleDismiss}
                                        className="text-dark-400 hover:text-white p-1.5 hover:bg-dark-800 rounded-lg transition-colors"
                                        title={updateState === 'downloading' ? 'Minimize' : 'Close'}
                                    >
                                        {updateState === 'downloading' ? <Minimize2 className="w-4 h-4" /> : <X className="w-4 h-4" />}
                                    </button>
                                )}
                            </div>

                            {/* Body Content */}
                            <div className="p-6 flex flex-col gap-5">
                                {/* ── STAGE 1: AVAILABLE ── */}
                                {updateState === 'available' && (
                                    <>
                                        <div className="flex items-center justify-between p-3.5 bg-dark-950/80 border border-dark-800 rounded-xl">
                                            <div className="flex flex-col">
                                                <span className="text-[11px] text-dark-400 font-sans">Installed Version</span>
                                                <span className="text-sm font-mono font-bold text-dark-200">
                                                    v{updateInfo?.currentVersion || '2.0.11'}
                                                </span>
                                            </div>

                                            <div className="flex items-center gap-2 text-primary font-bold">
                                                <ArrowRight className="w-4 h-4" />
                                            </div>

                                            <div className="flex flex-col text-right">
                                                <span className="text-[11px] text-emerald-400 font-sans font-semibold">New Version</span>
                                                <span className="text-sm font-mono font-bold text-emerald-300">
                                                    v{updateInfo?.version || '2.0.12'}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="bg-dark-950/50 border border-dark-800/80 rounded-xl p-4 flex flex-col gap-2">
                                            <div className="flex items-center gap-2 text-xs font-semibold text-dark-200">
                                                <ShieldCheck className="w-4 h-4 text-primary" />
                                                <span>What's included in this release:</span>
                                            </div>
                                            <ul className="text-xs text-dark-300 space-y-1.5 list-disc list-inside">
                                                <li>Enhanced performance & background math engine</li>
                                                <li>Full-lifecycle interactive update manager</li>
                                                <li>Improved license & account synchronization</li>
                                                <li>Bug fixes and overall stability improvements</li>
                                            </ul>
                                        </div>
                                    </>
                                )}

                                {/* ── STAGE 2: DOWNLOADING ── */}
                                {updateState === 'downloading' && (
                                    <div className="flex flex-col gap-4 py-2">
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="font-semibold text-white">Downloading update package...</span>
                                            <span className="font-mono font-bold text-primary text-sm">{progress.percent}%</span>
                                        </div>

                                        {/* Progress Bar */}
                                        <div className="w-full bg-dark-950 h-3 rounded-full overflow-hidden border border-dark-800 p-0.5">
                                            <motion.div
                                                initial={{ width: 0 }}
                                                animate={{ width: `${progress.percent}%` }}
                                                transition={{ duration: 0.3, ease: "easeOut" }}
                                                className="h-full bg-gradient-to-r from-cyan-500 to-primary rounded-full shadow-[0_0_12px_rgba(6,182,212,0.8)]"
                                            />
                                        </div>

                                        {/* Telemetry info */}
                                        <div className="flex items-center justify-between text-[11px] text-dark-400 font-mono">
                                            <span>
                                                {progress.total > 0 ? `${formatBytes(progress.transferred)} / ${formatBytes(progress.total)}` : 'Fetching package...'}
                                            </span>
                                            <span>
                                                {formatSpeed(progress.bytesPerSecond)}
                                            </span>
                                        </div>
                                    </div>
                                )}

                                {/* ── STAGE 3: READY TO INSTALL ── */}
                                {updateState === 'ready' && (
                                    <div className="flex flex-col gap-4 py-2 text-center">
                                        <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.25)]">
                                            <CheckCircle2 className="w-8 h-8" />
                                        </div>
                                        <div>
                                            <h4 className="text-base font-bold text-white mb-1">
                                                Update Downloaded Successfully
                                            </h4>
                                            <p className="text-xs text-dark-300 max-w-sm mx-auto leading-relaxed">
                                                Restart the application now to finalize and launch <strong>v{updateInfo?.version || '2.0.12'}</strong>. All your active projects and licenses are saved safely.
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {/* ── STAGE 4: INSTALLING ── */}
                                {updateState === 'installing' && (
                                    <div className="flex flex-col items-center justify-center py-6 gap-4">
                                        <RefreshCw className="w-10 h-10 text-primary animate-spin" />
                                        <p className="text-sm font-medium text-white">
                                            Applying update and restarting Parcel Tools...
                                        </p>
                                    </div>
                                )}

                                {/* ── STAGE 5: ERROR ── */}
                                {updateState === 'error' && (
                                    <div className="flex flex-col gap-3 p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl">
                                        <p className="text-xs text-rose-300 leading-relaxed">
                                            {errorMessage || 'Could not download the update. Please check your internet connection.'}
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Footer Actions */}
                            {updateState !== 'installing' && (
                                <div className="p-4 bg-dark-950/70 border-t border-dark-800 flex items-center justify-end gap-3">
                                    {updateState === 'available' && (
                                        <>
                                            <button
                                                onClick={handleDismissPermanently}
                                                className="px-4 py-2 text-xs font-semibold text-dark-400 hover:text-white transition-colors"
                                            >
                                                Don't Show Again
                                            </button>
                                            <button
                                                onClick={() => setIsMinimized(true)}
                                                className="px-4 py-2 text-xs font-semibold text-dark-300 hover:text-white bg-dark-800 hover:bg-dark-700 rounded-xl transition-colors"
                                            >
                                                Remind Me Later
                                            </button>
                                            <button
                                                onClick={handleStartDownload}
                                                className="px-5 py-2.5 bg-gradient-to-r from-primary to-cyan-500 hover:from-primary/90 hover:to-cyan-400 text-dark-950 font-bold text-xs rounded-xl shadow-lg shadow-cyan-950/50 flex items-center gap-2 transition-all transform active:scale-95"
                                            >
                                                <Download className="w-4 h-4" />
                                                <span>Download & Install</span>
                                            </button>
                                        </>
                                    )}

                                    {updateState === 'downloading' && (
                                        <button
                                            onClick={() => setIsMinimized(true)}
                                            className="px-4 py-2 text-xs font-semibold text-dark-300 hover:text-white bg-dark-800 hover:bg-dark-700 rounded-xl transition-colors"
                                        >
                                            Run in Background
                                        </button>
                                    )}

                                    {updateState === 'ready' && (
                                        <>
                                            <button
                                                onClick={() => setUpdateState(null)}
                                                className="px-4 py-2 text-xs font-semibold text-dark-400 hover:text-white transition-colors"
                                            >
                                                Install on Next Launch
                                            </button>
                                            <button
                                                onClick={handleRestartAndInstall}
                                                className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-green-400 hover:from-emerald-400 hover:to-green-300 text-dark-950 font-extrabold text-xs rounded-xl shadow-lg shadow-emerald-950/50 flex items-center gap-2 transition-all transform active:scale-95 animate-pulse"
                                            >
                                                <RefreshCw className="w-4 h-4" />
                                                <span>Restart & Update Now</span>
                                            </button>
                                        </>
                                    )}

                                    {updateState === 'error' && (
                                        <>
                                            <button
                                                onClick={() => setUpdateState(null)}
                                                className="px-4 py-2 text-xs font-semibold text-dark-400 hover:text-white transition-colors"
                                            >
                                                Dismiss
                                            </button>
                                            <button
                                                onClick={handleStartDownload}
                                                className="px-4 py-2 bg-dark-800 hover:bg-dark-700 text-white font-semibold text-xs rounded-xl transition-colors"
                                            >
                                                Retry Download
                                            </button>
                                        </>
                                    )}
                                </div>
                            )}
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </>
    );
}
