import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, AlertCircle, Loader, CheckCircle, ArrowLeft, Send } from 'lucide-react';

const ForgotPasswordPage = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState(() => localStorage.getItem('saved_email') || '');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('http://127.0.0.1:5000/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSent(true);
      } else {
        setError(data.error || 'Could not send reset email. Please try again.');
      }
    } catch {
      setError('Connection error. Make sure the app engine is running.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container relative">
      <div className="flex-1 overflow-y-auto scroll-area flex flex-col items-center p-3 sm:p-6 md:p-8 z-10">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-sm sm:max-w-md my-auto py-4 sm:py-6 px-2 sm:px-4"
        >
          <div className="text-center mb-7">
            <h1 className="text-3xl font-bold">
              <span className="gradient-text">Reset password</span>
            </h1>
            <p className="text-dark-400 text-sm mt-1">
              Enter your email and we'll send you a reset link
            </p>
          </div>

          <div className="glass rounded-2xl shadow-glass p-7">
            {sent ? (
              <div className="text-center space-y-4">
                <CheckCircle className="w-10 h-10 text-green-400 mx-auto" />
                <p className="text-dark-200 text-sm">
                  If an account exists for <strong>{email}</strong>, a password reset link
                  has been sent. Check your inbox (and spam folder).
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="bg-red-900/30 border border-red-700/60 rounded-xl p-3 flex items-start gap-2.5"
                    >
                      <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                      <p className="text-red-300 text-sm">{error}</p>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div>
                  <label className="block text-sm font-medium text-dark-200 mb-1.5">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="input-field pl-10 text-sm"
                      placeholder="your.email@example.com"
                      required
                      disabled={loading}
                      autoFocus
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary w-full py-3 text-sm font-semibold
                             bg-gradient-to-r from-primary-700 to-primary-600
                             hover:from-primary-600 hover:to-primary-500 shadow-glow"
                >
                  {loading ? (
                    <><Loader className="w-4 h-4 animate-spin" /> Sending…</>
                  ) : (
                    <><Send className="w-4 h-4" /> Send Reset Link</>
                  )}
                </button>
              </form>
            )}

            <button
              onClick={() => navigate('/login')}
              className="btn-secondary w-full text-sm mt-5 flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Sign In
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
