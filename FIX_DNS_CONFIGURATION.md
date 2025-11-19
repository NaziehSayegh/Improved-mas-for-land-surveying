# 🔧 Fix DNS Configuration for parcelstools.com

## The Problem

**Error**: "Domain does not resolve to the GitHub Pages server (NotServedByPagesError)"

**What this means**: Your domain `parcelstools.com` is not pointing to GitHub's servers. The DNS records at your domain registrar need to be updated.

## Solution: Configure DNS Records

You need to add DNS records at **your domain registrar** (where you bought parcelstools.com - could be GoDaddy, Namecheap, Cloudflare, Google Domains, etc.)

---

## 📋 DNS Records You Need to Add

### For Root Domain (parcelstools.com)

Add **4 A records** pointing to GitHub's IP addresses:

```
Type: A
Name: @ (or leave blank, or parcelstools.com)
Value: 185.199.108.153
TTL: 600 (or automatic/default)

Type: A
Name: @ (or leave blank, or parcelstools.com)
Value: 185.199.109.153
TTL: 600

Type: A
Name: @ (or leave blank, or parcelstools.com)
Value: 185.199.110.153
TTL: 600

Type: A
Name: @ (or leave blank, or parcelstools.com)
Value: 185.199.111.153
TTL: 600
```

### For WWW Subdomain (www.parcelstools.com) - Optional

Add **1 CNAME record**:

```
Type: CNAME
Name: www
Value: NaziehSayegh.github.io
TTL: 600 (or automatic/default)
```

---

## 🎯 Step-by-Step Instructions

### Step 1: Find Where You Bought Your Domain

Where did you register `parcelstools.com`? Common registrars:
- GoDaddy
- Namecheap
- Google Domains
- Cloudflare
- Hover
- Domain.com
- Others

### Step 2: Log Into Your Domain Registrar

Go to the website where you bought the domain and log in.

### Step 3: Find DNS Management

Look for one of these options in your account:
- "DNS Management"
- "DNS Settings"
- "Manage DNS"
- "Name Servers"
- "Advanced DNS"
- "DNS Records"

### Step 4: Delete Old Records (if any)

**Important**: Delete any existing A or CNAME records for:
- @ (root)
- parcelstools.com
- www

These might be pointing to old servers or parking pages.

### Step 5: Add New A Records

Add these **4 A records** one by one:

**Record 1:**
- Type: `A`
- Host/Name: `@` (some registrars use blank or `parcelstools.com`)
- Points to/Value: `185.199.108.153`
- TTL: `600` (or leave default)

**Record 2:**
- Type: `A`
- Host/Name: `@`
- Points to/Value: `185.199.109.153`
- TTL: `600`

**Record 3:**
- Type: `A`
- Host/Name: `@`
- Points to/Value: `185.199.110.153`
- TTL: `600`

**Record 4:**
- Type: `A`
- Host/Name: `@`
- Points to/Value: `185.199.111.153`
- TTL: `600`

### Step 6: Add CNAME Record for WWW (Optional)

**Record 5:**
- Type: `CNAME`
- Host/Name: `www`
- Points to/Value: `NaziehSayegh.github.io` (or `NaziehSayegh.github.io.`)
- TTL: `600`

### Step 7: Save Changes

Click **Save** or **Apply Changes** or **Update** button.

---

## ⏱️ How Long Does It Take?

After you save DNS changes:

- **Minimum**: 10-15 minutes
- **Typical**: 1-2 hours
- **Maximum**: 24-48 hours (rare)

This is called "DNS propagation" - it takes time for the changes to spread across the internet.

---

## 🔍 How to Check if DNS is Working

### Option 1: Use Online DNS Checker
Go to: https://www.whatsmydns.net/

- Enter: `parcelstools.com`
- Select: `A` record type
- Click **Search**

**You should see**: `185.199.108.153` (or one of the other GitHub IPs) from multiple locations

### Option 2: Use Command Line

**Windows (PowerShell or CMD)**:
```powershell
nslookup parcelstools.com
```

**Expected output**:
```
Name:    parcelstools.com
Addresses:  185.199.108.153
            185.199.109.153
            185.199.110.153
            185.199.111.153
```

### Option 3: Wait for GitHub to Recognize It

After DNS propagates, go back to:
```
GitHub → Your Repo → Settings → Pages → Custom domain
```

The error should disappear and you'll see:
- ✅ **DNS check successful** (green checkmark)
- Then you can enable: ☑️ **Enforce HTTPS**

---

## 📝 Registrar-Specific Instructions

### If You Use GoDaddy:

1. Log in to GoDaddy
2. Go to **My Products** → **Domains**
3. Click on `parcelstools.com`
4. Scroll down to **Additional Settings**
5. Click **Manage DNS**
6. Delete old A records (if any)
7. Click **Add Record**
8. Select **Type: A**, **Name: @**, **Value: 185.199.108.153**
9. Repeat for the other 3 IP addresses
10. Click **Save**

### If You Use Namecheap:

1. Log in to Namecheap
2. Go to **Domain List**
3. Click **Manage** next to `parcelstools.com`
4. Click **Advanced DNS** tab
5. Delete old records under "Host Records"
6. Click **Add New Record**
7. Select **Type: A Record**, **Host: @**, **Value: 185.199.108.153**, **TTL: Automatic**
8. Repeat for the other 3 IP addresses
9. Click **Save All Changes** (green checkmark)

### If You Use Cloudflare:

1. Log in to Cloudflare
2. Select `parcelstools.com` from your sites
3. Click **DNS** in the left menu
4. Delete old A records for `@` or `parcelstools.com`
5. Click **Add record**
6. Type: `A`, Name: `@`, IPv4 address: `185.199.108.153`, Proxy status: **DNS only** (gray cloud)
7. Repeat for the other 3 IP addresses
8. Click **Save**

**Important for Cloudflare**: Make sure proxy is **OFF** (gray cloud icon) for GitHub Pages to work.

### If You Use Google Domains:

1. Log in to Google Domains
2. Click on `parcelstools.com`
3. Click **DNS** in the left menu
4. Scroll to **Custom resource records**
5. Delete old A records
6. Add new record:
   - Name: `@`
   - Type: `A`
   - TTL: `1H`
   - Data: `185.199.108.153`
7. Click **Add**
8. Repeat for the other 3 IP addresses

---

## ⚠️ Common Issues

### Issue: "I don't remember where I bought the domain"

**Solution**: Use a WHOIS lookup
- Go to: https://whois.domaintools.com/
- Enter: `parcelstools.com`
- Look for "Registrar" - this tells you where the domain is registered

### Issue: "DNS is propagating but GitHub still shows error"

**Solution**: 
1. Wait at least 1 hour after DNS changes
2. In GitHub Pages settings, remove the domain
3. Wait 1 minute
4. Add `parcelstools.com` again
5. Click Save

### Issue: "I added the records but nothing changed"

**Possible causes**:
1. DNS hasn't propagated yet - wait longer (up to 24 hours)
2. You edited the wrong domain or subdomain
3. You have nameservers pointing elsewhere
4. Cloudflare proxy is ON (must be OFF/gray cloud)

### Issue: "My registrar doesn't allow 4 A records"

**Solution**: Some registrars allow only one A record with multiple IPs
- Try entering all 4 IPs in one A record, separated by commas or newlines
- Or just use the first one: `185.199.108.153` (less reliable but will work)

---

## 📊 Current Status

| Item | Status |
|------|--------|
| CNAME file in GitHub | ✅ Done |
| Website files in root | ✅ Done |
| DNS A records configured | ❌ **YOU NEED TO DO THIS** |
| GitHub Pages source set | ⚠️ Should be done |
| Custom domain in GitHub | ⚠️ Waiting for DNS |

---

## 🎯 Complete Checklist

- [ ] Log in to your domain registrar (where you bought parcelstools.com)
- [ ] Go to DNS Management / DNS Settings
- [ ] Delete old A records for @ or root domain
- [ ] Add A record: @ → 185.199.108.153
- [ ] Add A record: @ → 185.199.109.153
- [ ] Add A record: @ → 185.199.110.153
- [ ] Add A record: @ → 185.199.111.153
- [ ] (Optional) Add CNAME record: www → NaziehSayegh.github.io
- [ ] Save changes
- [ ] Wait 15-60 minutes for propagation
- [ ] Check DNS with whatsmydns.net
- [ ] Go back to GitHub Pages settings
- [ ] Verify DNS check shows ✅ green checkmark
- [ ] Enable "Enforce HTTPS"
- [ ] Visit https://parcelstools.com to test

---

## 🆘 Still Not Working?

### If after 24 hours it's still not working:

1. **Check nameservers**: Make sure your domain's nameservers are pointing to your registrar (not somewhere else)

2. **Check DNSSEC**: Some registrars have DNSSEC enabled which can cause issues. Try disabling it temporarily.

3. **Try apex domain only**: In GitHub Pages, try removing `www.parcelstools.com` and only use `parcelstools.com`

4. **Contact your registrar support**: They can help verify your DNS settings are correct

---

## 📞 Need Help?

If you tell me:
1. **Where you bought the domain** (GoDaddy, Namecheap, etc.)
2. **What you see in your DNS settings** (screenshot or description)

I can give you more specific instructions!

---

## Summary

**The Issue**: DNS not configured  
**The Fix**: Add 4 A records at your domain registrar  
**The Records**: Point to 185.199.108.153, .109.153, .110.153, .111.153  
**The Time**: Wait 15 minutes to 24 hours for propagation  
**The Result**: GitHub will recognize your domain and serve your website  

**Once DNS propagates, your website will be live at https://parcelstools.com! 🎉**

