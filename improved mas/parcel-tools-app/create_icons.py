"""
Simple script to create icon files from the SVG icon
Run this to generate icon.ico and favicon.png
"""

import os
import sys

try:
    from PIL import Image
    import cairosvg
    print("✅ Required libraries found!")
except ImportError:
    print("❌ Missing required libraries!")
    print("\nPlease install:")
    print("  pip install Pillow cairosvg")
    print("\nOr I can create simple icons without these libraries.")
    sys.exit(1)

# Paths
svg_path = "public/icon.svg"
ico_output = "build/icon.ico"
png_output = "build/icon.png"
favicon_output = "../../../favicon.png"

# Create build directory if needed
os.makedirs("build", exist_ok=True)

print("🎨 Converting SVG to PNG...")
# Convert SVG to PNG
cairosvg.svg2png(url=svg_path, write_to=png_output, output_width=256, output_height=256)
print(f"✅ Created: {png_output}")

print("🎨 Creating ICO file...")
# Open PNG and save as ICO
img = Image.open(png_output)
img.save(ico_output, format='ICO', sizes=[(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)])
print(f"✅ Created: {ico_output}")

print("🎨 Creating favicon for website...")
# Copy to website root
img.save(favicon_output, format='PNG')
print(f"✅ Created: {favicon_output}")

print("\n🎉 Done! Icons created successfully!")
print("\nNext steps:")
print("1. Rebuild the app: npm run electron:build")
print("2. Your app will now have a custom icon!")

