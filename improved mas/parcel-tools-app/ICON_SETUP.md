# Icon Setup for Parcel Tools

## Overview

The Parcel Tools application now uses **two distinct icons**:

1. **App Icon** (`app-icon.ico/png`) - The main application icon
2. **File Icon** (`file-icon.ico/png`) - Icon for `.prcl` project files

## Icon Descriptions

### App Icon (app-icon.ico/png)
- **Design**: Professional blue-to-purple gradient with a theodolite (surveying instrument) on tripod
- **Features**: 
  - White theodolite symbol representing surveying equipment
  - Gold crosshair representing precision
  - Modern rounded corners
  - Gradient background (blue to purple)
- **Used for**: Application executable, desktop shortcut, taskbar

### File Icon (file-icon.ico/png)
- **Design**: Document-style icon with parcel land plot
- **Features**:
  - Light gray/blue document with folded corner
  - Blue parcel polygon with survey points
  - ".prcl" label at bottom
  - Clean, professional look
- **Used for**: All `.prcl` project files in File Explorer

## Icon Files

All icon files are located in the `build/` directory:
```
build/
├── app-icon.png     (512x512 PNG)
├── app-icon.ico     (Multi-size ICO: 256, 128, 64, 48, 32, 16)
├── file-icon.png    (512x512 PNG)
├── file-icon.ico    (Multi-size ICO: 256, 128, 64, 48, 32, 16)
├── icon.png         (Legacy - now same as app-icon.png)
└── icon.ico         (Legacy - now same as app-icon.ico)
```

## How to Regenerate Icons

If you need to modify the icons:

1. Edit the `create_app_and_file_icons.py` script
2. Run the script:
   ```bash
   python create_app_and_file_icons.py
   ```
3. The script will generate all icon files in the `build/` directory

## Configuration

The icons are configured in `package.json`:

```json
{
  "build": {
    "win": {
      "icon": "build/app-icon.ico"  // App icon
    },
    "fileAssociations": [
      {
        "ext": "prcl",
        "icon": "build/file-icon.ico"  // File icon
      }
    ]
  }
}
```

## Rebuilding the Application

After updating icons, rebuild the application:

```bash
npm run electron:build
```

This will create a new installer in `dist-electron/` with the updated icons.

## Testing Icons

1. **App Icon**: Check the application executable, desktop shortcut, and taskbar
2. **File Icon**: Create or open a `.prcl` file in File Explorer

## Technical Details

- **Format**: Both ICO and PNG formats are provided
- **Sizes**: ICO files include multiple resolutions (16x16 to 256x256) for optimal display at any size
- **Transparency**: Both icons use transparency (alpha channel) for professional appearance
- **Compatibility**: Tested on Windows 10/11

## Design Rationale

The two-icon approach provides:
- **Brand Recognition**: Special app icon represents the Parcel Tools brand
- **File Identification**: Distinct file icon makes `.prcl` files easy to identify in File Explorer
- **Professional Appearance**: Modern, clean design suitable for professional surveying work
- **User Experience**: Clear visual distinction between app and files

