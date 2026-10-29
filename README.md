# 🌐 Parcel Tools - Download Website

This is the **landing/download website** for Parcel Tools desktop application.

## 📋 Purpose

This website allows users to:
- ✅ Learn about Parcel Tools features
- ✅ Download the desktop app installer
- ✅ View screenshots and system requirements
- ✅ Get support and documentation links

## 🚀 Quick Start

### Preview Locally
Simply double-click `index.html` to see the website in your browser.

### Deploy Online

**Option 1: GitHub Pages** (Recommended - Free)
```bash
git init
git add .
git commit -m "Initial commit"
# Push to GitHub and enable Pages in Settings
```

**Option 2: Netlify** (Easiest)
1. Go to netlify.com
2. Drag & drop this folder
3. Done!

**Option 3: Vercel/Your Server**
Upload files via FTP or connect GitHub repo.

## 📦 Setup Downloads

### 1. Build the Installer

In the main app folder:
```bash
cd ../parcel-tools-app
build-installer.bat
```

Output: `dist-electron\Parcel-Tools-Setup-2.0.0.exe`

### 2. Upload to GitHub Releases

1. Create a release on GitHub
2. Upload the `.exe` file
3. Get the download URL

### 3. Update Download Links

Edit `index.html` around line 243:

```javascript
const DOWNLOAD_CONFIG = {
    github: 'https://github.com/YOUR_USERNAME/parcel-tools/releases/download/v2.0.0/Parcel-Tools-Setup-2.0.0.exe',
    direct: 'https://your-hosting.com/downloads/Parcel-Tools-Setup-2.0.0.exe',
    releases: 'https://github.com/YOUR_USERNAME/parcel-tools/releases',
};
```

Replace `YOUR_USERNAME` with your actual GitHub username.

## 🎨 Customization

### Change Colors
The website uses Tailwind CSS. Main colors:
- Primary: `blue-600` (change to any color like `green-600`, `purple-600`)
- Background: `gray-900` to `blue-900` gradient
- Accent: `blue-400`

### Update Screenshots
The website uses real screenshots of the app, stored as WebP files in `screenshots/`
(`cad-import`, `cad-layers`, `cad-review-arc`, `calculator-map`, `calculator-saved`, `plotting`, `menu`).
To refresh them after a UI change, capture the same screens at 1920x1080 from the running app,
convert to WebP, and replace the files with the same names. Keep them real - no mock-ups.

### Update Content
Edit the text directly in `index.html`:
- Features (lines 116-153)
- System requirements (lines 195-211)
- Footer links (lines 235-255)

## 📊 File Structure

```
parcel-tools-website/
├── index.html              # Main website (single page)
├── README.md              # This file
└── screenshots/           # Real app screenshots (WebP)
```

## 🌐 Hosting Options

### GitHub Pages (Recommended - Free)

1. Create a GitHub repository
2. Upload this folder
3. Go to Settings → Pages
4. Select branch: `main`, folder: `/root`
5. Save
6. Your site will be at: `https://yourusername.github.io/parcel-tools/`

### Netlify (Easy - Free)

1. Go to netlify.com
2. Drag and drop this folder
3. Done! You get a URL like: `parcel-tools-abc123.netlify.app`

### Your Own Domain

1. Buy a domain (e.g., parceltools.com)
2. Upload files to your hosting
3. Point domain to hosting

## 📈 Add Analytics (Optional)

Add Google Analytics by inserting before `</head>`:

```html
<!-- Google Analytics -->
<script async src="https://www.googletagmanager.com/gtag/js?id=YOUR-GA-ID"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'YOUR-GA-ID');
</script>
```

## 📱 Features

✅ Fully responsive (mobile, tablet, desktop)
✅ Smooth animations
✅ Modern design
✅ Fast loading (single HTML file)
✅ SEO friendly
✅ No dependencies (uses Tailwind CDN)

## 🎯 Next Steps

1. Build your desktop app: `npm run electron:build`
2. Upload installer to GitHub Releases or file host
3. Update download link in `index.html`
4. Add screenshots of your app
5. Upload website to hosting
6. Share the link!

## 💡 Tips

- Keep the website simple and fast
- Add real screenshots to build trust
- Update version numbers when you release updates
- Consider adding a changelog page
- Add video demo (embed YouTube)

---

**Your complete workflow:**
1. Users visit website → See features → Click download
2. Installer downloads → User runs it → App installs
3. User launches desktop app from Start Menu/Desktop
4. User works offline with the installed app!

Just like Discord, VS Code, Slack, etc! 🚀



