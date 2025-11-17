# 📐 Parcel Tools - Professional Surveying Desktop App

A beautiful, modern desktop application for surveying and parcel area calculations built with **Electron**, **React**, **Tailwind CSS**, and **Python Flask**.

## ✨ Features

- 🧮 **Precise Area Calculations** - Calculate parcel areas using professional surveying methods
- 📍 **Point Management** - Import and manage survey coordinate points
- 📊 **Data Management** - Organize projects and survey data
- ⚙️ **Configurable Settings** - Customize units, precision, and coordinate systems
- 🎨 **Beautiful Modern UI** - Stunning interface with smooth animations
- 🌙 **Dark Theme** - Easy on the eyes with professional dark mode
- 🚀 **Fast & Responsive** - Built with modern technologies for optimal performance

## 🛠️ Tech Stack

### Frontend
- **Electron** - Desktop app framework
- **React 18** - UI library
- **Vite** - Lightning-fast build tool
- **Tailwind CSS** - Utility-first CSS framework
- **Framer Motion** - Smooth animations
- **Lucide React** - Beautiful icons

### Backend
- **Python 3.x** - Core logic
- **Flask** - Web framework
- **Flask-CORS** - Cross-origin support

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- Python 3.8+
- npm or yarn

### Installation

1. **Install Node dependencies:**
```bash
npm install
```

2. **Install Python dependencies:**
```bash
cd backend
pip install -r requirements.txt
cd ..
```

### Development

Run both frontend and backend in development mode:

```bash
# Terminal 1: Start Python backend
npm run start:python

# Terminal 2: Start Electron app
npm run electron:dev
```

The app will open automatically with hot-reload enabled!

### Building for Production

Build the app for distribution:

```bash
npm run electron:build
```

The built app will be in the `dist-electron` folder.

## 📁 Project Structure

```
parcel-tools-app/
├── electron/              # Electron main process
│   ├── main.js           # Electron entry point
│   └── preload.js        # Preload script
├── backend/              # Python Flask backend
│   ├── app.py           # Flask API server
│   ├── requirements.txt # Python dependencies
│   └── data/            # Data storage
├── src/                  # React frontend
│   ├── components/      # Reusable components
│   ├── pages/           # Page components
│   ├── utils/           # Utilities and API client
│   ├── App.jsx          # Main app component
│   ├── main.jsx         # React entry point
│   └── index.css        # Global styles
├── public/              # Static assets
├── package.json         # Node dependencies
└── vite.config.js       # Vite configuration
```

## 🎯 Main Features

### 1. Parcel Calculator
- Add/remove coordinate points
- Calculate area using shoelace formula
- Calculate perimeter
- Import points from files (.pnt, .txt, .csv)
- Export calculation results

### 2. Data Files Manager
- Create and manage projects
- Store survey point data
- Import/export data files
- Project statistics

### 3. Work Mode Settings
- Configure coordinate systems
- Set measurement units (metric/imperial)
- Adjust decimal precision
- Display preferences

## 🎨 Design Features

- **Modern Glass-morphism UI** - Translucent surfaces with blur effects
- **Smooth Animations** - Fluid page transitions and interactions
- **Gradient Accents** - Beautiful color gradients throughout
- **Responsive Layout** - Adapts to different window sizes
- **Floating Background** - Animated background effects
- **Professional Color Scheme** - GitHub-inspired dark theme

## 📊 API Endpoints

- `GET /api/health` - Health check
- `POST /api/calculate-area` - Calculate parcel area
- `GET /api/projects` - Get all projects
- `POST /api/projects` - Create project
- `GET /api/projects/:id` - Get project
- `PUT /api/projects/:id` - Update project
- `DELETE /api/projects/:id` - Delete project
- `POST /api/import-points` - Import points
- `POST /api/export-points` - Export points

## 🔧 Configuration

### Python Backend Port
Default: `http://localhost:5000`

To change, update `src/utils/api.js`:
```javascript
const API_BASE_URL = 'http://localhost:YOUR_PORT/api';
```

### Electron Window Settings
Edit `electron/main.js` to customize window size, position, etc.

## 🤝 Contributing

Contributions are welcome! Feel free to submit issues and pull requests.

## 📄 License

MIT License - feel free to use this project for any purpose.

## 🎉 Credits

Built with ❤️ using modern web technologies.

---

**Happy Surveying! 📐🎯**


