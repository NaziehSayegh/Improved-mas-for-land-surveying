# 🚀 Parcel Tools - Deployment Guide

## 📋 Overview

This guide will help you build, package, and deploy Parcel Tools for distribution.

---

## 🛠️ Step 1: Build the Windows Installer

### Prerequisites
- Node.js installed (v16 or higher)
- Python installed (v3.8 or higher)
- Windows 10/11 (for building Windows installer)

### Build Process

1. **Navigate to the app folder:**
```cmd
cd "C:\programing projects\python\improved mas\parcel-tools-app"
```

2. **Run the build script:**
```cmd
build-installer.bat
```

This will:
- Install dependencies
- Build the React frontend
- Copy the Python backend
- Create a Windows installer

3. **Find your installer:**
```
Location: dist-electron\Parcel-Tools-Setup-2.0.0.exe
Size: ~150-200 MB
```

---

## 📤 Step 2: Upload the Installer

### Option A: GitHub Releases (Recommended - Free)

1. **Create a GitHub Repository**
   - Go to https://github.com/new
   - Name: `parcel-tools`
   - Click "Create repository"

2. **Create a Release**
   - Go to your repository
   - Click "Releases" → "Create a new release"
   - Tag: `v2.0.0`
   - Title: `Parcel Tools v2.0.0`
   - Description: Copy from `RELEASE_NOTES.md`

3. **Upload the Installer**
   - Drag `Parcel-Tools-Setup-2.0.0.exe` to the release assets
   - Click "Publish release"

4. **Get the Download URL**
   ```
   https://github.com/YOUR_USERNAME/parcel-tools/releases/download/v2.0.0/Parcel-Tools-Setup-2.0.0.exe
   ```

### Option B: File Hosting Services

**Dropbox:**
1. Upload file to Dropbox
2. Get shareable link
3. Change `?dl=0` to `?dl=1` for direct download

**Google Drive:**
1. Upload file
2. Right-click → "Get link"
3. Change sharing to "Anyone with the link"
4. Use: `https://drive.google.com/uc?export=download&id=FILE_ID`

**Your Own Server:**
1. Upload via FTP to your web hosting
2. Place in a `downloads/` folder
3. URL: `https://yourwebsite.com/downloads/Parcel-Tools-Setup-2.0.0.exe`

---

## 🌐 Step 3: Deploy the Website

### Quick Test (Local)

1. Open `parcel-tools-website\index.html` in a browser
2. Test the download buttons
3. Verify all links work

### Option A: GitHub Pages (Free, Easy)

1. **Create Repository for Website**
   ```cmd
   cd "C:\programing projects\python\improved mas\parcel-tools-website"
   git init
   git add .
   git commit -m "Initial website commit"
   ```

2. **Push to GitHub**
   - Create new repository on GitHub (e.g., `parcel-tools-website`)
   - Follow GitHub's push instructions

3. **Enable GitHub Pages**
   - Go to repository Settings → Pages
   - Source: `Deploy from a branch`
   - Branch: `main` / Folder: `/ (root)`
   - Save

4. **Your website will be live at:**
   ```
   https://YOUR_USERNAME.github.io/parcel-tools-website/
   ```

### Option B: Netlify (Super Easy)

1. Go to **netlify.com** and sign up
2. Click "Add new site" → "Deploy manually"
3. Drag the `parcel-tools-website` folder
4. Done! You get a URL like: `parcel-tools-xyz123.netlify.app`

**Pro Tip:** Connect your GitHub repo for auto-updates!

### Option C: Vercel (Also Easy)

1. Go to **vercel.com** and sign up
2. Click "New Project"
3. Import your GitHub repository
4. Deploy!

### Option D: Your Own Hosting

1. Upload all files to your web hosting via FTP
2. Place in public_html or www folder
3. Access at your domain

---

## 🔗 Step 4: Update Download Links

Edit `parcel-tools-website\index.html` (around line 243):

```javascript
const DOWNLOAD_CONFIG = {
    // UPDATE THESE LINKS:
    github: 'https://github.com/YOUR_USERNAME/parcel-tools/releases/download/v2.0.0/Parcel-Tools-Setup-2.0.0.exe',
    direct: 'https://your-hosting.com/downloads/Parcel-Tools-Setup-2.0.0.exe',
    releases: 'https://github.com/YOUR_USERNAME/parcel-tools/releases',
};
```

**Replace:**
- `YOUR_USERNAME` with your GitHub username
- `your-hosting.com` with your actual hosting URL

---

## ✅ Step 5: Test Everything

### Test the Installer
1. Download from your website
2. Run the installer
3. Install to a test location
4. Launch the app
5. Test all features:
   - Load points file
   - Calculate area
   - Save project
   - Open saved project
   - Export PDF

### Test the Website
1. Visit your deployed website
2. Click download button
3. Verify download starts
4. Check all navigation links
5. Test on mobile devices

---

## 📊 Distribution Checklist

- [ ] Build installer successfully
- [ ] Test installer on clean Windows machine
- [ ] Upload installer to GitHub Releases or hosting
- [ ] Update website download links
- [ ] Deploy website to hosting
- [ ] Test download from website
- [ ] Share website URL with users
- [ ] Monitor for feedback/issues

---

## 🔄 Updating for New Versions

### When You Release v2.0.1, v2.1.0, etc:

1. **Update version in `package.json`:**
   ```json
   "version": "2.0.1",
   ```

2. **Update `RELEASE_NOTES.md`** with changes

3. **Rebuild installer:**
   ```cmd
   build-installer.bat
   ```

4. **Create new GitHub Release** with new tag (e.g., `v2.0.1`)

5. **Update website `DOWNLOAD_CONFIG`** with new version URLs

6. **Redeploy website** (GitHub Pages updates automatically)

---

## 📈 Optional: Add Analytics

### Google Analytics

Add to website `<head>`:
```html
<script async src="https://www.googletagmanager.com/gtag/js?id=YOUR-GA-ID"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'YOUR-GA-ID');
</script>
```

Track downloads:
```javascript
gtag('event', 'download', {
  'event_category': 'installer',
  'event_label': 'windows',
  'value': '2.0.0'
});
```

---

## 🎯 Marketing Your App

### Share On:
- [ ] LinkedIn (professional audience)
- [ ] Reddit (r/surveying, r/GIS)
- [ ] Twitter/X
- [ ] Facebook groups
- [ ] Forums (surveying/GIS communities)
- [ ] Your company website
- [ ] Email signature

### SEO Tips:
- Use relevant keywords: "surveying software", "parcel calculator", "area calculation"
- Submit to software directories
- Create tutorial videos (YouTube)
- Write blog posts about features

---

## 🐛 Troubleshooting

### Build Fails
- Check Node.js version: `node --version` (should be v16+)
- Check Python version: `python --version` (should be 3.8+)
- Delete `node_modules` and run `npm install` again

### Installer Doesn't Run
- Check Windows SmartScreen settings
- Ensure antivirus isn't blocking
- Run as Administrator

### Website Not Deploying
- Check repository is public (for GitHub Pages)
- Verify branch name is correct
- Wait a few minutes for deployment

---

## 📞 Support

If you encounter issues:
1. Check this guide again
2. Review error messages
3. Check GitHub Issues (if repo is public)
4. Ask in surveying/dev communities

---

## 🎉 Success!

Once deployed, share your website URL:
```
https://YOUR_USERNAME.github.io/parcel-tools-website/
```

Users can now download and install your professional surveying tool!

---

**Last Updated:** November 17, 2025
**App Version:** 2.0.0
**Guide Version:** 1.0


