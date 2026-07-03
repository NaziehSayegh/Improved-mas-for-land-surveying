# 📦 Parcel Tools - Release Notes

## 🎉 What's New in v2.0.2 (July 2026)

### ✨ New Features & Enhancements
- ✅ **DWG File Handling**: Added support for importing and handling DWG CAD files with a new, redesigned DWG import page.
- ✅ **GIS Layer Filtering**: Restrict parcel selection to GIS layer and automatically explode non-GIS boundaries for cleaner analysis.
- ✅ **CAD Block Attribute Parsing**: Enhanced CAD file importing with improved block attribute parsing and proportional text scaling.
- ✅ **Save Project As**: Added convenient "Save Project As" option to the main menu.
- ✅ **Computer-Wide Scan**: Added scanning capability for locating `.prcl` project files across the system.

### 🐛 Bug Fixes & Stability
- 🔧 Fixed double-click project opening errors and improved native file dialog handling.
- 🔧 Prevented UI freezing during intensive file processing.
- 🔧 Resolved blank screen issues by improving path resolution in packaged Electron production builds.
- 🔧 Added comprehensive error logging to the backend API for faster debugging.
- 🔧 Bundled embedded Python runtime with auto-starting backend for seamless offline operation.

---

## 🚀 Previous Release: v2.0.0 (November 2025)

### Major Features
✅ **Professional Area Calculator**
- Calculate parcel areas with automatic coordinate lookup
- Support for curves (circular arcs) with M values
- Live area preview and confirmation dialogs
- Save multiple parcels in one project
- Export to professional PDF format

✅ **Smart Project Management**
- Save/load complete project state
- Auto-save every 2 seconds
- Unsaved changes indicator
- Save empty projects for templates
- Double-click `.prcl` files to open

✅ **Points File Editor**
- Load .pnt, .txt, .csv files
- Add, edit, delete points
- Auto-save changes
- File watching with auto-recalculation
- Import from various formats

✅ **Auto-Features**
- Auto-save parcels (immediate)
- Auto-save projects (2 seconds)
- Auto-save points files (3 seconds)
- Auto-watch points files
- Auto-recalculate when points change

### UI/UX Improvements
✅ Modern dark theme with smooth animations
✅ Toast notifications (non-blocking)
✅ Keyboard shortcuts (ESC to exit, etc.)
✅ Responsive design
✅ Professional PDF exports

### File Formats Supported
- **Points Files**: `.pnt`, `.txt`, `.csv`
- **Project Files**: `.prcl` (custom format)
- **Export**: PDF

## 🔧 Technical Details

### System Requirements
- **OS**: Windows 10/11 (64-bit)
- **RAM**: 4 GB minimum, 8 GB recommended
- **Disk**: 500 MB free space
- **Python**: Bundled (no separate installation needed)

### Technologies Used
- **Frontend**: React 18, Vite, Tailwind CSS
- **Backend**: Python 3.x, Flask
- **Desktop**: Electron 28
- **PDF**: ReportLab

## 📥 Installation

1. Download `Parcel-Tools-Setup-2.0.0.exe`
2. Run the installer
3. Follow the setup wizard
4. Launch from Desktop or Start Menu

## 🐛 Known Issues

- First launch may take a few seconds as Python backend initializes
- Large point files (>10,000 points) may take longer to load
- PDF export requires internet connection for the first time

## 🔄 Upgrading from v1.x

This is a complete rewrite. Old project files are not compatible.
Export your data from v1.x before upgrading.

## 📞 Support

- **Website**: Your website URL here
- **Issues**: Create an issue on GitHub
- **Email**: your-email@example.com

## 🙏 Acknowledgments

Built with ❤️ for surveying professionals.

---

**Version**: 2.0.2  
**Release Date**: July 2026  
**Build**: Stable Release




