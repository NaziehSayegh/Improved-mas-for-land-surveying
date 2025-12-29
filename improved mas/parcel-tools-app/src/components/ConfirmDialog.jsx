import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, CheckCircle, Info, X } from 'lucide-react';

const ConfirmDialog = ({ isOpen, onClose, onConfirm, title, message, type = 'warning', confirmText = 'Confirm', cancelText = 'Cancel' }) => {
    const handleConfirm = () => {
        onConfirm();
        onClose();
    };

    const handleCancel = () => {
        onClose();
    };

    const icons = {
        warning: <AlertCircle className="w-12 h-12 text-yellow-400" />,
        danger: <AlertCircle className="w-12 h-12 text-red-400" />,
        info: <Info className="w-12 h-12 text-blue-400" />,
        success: <CheckCircle className="w-12 h-12 text-green-400" />
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={handleCancel}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                    >
                        {/* Dialog */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            transition={{ type: "spring", duration: 0.3 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-dark-800 border border-dark-600 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
                        >
                            {/* Close Button */}
                            <button
                                onClick={handleCancel}
                                className="absolute top-4 right-4 text-dark-400 hover:text-dark-100 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>

                            {/* Content */}
                            <div className="p-6">
                                {/* Icon */}
                                <div className="flex justify-center mb-4">
                                    {icons[type]}
                                </div>

                                {/* Title */}
                                <h3 className="text-xl font-bold text-dark-100 text-center mb-2">
                                    {title}
                                </h3>

                                {/* Message */}
                                <p className="text-dark-300 text-center mb-6">
                                    {message}
                                </p>

                                {/* Buttons */}
                                <div className="flex gap-3">
                                    <button
                                        onClick={handleCancel}
                                        className="flex-1 px-4 py-2.5 bg-dark-700 hover:bg-dark-600 border border-dark-600 text-dark-100 font-semibold rounded-xl transition-all"
                                    >
                                        {cancelText}
                                    </button>
                                    <button
                                        onClick={handleConfirm}
                                        className={`flex-1 px-4 py-2.5 font-semibold rounded-xl transition-all ${type === 'danger'
                                                ? 'bg-red-600 hover:bg-red-700 text-white'
                                                : 'bg-primary hover:bg-primary-dark text-white'
                                            }`}
                                    >
                                        {confirmText}
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

export default ConfirmDialog;
