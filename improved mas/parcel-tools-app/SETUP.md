# 🚀 Setup Guide - Parcel Tools Desktop App

## Step-by-Step Installation

### 1️⃣ Prerequisites

Make sure you have these installed:
- **Node.js 18+** - [Download](https://nodejs.org/)
- **Python 3.8+** - [Download](https://www.python.org/)
- **npm** (comes with Node.js)

Verify installation:
```bash
node --version   # Should show v18 or higher
python --version # Should show 3.8 or higher
npm --version
```

### 2️⃣ Install Dependencies

Open terminal in the `parcel-tools-app` folder:

**Install JavaScript dependencies:**
```bash
npm install
```

**Install Python dependencies:**
```bash
cd backend
pip install -r requirements.txt
cd ..
```

### 3️⃣ Run in Development Mode

**Option A: Run both automatically (Recommended)**

This runs both frontend and backend together:
```bash
npm run electron:dev
```

**Option B: Run separately**

Terminal 1 (Python backend):
```bash
npm run start:python
# Or manually: python backend/app.py
```

Terminal 2 (Electron app):
```bash
npm run electron:dev
```

### 4️⃣ Build for Production

Create a standalone desktop app:

```bash
npm run electron:build
```

The built app will be in `dist-electron/` folder:
- **Windows**: `.exe` file
- **Mac**: `.dmg` file
- **Linux**: `.AppImage` file

## 🎯 Quick Test

After installation, test if everything works:

1. Run `npm run electron:dev`
2. The app should open showing the landing page
3. Click "Get Started"
4. You should see the main menu with 8 options
5. Click "Parcel Calculator" to test area calculations

## 🐛 Troubleshooting

### Problem: Python backend not starting

**Solution:**
```bash
# Try installing Flask directly
pip install Flask flask-cors

# Or use Python 3 explicitly
python3 backend/app.py
```

### Problem: Electron app won't start

**Solution:**
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Problem: Port 5000 already in use

**Solution:**
Edit `backend/app.py` and change:
```python
app.run(host='localhost', port=5001, debug=True)  # Changed to 5001
```

Then update `src/utils/api.js`:
```javascript
const API_BASE_URL = 'http://localhost:5001/api';
```

### Problem: Module not found errors

**Solution:**
```bash
# Reinstall all dependencies
npm install
cd backend
pip install -r requirements.txt
```

## 📦 Development Tips

### Hot Reload
- Frontend: Automatically reloads on file changes
- Backend: Restart Python manually or use `flask run --reload`

### DevTools
Press `Ctrl+Shift+I` (Windows/Linux) or `Cmd+Option+I` (Mac) to open DevTools

### Debugging
- Frontend: Use Chrome DevTools in Electron
- Backend: Check terminal output for Flask logs

## 🎨 Customization

### Change Theme Colors
Edit `tailwind.config.js` to customize colors

### Change Window Size
Edit `electron/main.js`:
```javascript
width: 1400,  // Change width
height: 900,  // Change height
```

### Add New Features
1. Create new page in `src/pages/`
2. Add route in `src/App.jsx`
3. Add menu item in `src/pages/Dashboard.jsx`

## 📚 Learn More

- [Electron Documentation](https://www.electronjs.org/docs)
- [React Documentation](https://react.dev/)
- [Tailwind CSS Documentation](https://tailwindcss.com/)
- [Flask Documentation](https://flask.palletsprojects.com/)

## ✅ Checklist

- [ ] Node.js installed
- [ ] Python installed
- [ ] npm install completed
- [ ] pip install completed
- [ ] Backend starts on port 5000
- [ ] Electron app opens successfully
- [ ] Can navigate between pages
- [ ] Calculator works

If all checked ✅, you're ready to go! 🎉


