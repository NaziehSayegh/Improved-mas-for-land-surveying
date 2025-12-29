import React, { createContext, useContext, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';

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

    const showToast = useCallback((message, type = 'info', duration = 3000) => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message, type, duration }]);

        if (duration > 0) {
            setTimeout(() => {
                removeToast(id);
            }, duration);
        }
    }, []);

    const removeToast = useCallback((id) => {
        setToasts(prev => prev.filter(toast => toast.id !== id));
    }, []);

    const success = useCallback((message, duration) => showToast(message, 'success', duration), [showToast]);
    const error = useCallback((message, duration) => showToast(message, 'error', duration), [showToast]);
    const info = useCallback((message, duration) => showToast(message, 'info', duration), [showToast]);
    const warning = useCallback((message, duration) => showToast(message, 'warning', duration), [showToast]);

    return (
        <ToastContext.Provider value={{ showToast, success, error, info, warning }}>
            {children}
            <ToastContainer toasts={toasts} onRemove={removeToast} />
        </ToastContext.Provider>
    );
};

const ToastContainer = ({ toasts, onRemove }) => {
    return (
        <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
            <AnimatePresence>
                {toasts.map(toast => (
                    <Toast key={toast.id} toast={toast} onRemove={onRemove} />
                ))}
            </AnimatePresence>
        </div>
    );
};

const Toast = ({ toast, onRemove }) => {
    const icons = {
        success: <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />,
        error: <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />,
        warning: <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0" />,
        info: <Info className="w-5 h-5 text-blue-400 flex-shrink-0" />
    };

    const backgrounds = {
        success: 'bg-green-600/90',
        error: 'bg-red-600/90',
        warning: 'bg-yellow-600/90',
        info: 'bg-blue-600/90'
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: -20, x: 100 }}
            animate={{ opacity: 1, y: 0, x: 0 }}
            exit={{ opacity: 0, x: 100 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
            className={`${backgrounds[toast.type]} backdrop-blur-xl text-white px-4 py-3 rounded-xl shadow-2xl flex items-start gap-3 max-w-md pointer-events-auto`}
        >
            {icons[toast.type]}
            <p className="text-sm font-medium flex-1 whitespace-pre-line">{toast.message}</p>
            <button
                onClick={() => onRemove(toast.id)}
                className="text-white/80 hover:text-white transition-colors flex-shrink-0"
            >
                <X className="w-4 h-4" />
            </button>
        </motion.div>
    );
};

export default ToastProvider;
