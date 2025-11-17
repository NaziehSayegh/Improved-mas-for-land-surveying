# ⚙️ Website Configuration Guide

## 📝 Quick Configuration Steps

### 1. Update Download Links

Open `index.html` and find the `DOWNLOAD_CONFIG` section (around line 243):

```javascript
const DOWNLOAD_CONFIG = {
    // UPDATE THESE:
    github: 'https://github.com/YOUR_USERNAME/parcel-tools/releases/download/v2.0.0/Parcel-Tools-Setup-2.0.0.exe',
    direct: 'https://your-hosting.com/downloads/Parcel-Tools-Setup-2.0.0.exe',
    releases: 'https://github.com/YOUR_USERNAME/parcel-tools/releases',
};
```

**Replace:**
- `YOUR_USERNAME` → Your GitHub username
- `your-hosting.com` → Your actual hosting URL

### 2. Optional: Add Screenshots

Replace placeholder text with actual images:

1. Take screenshots of your app
2. Save as `screenshot-1.png`, `screenshot-2.png`
3. Place in same folder as `index.html`
4. Images will appear in the features section

### 3. Optional: Customize Colors

The website uses Tailwind CSS. To change colors, find and replace:

- `blue-600` → Any color (e.g., `green-600`, `purple-600`)
- `blue-400` → Lighter shade
- `gray-900` → Background color

### 4. Optional: Add Your Contact Info

Update the footer (around line 225):

```html
<p class="text-gray-400">
    Contact: your-email@example.com
</p>
```

### 5. Optional: Add Google Analytics

Insert before `</head>`:

```html
<script async src="https://www.googletagmanager.com/gtag/js?id=YOUR-GA-ID"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'YOUR-GA-ID');
</script>
```

## ✅ Testing Checklist

Before deploying:

- [ ] Download button shows correct alert or downloads file
- [ ] All navigation links work
- [ ] Website looks good on mobile
- [ ] No broken images
- [ ] Contact info is correct
- [ ] Version number is correct (v2.0.0)

## 🚀 Deploy

After configuration, deploy using one of these methods:

**GitHub Pages:**
```bash
git add .
git commit -m "Configure download links"
git push
```

**Netlify:**
1. Log in to Netlify
2. Drag updated folder
3. Done!

**FTP:**
Upload all files to your web hosting.

## 🎉 Done!

Your website is ready. Share the URL with users!


