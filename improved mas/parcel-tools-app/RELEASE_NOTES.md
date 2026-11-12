# 📦 Parcel Tools - Release Notes

## 🎉 What's New in v2.0.25 (November 2026)

### ✨ New Features & Enhancements
- ✅ **New Edit Mode (Parcel Calculator)**: the parcel under the mouse highlights and opens with one click. Add, replace and remove corners directly on the map or by typed point ID, with live area, the difference from the saved area, undo / redo and a Save / Cancel bar.
- ✅ **Sort for Saved Parcels and All Versions**: order saved, newest, parcel number or area. The choice is remembered.
- ✅ **Search in Saved Projects**: find a project by name, file name, folder or points file.
- ✅ **Redesigned Data Files and Admin pages**: searchable, paged tables and one shared back button on every page.
- ✅ **Animated loading screen** and a quick fade between pages.

### ⚡ Speed
- 🚀 Pages open at once: the "Verifying license" screen no longer appears on every page change.
- 🚀 Faster start-up: each screen loads when it is first opened.
- 🚀 Faster map on large point files.

### 🐛 Bug Fixes & Stability
- 🔧 Fixed the black screen when opening All Versions for a parcel number with more than one saved version.
- 🔧 A crash on one screen now shows a message with Try again / Reload instead of a black window.
- 🔧 Data Files: "Open Project File" no longer asks for the file twice; "Scan Computer" reports the right count; coordinates must be numbers.
- 🔧 Dragging the map no longer counts as a click; cancelling an edit no longer leaves the parcel linked to the editor.

---

## Previous Release: v2.0.2 (July 2026)

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




