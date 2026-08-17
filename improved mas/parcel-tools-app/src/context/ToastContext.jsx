import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X, Sparkles, ArrowRight } from 'lucide-react';

const ToastContext = createContext();

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within ToastProvider');
    }
    return context;
};

export const ToastProvider = ({ children }) => {
    const [toasts, setToasts] = useState([]);

    const removeToast = useCallback((id) => {
        setToasts(prev => prev.filter(toast => toast.id !== id));
    }, []);

    const showToast = useCallback((message, type = 'info', duration = 4000, meta = null) => {
        const id = Date.now() + Math.random();
        const toastItem = {
            id,
            message,
            type,
            duration,
            meta,
            createdAt: Date.now()
        };

        setToasts(prev => [...prev, toastItem]);

        if (duration > 0) {
            setTimeout(() => {
                removeToast(id);
            }, duration);
        }
        return id;
    }, [removeToast]);

    const success = useCallback((message, duration = 4000, meta = null) => showToast(message, 'success', duration, meta), [showToast]);
    const error = useCallback((message, duration = 5000, meta = null) => showToast(message, 'error', duration, meta), [showToast]);
    const info = useCallback((message, duration = 3500, meta = null) => showToast(message, 'info', duration, meta), [showToast]);
    const warning = useCallback((message, duration = 4500, meta = null) => showToast(message, 'warning', duration, meta), [showToast]);

    // Dedicated Task Completion / Update Notification Banner
    const completed = useCallback(({ title, message, details = [], duration = 5000, badge = 'Completed' }) => {
        return showToast(title || 'Task Completed Successfully', 'completed', duration, {
            subtitle: message,
            details,
            badge
        });
    }, [showToast]);

    return (
        <ToastContext.Provider value={{ showToast, success, error, info, warning, completed, removeToast }}>
            {children}
            <ToastContainer toasts={toasts} onRemove={removeToast} />
        </ToastContext.Provider>
    );
};

const ToastContainer = ({ toasts, onRemove }) => {
    return (
        <div className="fixed top-4 right-4 z-[99999] flex flex-col gap-2.5 pointer-events-none max-w-md w-full px-3">
            <AnimatePresence mode="popLayout">
                {toasts.map(toast => (
                    <Toast key={toast.id} toast={toast} onRemove={onRemove} />
                ))}
            </AnimatePresence>
        </div>
    );
};

const Toast = ({ toast, onRemove }) => {
    const isCompleted = toast.type === 'completed';

    const icons = {
        success: <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />,
        completed: <Sparkles className="w-5 h-5 text-yellow-400 flex-shrink-0 animate-pulse" />,
        error: <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0" />,
        warning: <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />,
        info: <Info className="w-5 h-5 text-cyan-400 flex-shrink-0" />
    };

    const containerStyles = {
        success: 'bg-dark-900/95 border-emerald-500/40 text-white shadow-emerald-950/40',
        completed: 'bg-gradient-to-r from-dark-900/98 via-dark-850/98 to-dark-900/98 border-yellow-500/50 text-white shadow-yellow-950/50 ring-1 ring-yellow-500/30',
        error: 'bg-dark-900/95 border-rose-500/40 text-white shadow-rose-950/40',
        warning: 'bg-dark-900/95 border-amber-500/40 text-white shadow-amber-950/40',
        info: 'bg-dark-900/95 border-cyan-500/40 text-white shadow-cyan-950/40'
    };

    const progressColors = {
        success: 'bg-emerald-500',
        completed: 'bg-gradient-to-r from-yellow-500 to-amber-400',
        error: 'bg-rose-500',
        warning: 'bg-amber-500',
        info: 'bg-cyan-500'
    };

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: -20, scale: 0.95, filter: 'blur(4px)' }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, scale: 0.9, x: 80, transition: { duration: 0.2 } }}
            transition={{ type: "spring", stiffness: 450, damping: 28 }}
            className={`border rounded-xl shadow-2xl backdrop-blur-2xl p-4 flex flex-col gap-2 relative overflow-hidden pointer-events-auto ${containerStyles[toast.type] || containerStyles.info}`}
        >
            {/* Main Header & Message */}
            <div className="flex items-start gap-3">
                <div className="mt-0.5">{icons[toast.type] || icons.info}</div>

                <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                    <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold font-sans tracking-wide text-white">
                            {toast.message}
                        </span>
                        {toast.meta?.badge && (
                            <span className="text-[9px] uppercase font-mono font-bold bg-yellow-500/20 text-yellow-300 border border-yellow-500/30 px-1.5 py-0.2 rounded">
                                {toast.meta.badge}
                            </span>
                        )}
                    </div>

                    {toast.meta?.subtitle && (
                        <p className="text-[11px] text-dark-300 font-sans leading-relaxed">
                            {toast.meta.subtitle}
                        </p>
                    )}
                </div>

                <button
                    onClick={() => onRemove(toast.id)}
                    className="text-dark-400 hover:text-white transition-colors p-1 hover:bg-dark-800/60 rounded-lg -mr-1 -mt-1 flex-shrink-0"
                    title="Dismiss"
                >
                    <X className="w-3.5 h-3.5" />
                </button>
            </div>

            {/* Structured details / pill chips if provided */}
            {toast.meta?.details && Array.isArray(toast.meta.details) && toast.meta.details.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-1.5 border-t border-dark-800/80 font-mono text-[10px]">
                    {toast.meta.details.map((detail, idx) => (
                        <span 
                            key={idx} 
                            className="bg-dark-950/80 border border-dark-700 text-dark-200 px-2 py-0.5 rounded flex items-center gap-1"
                        >
                            {detail.label && <span className="text-dark-400 font-sans">{detail.label}:</span>}
                            <strong className="text-white font-medium">{detail.value || detail}</strong>
                        </span>
                    ))}
                </div>
            )}

            {/* Dynamic Progress/Timer bar */}
            {toast.duration > 0 && (
                <motion.div
                    initial={{ width: '100%' }}
                    animate={{ width: '0%' }}
                    transition={{ duration: toast.duration / 1000, ease: 'linear' }}
                    className={`absolute bottom-0 left-0 h-[2.5px] ${progressColors[toast.type] || progressColors.info}`}
                />
            )}
        </motion.div>
    );
};

export default ToastProvider;

