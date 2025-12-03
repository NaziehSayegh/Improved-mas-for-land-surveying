# 🔄 How to Release Updates for Parcel Tools

## Overview
This app has **automatic updates** powered by `electron-updater` and GitHub Releases.

---

## 📦 Release Process

### Step 1: Update Version Number
Edit `package.json` and increment the version:

```json
"version": "2.0.1"  // Change from 2.0.0 to 2.0.1 (or 2.1.0, 3.0.0, etc.)
```

**Version Numbering:**
- Bug fixes: `2.0.0` → `2.0.1`
- New features: `2.0.0` → `2.1.0`
- Major changes: `2.0.0` → `3.0.0`

---

### Step 2: Build the Application
```bash
cd "c:\programing projects\python\improved mas\parcel-tools-app"
npm install  # Make sure dependencies are up to date
npm run electron:build
```

This creates:
- `dist-electron\Parcel Tools Setup X.X.X.exe`
- `dist-electron\latest.yml` ⚠️ **CRITICAL for auto-updates!**

---

### Step 3: Create GitHub Release

1. Go to: https://github.com/NaziehSayegh/Improved-mas-for-land-surveying/releases

2. Click **"Draft a new release"**

3. Fill in the details:
   - **Tag version:** `v2.0.1` (must match package.json version with 'v' prefix!)
   - **Target:** `main` branch
   - **Release title:** `Parcel Tools v2.0.1`
   - **Description:** Document what's new (see template below)

4. **Upload files** (drag and drop):
   - ✅ `Parcel Tools Setup 2.0.1.exe`
   - ✅ `latest.yml` ⚠️ **REQUIRED for auto-updates!**

5. Click **"Publish release"**

---

### Release Description Template

```markdown
## 🎉 What's New in v2.0.1

### ✨ New Features
- Added feature X
- Improved feature Y

### 🐛 Bug Fixes
- Fixed issue with Z
- Resolved crash when...

### 🔧 Improvements
- Better performance
- Updated UI

---

## 📥 Installation

### New Users
Download and run the setup file below.

### Existing Users
If you have v2.0.0+, the app will **automatically notify you** about this update!
Just click "Download & Install" when prompted.

If you have an older version, please download and install manually this one time.
Future updates will be automatic!

---

## 📞 Support
Need help? Email: nsayegh2003@gmail.com

---

**Full Changelog:** https://github.com/NaziehSayegh/Improved-mas-for-land-surveying/compare/v2.0.0...v2.0.1
```

---

## 🔍 How Auto-Update Works

1. **User opens the app** with auto-update capability (v2.0.0+)

2. **After 3 seconds**, app checks GitHub Releases for newer versions

3. **If newer version found:**
   - Dialog appears: "Update Available! Version X.X.X"
   - User clicks "Download & Install"
   - Update downloads in background
   - Dialog appears: "Update Ready!"
   - User clicks "Restart Now" or "Later"
   - Update installs automatically! ✅

4. **If no update:** Silent (no notification)

---

## ⚠️ Important Notes

### Critical Files
- **`latest.yml`** - MUST be included in every release
  - Generated automatically by electron-builder
  - Contains version info and download links
  - Without it, auto-updates won't work!

### Version Tag Format
- Must start with `v` (e.g., `v2.0.1`, not `2.0.1`)
- Must match `package.json` version exactly
- Format: `vMAJOR.MINOR.PATCH`

### Testing Updates
Before releasing to users:
1. Build version X.X.X
2. Install it locally
3. Update package.json to X.X.X+1
4. Build new version
5. Create GitHub release
6. Open installed app → should detect update!

---

## 📊 Configuration

### Package.json Settings
```json
{
  "version": "2.0.0",
  "build": {
    "publish": {
      "provider": "github",
      "owner": "NaziehSayegh",
      "repo": "Improved-mas-for-land-surveying"
    }
  },
  "dependencies": {
    "electron-updater": "^6.1.7"
  }
}
```

### Main.js Settings
```javascript
autoUpdater.autoDownload = false;      // Ask user before downloading
autoUpdater.autoInstallOnAppQuit = true; // Install when app quits
```

---

## 🚨 First Update for Existing Users

Users who installed **before auto-update was added** need to:
- Download the new version **manually ONE TIME**
- After that, all future updates are automatic!

Send them this message: See `📢_MESSAGE_TO_EXISTING_USERS.txt`

---

## 🎯 Quick Checklist

Before releasing an update:

- [ ] Update version in `package.json`
- [ ] Test the build locally
- [ ] Run `npm run electron:build`
- [ ] Check that `latest.yml` was generated
- [ ] Create GitHub release with `v` prefix
- [ ] Upload both `.exe` and `latest.yml`
- [ ] Test auto-update from previous version
- [ ] Announce update to users (if major)

---

## 📞 Support

If users have issues with updates:
- Email: nsayegh2003@gmail.com
- Check GitHub Actions for build status
- Verify `latest.yml` is in the release

---

**Author:** Nazieh Sayegh  
**Last Updated:** December 2024

