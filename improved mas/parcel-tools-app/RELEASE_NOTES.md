# 📦 Parcel Tools v2.0.0 - Release Notes

## 🎉 What's New

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

**Version**: 2.0.0  
**Release Date**: November 17, 2025  
**Build**: Stable Release



