# 💳 Payment Integration Setup Guide

This guide will help you set up payment processing for Parcel Tools license sales.

---

## 📋 Table of Contents

1. [Payment Processor Options](#payment-processor-options)
2. [Setup Instructions](#setup-instructions)
3. [License Key Generation](#license-key-generation)
4. [Testing the System](#testing-the-system)
5. [Going Live](#going-live)

---

## 💰 Payment Processor Options

### Option 1: Gumroad (Easiest - Recommended for Beginners)

**Pros:**
- ✅ No coding required
- ✅ Handles payments, taxes, VAT automatically
- ✅ Built-in license key delivery via email
- ✅ Takes ~10 minutes to setup

**Cons:**
- ❌ 10% fee + payment processing
- ❌ Less customization

**Best for:** Solo developers, quick launch

### Option 2: LemonSqueezy (Merchant of Record)

**Pros:**
- ✅ Handles all taxes and compliance
- ✅ Webhooks for automation
- ✅ Lower fees (5% + payment processing)
- ✅ Good dashboard

**Cons:**
- ❌ Slightly more setup than Gumroad
- ❌ Requires webhook integration

**Best for:** Professional products, international sales

### Option 3: Stripe (Most Control)

**Pros:**
- ✅ Lowest fees (2.9% + $0.30)
- ✅ Full customization
- ✅ Powerful API & webhooks
- ✅ Payment links (no coding needed)

**Cons:**
- ❌ You handle taxes (use Stripe Tax)
- ❌ More setup required
- ❌ Need to generate license keys yourself

**Best for:** Developers who want full control

### Option 4: PayPal

**Pros:**
- ✅ Widely trusted
- ✅ Easy to setup
- ✅ Good for international customers

**Cons:**
- ❌ ~3-4% fees
- ❌ Manual license key delivery
- ❌ No automated webhooks (without code)

**Best for:** Additional payment option alongside main processor

---

## 🚀 Setup Instructions

### Option 1: Gumroad Setup (Recommended First)

#### Step 1: Create Product

1. Go to https://gumroad.com and sign up
2. Click "New Product" → "Digital Product"
3. Fill in:
   - **Product Name:** Parcel Tools - Professional Surveying Software
   - **Price:** $29.99 (or your price)
   - **Description:** Copy from `buy.html`
   - **Product File:** Upload a text file with instructions

#### Step 2: Setup License Keys

1. In product settings, go to "License Keys"
2. Enable "Generate unique license keys"
3. Set format: `XXXX-XXXX-XXXX-XXXX` (16 characters)
4. Enable "Send license key in purchase email"

#### Step 3: Customize Email

Go to "Email to customers" and customize:

```
🎉 Thank you for purchasing Parcel Tools!

Your License Information:
━━━━━━━━━━━━━━━━━━━━━━━━━

📧 Email: {buyer_email}
🔑 License Key: {license_key}

━━━━━━━━━━━━━━━━━━━━━━━━━

How to Activate:
1. Open Parcel Tools app
2. Go to "License" from main menu
3. Enter your email and license key
4. Click "Activate License"

✅ Your license is now activated for lifetime use!

Need Help?
Email: support@yourdomain.com

Download latest version:
https://yourdomain.com

Thank you for your purchase! 🚀
```

#### Step 4: Get Payment Link

1. Click "Share" on your product
2. Copy the Gumroad link (e.g., `https://yourusername.gumroad.com/l/parcel-tools`)
3. Update `buy.html` with this link

#### Step 5: Update License Validation

Since Gumroad generates random keys, you need to either:

**A) Store valid keys in a database/file:**

Create `backend/valid_licenses.txt`:
```
customer1@email.com:XXXX-XXXX-XXXX-XXXX
customer2@email.com:YYYY-YYYY-YYYY-YYYY
```

Update `license_manager.py`:
```python
def validate_license_key(self, license_key, email):
    # Read from valid_licenses.txt
    valid_file = os.path.join(self.data_dir, '../valid_licenses.txt')
    if not os.path.exists(valid_file):
        return False
    
    with open(valid_file, 'r') as f:
        for line in f:
            stored_email, stored_key = line.strip().split(':')
            if email.lower() == stored_email.lower() and license_key.upper() == stored_key.upper():
                return True
    return False
```

**B) Or use Gumroad API to verify (advanced)**

---

### Option 2: LemonSqueezy Setup

#### Step 1: Create Account & Product

1. Go to https://lemonsqueezy.com and sign up
2. Create a store
3. Add new product → Digital Download
4. Set price: $29.99
5. Add description and images

#### Step 2: Setup Webhooks

1. Go to Settings → Webhooks
2. Add endpoint: `https://yourdomain.com/webhook/lemonsqueezy`
3. Subscribe to: `order_created`
4. Save webhook secret

#### Step 3: Create Webhook Handler

Create `backend/webhook_handler.py`:

```python
from flask import request
import hmac
import hashlib

LEMONSQUEEZY_SECRET = "your_webhook_secret"

@app.route('/webhook/lemonsqueezy', methods=['POST'])
def lemonsqueezy_webhook():
    # Verify signature
    signature = request.headers.get('X-Signature')
    body = request.get_data()
    
    expected = hmac.new(
        LEMONSQUEEZY_SECRET.encode(),
        body,
        hashlib.sha256
    ).hexdigest()
    
    if signature != expected:
        return 'Invalid signature', 401
    
    data = request.json
    
    if data['meta']['event_name'] == 'order_created':
        email = data['data']['attributes']['user_email']
        
        # Generate license key
        license_key = license_manager.generate_license_key(email)
        
        # Save to database
        save_license(email, license_key)
        
        # Send email with license key
        send_license_email(email, license_key)
    
    return 'OK', 200
```

#### Step 4: Update buy.html

```javascript
function buyWithStripe() {
    window.location.href = 'https://youraccount.lemonsqueezy.com/checkout/buy/YOUR_PRODUCT_ID';
}
```

---

### Option 3: Stripe Setup (Payment Links)

#### Step 1: Create Stripe Account

1. Go to https://stripe.com and sign up
2. Complete account verification
3. Enable Stripe Tax (handles tax calculation)

#### Step 2: Create Payment Link

1. Go to "Payment Links" in Stripe Dashboard
2. Click "New Payment Link"
3. Fill in:
   - **Name:** Parcel Tools License
   - **Price:** $29.99 USD
   - **Type:** One-time
4. Enable "Collect customer email"
5. Add custom field for "License Email"
6. Save and copy the payment link

#### Step 3: Setup Webhooks (Optional but Recommended)

1. Go to Developers → Webhooks
2. Add endpoint: `https://yourdomain.com/webhook/stripe`
3. Select events:
   - `checkout.session.completed`
   - `payment_intent.succeeded`

Create webhook handler in `backend/app.py`:

```python
import stripe

stripe.api_key = "sk_test_YOUR_KEY"  # Use live key in production
STRIPE_WEBHOOK_SECRET = "whsec_YOUR_SECRET"

@app.route('/webhook/stripe', methods=['POST'])
def stripe_webhook():
    payload = request.data
    sig_header = request.headers.get('Stripe-Signature')
    
    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, STRIPE_WEBHOOK_SECRET
        )
    except Exception as e:
        return 'Invalid signature', 400
    
    if event['type'] == 'checkout.session.completed':
        session = event['data']['object']
        email = session['customer_email']
        
        # Generate license
        license_key = license_manager.generate_license_key(email)
        
        # Save to database
        save_license(email, license_key)
        
        # Send email
        send_license_email(email, license_key)
    
    return 'OK', 200
```

#### Step 4: Update buy.html

```javascript
function buyWithStripe() {
    window.location.href = 'https://buy.stripe.com/YOUR_PAYMENT_LINK_ID';
}
```

---

## 🔑 License Key Generation

### Current System

The app uses HMAC-SHA256 to generate license keys from email addresses.

**File:** `backend/license_manager.py`

```python
def generate_license_key(self, email):
    message = f"{email.lower()}|parceltools|2024"
    signature = hmac.new(
        LICENSE_SECRET.encode(),
        message.encode(),
        hashlib.sha256
    ).digest()
    
    key_hex = signature[:8].hex().upper()
    formatted = '-'.join([
        key_hex[0:4],
        key_hex[4:8],
        key_hex[8:12],
        key_hex[12:16]
    ])
    
    return formatted  # Format: XXXX-XXXX-XXXX-XXXX
```

### Important Security Steps:

1. **Change the LICENSE_SECRET** in `license_manager.py`:
   ```python
   LICENSE_SECRET = "YOUR_UNIQUE_SECRET_HERE_CHANGE_THIS_123456"
   ```
   Use a random string generator: https://www.random.org/strings/

2. **Keep it private!** Never commit the secret to GitHub

3. **Test generation:**
   ```bash
   cd backend
   python license_manager.py
   ```

### Manual License Generation

Create `backend/generate_key.py`:

```python
from license_manager import generate_key_for_email

if __name__ == '__main__':
    email = input("Enter customer email: ")
    key = generate_key_for_email(email)
    print(f"\n✅ License Key for {email}:")
    print(f"🔑 {key}\n")
```

Run it:
```bash
python generate_key.py
```

---

## 🧪 Testing the System

### Step 1: Generate Test License

```bash
cd "improved mas/parcel-tools-app/backend"
python license_manager.py
```

This outputs a test email and license key.

### Step 2: Test in App

1. Start the app:
   ```bash
   cd "improved mas/parcel-tools-app"
   npm run electron:dev
   ```

2. Open the app
3. Navigate to License page
4. Enter test email and key
5. Click "Activate"

Should show: ✅ "License activated successfully!"

### Step 3: Test Trial Mode

1. Delete license file:
   - Windows: `%LOCALAPPDATA%\ParcelTools\data\license.json`
2. Restart app
3. Should show "Start Trial" option
4. Click "Start 7-Day Trial"

### Step 4: Test Expiration

1. Edit trial license file and change date to 8 days ago
2. Restart app
3. Should show "Trial Expired" dialog

---

## 🚀 Going Live

### Checklist Before Launch:

- [ ] Changed `LICENSE_SECRET` in `license_manager.py`
- [ ] Set up payment processor (Gumroad/Stripe/LemonSqueezy)
- [ ] Updated payment links in `buy.html`
- [ ] Tested license activation with real payment
- [ ] Set up email for license delivery
- [ ] Created support email (support@yourdomain.com)
- [ ] Uploaded `buy.html` to your website
- [ ] Updated download links in `index.html`
- [ ] Tested on clean Windows installation

### Update Website Links

In `index.html`, update:

```javascript
const DOWNLOAD_CONFIG = {
    github: 'https://github.com/YOURNAME/parcel-tools/releases/download/v2.0.0/Parcel-Tools-Setup-2.0.0.exe',
    direct: 'YOUR_DIRECT_LINK',
    releases: 'https://github.com/YOURNAME/parcel-tools/releases',
    purchase: 'https://yourdomain.com/buy.html'  // Add this
};
```

In `LicensePage.jsx`, update:

```javascript
const openPurchasePage = () => {
    window.open('https://yourdomain.com/buy.html', '_blank');
};
```

---

## 📧 Email Templates

### Purchase Confirmation Email

```
Subject: Your Parcel Tools License Key 🎉

Hi there!

Thank you for purchasing Parcel Tools!

━━━━━━━━━━━━━━━━━━━━━━━━━
YOUR LICENSE INFORMATION
━━━━━━━━━━━━━━━━━━━━━━━━━

📧 Email: {customer_email}
🔑 License Key: {license_key}

━━━━━━━━━━━━━━━━━━━━━━━━━
ACTIVATION INSTRUCTIONS
━━━━━━━━━━━━━━━━━━━━━━━━━

1. Open Parcel Tools
2. Click "License" from main menu
3. Enter your email and license key
4. Click "Activate License"

That's it! You now have lifetime access.

━━━━━━━━━━━━━━━━━━━━━━━━━

📥 Download: https://yourdomain.com
📖 Documentation: https://yourdomain.com/docs
💬 Support: support@yourdomain.com

Thank you for your business! 🚀

Best regards,
The Parcel Tools Team
```

---

## 🎯 Recommended Approach

**For Quick Start (Today):**
1. Use **Gumroad** - Setup in 10 minutes
2. Manually copy-paste license keys to customers
3. Store valid keys in `valid_licenses.txt`

**For Professional Setup (This Week):**
1. Use **Stripe Payment Links** for lowest fees
2. Set up webhook to auto-generate keys
3. Use email service (SendGrid/Mailgun) for delivery

**For Full Automation (Later):**
1. Build admin dashboard
2. Database for license tracking
3. API for license verification
4. Customer portal for downloads

---

## 🆘 Support

If you need help:

1. **Gumroad Issues:** help@gumroad.com
2. **Stripe Issues:** https://support.stripe.com
3. **LemonSqueezy Issues:** hello@lemonsqueezy.com
4. **Code Issues:** Check logs in `%LOCALAPPDATA%\ParcelTools\`

---

## 🔒 Security Best Practices

1. ✅ Always use HTTPS for payment pages
2. ✅ Never commit `LICENSE_SECRET` to git
3. ✅ Validate webhook signatures
4. ✅ Store sensitive data in environment variables
5. ✅ Rate-limit license activation API
6. ✅ Log all activation attempts
7. ✅ Set up fraud monitoring

---

## 💡 Tips

- **Pricing:** $19-39 is typical for desktop tools
- **Trial:** 7-14 days is optimal
- **Refunds:** 30-day guarantee builds trust
- **Support:** Respond within 24 hours
- **Marketing:** Share on Reddit, ProductHunt, Twitter
- **Updates:** Release updates regularly (monthly)

---

## 📊 Analytics

Track these metrics:

- Trial-to-paid conversion rate
- Average time to purchase
- Refund rate
- Customer support tickets
- Most common issues

**Goal:** >10% trial-to-paid conversion

---

You're all set! 🚀

Choose your payment processor, follow the setup, and you'll be selling Parcel Tools licenses in no time!

Good luck with your launch! 💪

