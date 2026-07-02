import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { LogIn, Mail, Lock, AlertCircle, Loader, Eye, EyeOff, Shield } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const LoginPage = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState(() => localStorage.getItem('saved_email') || '');
  const [password, setPassword] = useState(() => localStorage.getItem('saved_password') || '');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => {
    return localStorage.getItem('remember_me') !== 'false';
  });

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (rememberMe) {
          localStorage.setItem('saved_email', email);
          localStorage.setItem('saved_password', password);
          localStorage.setItem('remember_me', 'true');
        } else {
          localStorage.removeItem('saved_email');
          localStorage.removeItem('saved_password');
          localStorage.setItem('remember_me', 'false');
        }
        login(
          data.userId,
          data.email,
          data.licenseKey,
          data.sessionToken,
          data.accountType || 'premium',
          data.isAdmin || false
        );
        navigate('/');
      } else if (data.code === 'MACHINE_MISMATCH') {
        setError(
          `This account is registered on a different computer. ` +
          `Contact support with your Machine ID: ${data.machineId || 'N/A'}`
        );
      } else if (data.code === 'ACCOUNT_DISABLED') {
        setError('Your account has been disabled. Please contact support.');
      } else {
        setError(data.error || 'Login failed. Please check your credentials.');
      }
    } catch {
      setError('Connection error. Make sure the app engine is running.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container relative">
      {/* ── Animated background blobs ──────────────────────── */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-5%] w-96 h-96 bg-primary/10 rounded-full
                        blur-3xl animate-blob" />
        <div className="absolute top-[-5%] right-[-5%] w-80 h-80 bg-accent/10 rounded-full
                        blur-3xl animate-blob animation-delay-2000" />
        <div className="absolute bottom-[-10%] left-[20%] w-80 h-80 bg-success/8 rounded-full
                        blur-3xl animate-blob animation-delay-4000" />
        {/* Grid overlay */}
        <div className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage: 'linear-gradient(#58a6ff 1px, transparent 1px), linear-gradient(90deg, #58a6ff 1px, transparent 1px)',
            backgroundSize: '48px 48px'
          }}
        />
      </div>

      {/* ── Scrollable Wrapper ─────────────────────────────── */}
      <div className="flex-1 overflow-y-auto scroll-area flex flex-col items-center p-3 sm:p-6 md:p-8 z-10">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-sm sm:max-w-md my-auto py-4 sm:py-6 px-2 sm:px-4"
        >
        {/* Logo */}
        <div className="text-center mb-7">
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 240, damping: 20, delay: 0.1 }}
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl
                       bg-gradient-to-br from-primary to-primary-dark shadow-glow mb-4"
          >
            <span className="text-3xl">📐</span>
          </motion.div>
          <motion.h1
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-3xl font-bold"
          >
            <span className="gradient-text">Welcome back</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-dark-400 text-sm mt-1"
          >
            Sign in to continue to <strong className="text-dark-200">Parcel Tools</strong>
          </motion.p>
        </div>

        {/* Form card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          className="glass rounded-2xl shadow-glass p-7"
        >
          <form onSubmit={handleLogin} className="space-y-5">
            {/* Error */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-red-900/30 border border-red-700/60 rounded-xl p-3
                             flex items-start gap-2.5"
                >
                  <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-red-300 text-sm">{error}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Email */}
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

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-dark-200 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-field pl-10 pr-10 text-sm"
                  placeholder="Enter your password"
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-dark-400
                             hover:text-primary transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Remember me */}
            <label className="flex items-center gap-2 cursor-pointer select-none w-fit">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border-dark-600 bg-dark-700 text-primary
                           focus:ring-2 focus:ring-primary/40 cursor-pointer"
              />
              <span className="text-sm text-dark-300 hover:text-dark-100 transition-colors">
                Remember me
              </span>
            </label>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-3 text-sm font-semibold
                         bg-gradient-to-r from-primary-700 to-primary-600
                         hover:from-primary-600 hover:to-primary-500
                         shadow-glow"
            >
              {loading ? (
                <><Loader className="w-4 h-4 animate-spin" /> Signing in…</>
              ) : (
                <><LogIn className="w-4 h-4" /> Sign In</>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-dark-700" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-3 bg-dark-800/80 text-dark-500">New to Parcel Tools?</span>
            </div>
          </div>

          <button
            onClick={() => navigate('/signup')}
            className="btn-secondary w-full text-sm"
          >
            Create Account
          </button>
        </motion.div>

        {/* Footer hint */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="text-center text-xs text-dark-500 mt-5 flex items-center justify-center gap-1.5"
        >
          <Shield className="w-3 h-3" />
          Need a license key?{' '}
          <a
            href="https://sayegh8.gumroad.com/l/uaupi"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:text-primary-light transition-colors font-semibold"
          >
            Purchase on Gumroad →
          </a>
        </motion.p>
      </motion.div>
      </div>
    </div>
  );
};

export default LoginPage;
