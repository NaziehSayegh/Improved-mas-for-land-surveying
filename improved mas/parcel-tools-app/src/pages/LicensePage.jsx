import { useState, useEffect } from 'react';
import {
  Shield,
  Check,
  AlertCircle,
  Clock,
  CreditCard,
  ExternalLink,
  Key,
  Mail,
  Loader
} from 'lucide-react';

export default function LicensePage() {
  const [licenseStatus, setLicenseStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState(false);

  // Form state
  const [email, setEmail] = useState('');
  const [licenseKey, setLicenseKey] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const response = await fetch('http://127.0.0.1:5000/api/license/status');
        const data = await response.json();
        setLicenseStatus(data);
      } catch (err) {
        console.error('Failed to check license status:', err);
        // Keep default "no license" state if check fails
        setLicenseStatus({
          status: 'no_license',
          is_valid: false,
          message: 'Could not connect to license server'
        });
      } finally {
        setLoading(false);
      }
    };

    checkStatus();

    // ESC key to go back
    const handleEscKey = (e) => {
      if (e.key === 'Escape') {
        window.history.back();
      }
    };

    window.addEventListener('keydown', handleEscKey);
    return () => window.removeEventListener('keydown', handleEscKey);
  }, []);

  const handleBuyNow = () => {
    // Open Gumroad directly
    const gumroadUrl = 'https://sayegh8.gumroad.com/l/uaupi';

    if (window.electronAPI && window.electronAPI.openExternal) {
      // In Electron, open in system browser
      window.electronAPI.openExternal(gumroadUrl);
    } else {
      // In browser, open new tab
      window.open(gumroadUrl, '_blank');
    }
  };

  const initializePayPalButtons_DISABLED = () => {
    // PayPal buttons disabled - using simple buy button instead
    if (!window.paypal) return;

    // Common order creation logic
    const createOrderConfig = (data, actions) => {
      return actions.order.create({
        purchase_units: [{
          description: 'Parcel Tools - Lifetime License',
          amount: {
            currency_code: 'USD',
            value: '29.99'
          }
        }]
      });
    };

    // Common success handler
    const onApproveHandler = async (data, actions) => {
      const order = await actions.order.capture();

      // Customer paid! Show success
      const customerEmail = order.payer.email_address;
      const transactionId = order.id;
      const paymentMethod = order.purchase_units[0].payments.captures[0].payment_method_detail || 'PayPal';

      setSuccess(`✅ Payment successful! Check ${customerEmail} for your license key.`);

      // In a real app, your backend would:
      // 1. Verify the payment with PayPal
      // 2. Generate license key
      // 3. Email it to customer

      alert(`🎉 Payment Successful!\n\nTransaction ID: ${transactionId}\nPayment Method: ${paymentMethod}\n\nYour license key will be emailed to:\n${customerEmail}\n\nPlease check your inbox (and spam folder).`);
    };

    // Common error handler
    const onErrorHandler = (err) => {
      setError('Payment failed. Please try again.');
      console.error('Payment error:', err);
    };

    // PayPal Button
    if (document.getElementById('paypal-button-container')) {
      window.paypal.Buttons({
        style: {
          layout: 'vertical',
          color: 'blue',
          shape: 'rect',
          label: 'paypal',
          tagline: false,
          height: 45
        },
        fundingSource: window.paypal.FUNDING.PAYPAL,
        createOrder: createOrderConfig,
        onApprove: onApproveHandler,
        onError: onErrorHandler
      }).render('#paypal-button-container');
    }

    // Credit/Debit Card Button (separate)
    if (document.getElementById('card-button-container')) {
      window.paypal.Buttons({
        style: {
          layout: 'vertical',
          color: 'black',
          shape: 'rect',
          label: 'pay',
          tagline: false,
          height: 45
        },
        fundingSource: window.paypal.FUNDING.CARD,  // Dedicated card button
        createOrder: createOrderConfig,
        onApprove: onApproveHandler,
        onError: onErrorHandler
      }).render('#card-button-container').catch(err => {
        // Card button might not be available in all regions
        console.log('Card button not available:', err);
      });
    }
  };

  // Backend check removed - not needed for purchase flow

  // Trial mode removed - no free trials

  const handleActivateLicense = async (e) => {
    e.preventDefault();

    if (!email || !licenseKey) {
      setError('Please enter both email and license key');
      return;
    }

    try {
      setActivating(true);
      setError('');
      setSuccess('');

      const response = await fetch('http://127.0.0.1:5000/api/license/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          license_key: licenseKey.trim()
        })
      });

      const data = await response.json();

      if (data.success) {
        setSuccess('License activated successfully! 🎉');
        setEmail('');
        setLicenseKey('');
        setLicenseStatus({
          status: 'activated',
          is_valid: true,
          email: email,
          message: 'Licensed version'
        });
      } else {
        setError(data.error || 'Invalid license key or email');
      }
    } catch (err) {
      setError('Activation failed. Please check your internet connection and try again.');
    } finally {
      setActivating(false);
    }
  };

  const handleDeactivate = async () => {
    if (!confirm('Are you sure you want to deactivate this license?')) {
      return;
    }

    try {
      setActivating(true);
      setError('');
      const response = await fetch('http://127.0.0.1:5000/api/license/deactivate', {
        method: 'POST',
      });

      const data = await response.json();

      if (data.success) {
        setSuccess('License deactivated');
        // Update license status to reflect deactivation
        setLicenseStatus({
          status: 'no_license',
          is_valid: false,
          message: 'No active license'
        });
      } else {
        setError(data.error || 'Deactivation failed');
      }
    } catch (err) {
      setError('Deactivation failed: ' + err.message);
    } finally {
      setActivating(false);
    }
  };

  const handlePayPalPayment = () => {
    // PayPal payment will be embedded in the app
    setError('');
    alert('PayPal payment will open below. After payment, you\'ll receive your license key via email.');
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="flex items-center gap-3">
          <Loader className="w-6 h-6 animate-spin text-blue-500" />
          <span className="text-gray-400">Checking license...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Back Button */}
      <button
        onClick={() => window.history.back()}
        className="mb-6 flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Main Menu (ESC)
      </button>

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
          <Shield className="w-8 h-8 text-blue-400" />
          License Management
        </h1>
        <p className="text-gray-400">
          Purchase and activate your Parcel Tools license
        </p>
        <p className="text-sm text-gray-500 mt-2">
          Developed by <span className="text-blue-400 font-semibold">Nazieh Sayegh</span>
        </p>
      </div>

      {/* Current Status Card */}
      <div className="bg-gray-800 rounded-lg p-6 mb-6 border border-gray-700">
        <h2 className="text-xl font-semibold text-white mb-4">Current Status</h2>

        {licenseStatus && (
          <div className="space-y-3">
            {/* Status Badge */}
            <div className="flex items-center gap-3">
              {licenseStatus.status === 'activated' && (
                <>
                  <div className="flex items-center gap-2 px-4 py-2 bg-green-500/20 border border-green-500 rounded-lg">
                    <Check className="w-5 h-5 text-green-400" />
                    <span className="text-green-400 font-semibold">Licensed</span>
                  </div>
                  <span className="text-gray-400">{licenseStatus.email}</span>
                </>
              )}

              {licenseStatus.status === 'trial' && (
                <div className="flex items-center gap-2 px-4 py-2 bg-yellow-500/20 border border-yellow-500 rounded-lg">
                  <Clock className="w-5 h-5 text-yellow-400" />
                  <span className="text-yellow-400 font-semibold">Free Trial ({licenseStatus.days_left} days left)</span>
                </div>
              )}

              {(!licenseStatus.status || licenseStatus.status === 'no_license' || licenseStatus.status === 'expired') && (
                <div className="flex items-center gap-2 px-4 py-2 bg-red-500/20 border border-red-500 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-red-400" />
                  <span className="text-red-400 font-semibold">
                    {licenseStatus.status === 'expired' ? 'Trial Expired' : 'No License'}
                  </span>
                </div>
              )}
            </div>

            <p className="text-gray-400">{licenseStatus.message}</p>

            {licenseStatus.status === 'activated' && licenseStatus.activated_date && (
              <p className="text-sm text-gray-500">
                Activated: {new Date(licenseStatus.activated_date).toLocaleDateString()}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Alerts */}
      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <span className="text-red-400">{error}</span>
        </div>
      )}

      {success && (
        <div className="mb-6 p-4 bg-green-500/10 border border-green-500 rounded-lg flex items-start gap-3">
          <Check className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
          <span className="text-green-400">{success}</span>
        </div>
      )}

      {/* Purchase Card - No Trial! */}
      <div className="mb-6">
        <div className="bg-gradient-to-br from-green-900/20 to-emerald-900/20 rounded-lg p-8 border-2 border-green-600">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-white mb-3 flex items-center justify-center gap-2">
              <CreditCard className="w-7 h-7 text-green-400" />
              Purchase Parcel Tools License
            </h2>
            <div className="mb-4">
              <span className="text-5xl font-bold text-white">$29.99</span>
              <span className="text-gray-400 text-xl ml-2">one-time payment</span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-left max-w-md mx-auto mb-6">
              <div className="flex items-start gap-2">
                <Check className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                <span className="text-gray-300">Lifetime license</span>
              </div>
              <div className="flex items-start gap-2">
                <Check className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                <span className="text-gray-300">All features unlocked</span>
              </div>
              <div className="flex items-start gap-2">
                <Check className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                <span className="text-gray-300">Free updates forever</span>
              </div>
              <div className="flex items-start gap-2">
                <Check className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                <span className="text-gray-300">Priority support</span>
              </div>
            </div>
          </div>

          {/* Big Buy Now Button */}
          <button
            onClick={handleBuyNow}
            className="w-full py-5 px-8 bg-green-600 hover:bg-green-700 text-white text-2xl font-bold rounded-xl transition-all transform hover:scale-105 shadow-2xl flex items-center justify-center gap-3"
          >
            <CreditCard className="w-8 h-8" />
            Buy Now - $29.99
            <ExternalLink className="w-6 h-6" />
          </button>

          <div className="text-center mt-4 space-y-1">
            <p className="text-sm text-gray-400 flex items-center justify-center gap-2">
              <span>💳</span>
              <span>Accepts: PayPal • Visa • Mastercard • Amex • Discover</span>
            </p>
            <p className="text-xs text-gray-500">
              Secure payment • Instant license key delivery via email
            </p>
          </div>
        </div>
      </div>

      {/* Activation Form */}
      <div className="mt-6 bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
          <Key className="w-6 h-6 text-yellow-400" />
          Activate License Key
        </h3>
        <p className="text-gray-400 mb-6">
          Already purchased? Enter your license key below to activate.
        </p>

        <form onSubmit={handleActivateLicense} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              <Mail className="w-4 h-4 inline mr-2" />
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              disabled={activating || licenseStatus?.status === 'activated'}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              <Key className="w-4 h-4 inline mr-2" />
              License Key
            </label>
            <input
              type="text"
              value={licenseKey}
              onChange={(e) => setLicenseKey(e.target.value)}
              placeholder="XXXX-XXXX-XXXX-XXXX"
              className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 font-mono"
              disabled={activating || licenseStatus?.status === 'activated'}
            />
          </div>

          {licenseStatus?.status !== 'activated' && (
            <button
              type="submit"
              disabled={activating || !email || !licenseKey}
              className="w-full px-6 py-3 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {activating ? 'Activating...' : 'Activate License'}
            </button>
          )}
        </form>

        {licenseStatus?.status === 'activated' && (
          <div className="mt-4 pt-4 border-t border-gray-700">
            <button
              onClick={handleDeactivate}
              className="text-red-400 hover:text-red-300 text-sm"
            >
              Deactivate License
            </button>
          </div>
        )}
      </div>

      {/* Help & Support Section */}
      <div className="mt-8 p-6 bg-gradient-to-br from-blue-900/30 to-purple-900/30 border border-blue-500/30 rounded-xl">
        <h3 className="text-xl font-semibold text-white mb-3 flex items-center gap-2">
          <Mail className="w-5 h-5 text-blue-400" />
          Need Help with Your License?
        </h3>
        <div className="space-y-3 text-gray-300">
          <p className="text-sm">
            <strong className="text-white">📧 Email Support:</strong>{' '}
            <a href="mailto:nsayegh2003@gmail.com" className="text-blue-400 hover:text-blue-300 underline">
              nsayegh2003@gmail.com
            </a>
          </p>
          <p className="text-sm">
            <strong className="text-white">💬 Response Time:</strong> Usually within 2-4 hours
          </p>
          <div className="pt-3 border-t border-gray-700">
            <p className="text-xs text-gray-400 mb-2"><strong>Common Issues:</strong></p>
            <ul className="text-xs text-gray-400 space-y-1 list-disc list-inside">
              <li>Lost license key? Email us with your purchase receipt</li>
              <li>Activation problems? Make sure you're connected to the internet</li>
              <li>Payment questions? Contact us with your transaction details</li>
              <li>Refund requests? 30-day money-back guarantee (email us)</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Footer Copyright */}
      <div className="mt-6 text-center text-sm text-gray-500 pb-4">
        <p>© 2024 <strong className="text-blue-400">Nazieh Sayegh</strong>. All rights reserved.</p>
        <p className="text-xs text-gray-600 mt-1">Parcel Tools™ is a trademark of Nazieh Sayegh</p>
      </div>
    </div>
  );
}

