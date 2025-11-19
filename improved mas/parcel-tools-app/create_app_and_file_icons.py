"""
Create professional icons for Parcel Tools app and .prcl file associations
Creates two distinct icons:
1. App icon - Special professional surveying tool icon
2. File icon - Document-style icon for .prcl files
"""

from PIL import Image, ImageDraw, ImageFont
import os

def create_app_icon(size=512):
    """Create a professional gradient app icon with surveying symbols"""
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Create gradient background (professional blue-purple gradient)
    for y in range(size):
        # Gradient from bright blue to deep purple
        ratio = y / size
        r = int(30 + (100 - 30) * ratio)
        g = int(100 + (50 - 100) * ratio)
        b = int(255 + (150 - 255) * ratio)
        draw.rectangle([(0, y), (size, y + 1)], fill=(r, g, b, 255))
    
    # Create rounded corners for modern look
    mask = Image.new('L', (size, size), 0)
    mask_draw = ImageDraw.Draw(mask)
    corner_radius = size // 8
    mask_draw.rounded_rectangle([(0, 0), (size, size)], radius=corner_radius, fill=255)
    img.putalpha(mask)
    
    # Draw main icon elements - surveying equipment symbol
    center_x, center_y = size // 2, size // 2
    icon_size = size // 2.5
    
    # Draw theodolite/total station symbol (surveying instrument)
    # Base tripod
    tripod_width = icon_size * 0.7
    tripod_height = icon_size * 0.4
    draw.line([(center_x - tripod_width/2, center_y + tripod_height),
               (center_x, center_y)], fill='white', width=size//40)
    draw.line([(center_x + tripod_width/2, center_y + tripod_height),
               (center_x, center_y)], fill='white', width=size//40)
    draw.line([(center_x, center_y + tripod_height),
               (center_x, center_y)], fill='white', width=size//40)
    
    # Instrument body (circle at top)
    instrument_radius = icon_size * 0.25
    draw.ellipse([(center_x - instrument_radius, center_y - icon_size*0.3 - instrument_radius),
                  (center_x + instrument_radius, center_y - icon_size*0.3 + instrument_radius)],
                 fill='white', outline='white', width=size//80)
    
    # Telescope/scope
    scope_length = icon_size * 0.4
    draw.line([(center_x, center_y - icon_size*0.3),
               (center_x + scope_length, center_y - icon_size*0.3 - scope_length*0.3)],
              fill='white', width=size//35)
    
    # Cross-hair symbol overlay (represents precision)
    crosshair_size = icon_size * 0.15
    draw.line([(center_x - crosshair_size, center_y - icon_size*0.3),
               (center_x + crosshair_size, center_y - icon_size*0.3)],
              fill='#FFD700', width=size//60)  # Gold color
    draw.line([(center_x, center_y - icon_size*0.3 - crosshair_size),
               (center_x, center_y - icon_size*0.3 + crosshair_size)],
              fill='#FFD700', width=size//60)  # Gold color
    
    # Add small circle in center of crosshair
    draw.ellipse([(center_x - size//100, center_y - icon_size*0.3 - size//100),
                  (center_x + size//100, center_y - icon_size*0.3 + size//100)],
                 fill='#FFD700')
    
    # Add subtle shine effect (top-left corner)
    shine = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    shine_draw = ImageDraw.Draw(shine)
    shine_draw.ellipse([(size//8, size//8), (size//2, size//2)],
                       fill=(255, 255, 255, 40))
    img = Image.alpha_composite(img, shine)
    
    return img

def create_file_icon(size=512):
    """Create a document-style icon for .prcl files"""
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Document shape with folded corner
    doc_margin = size // 8
    fold_size = size // 6
    
    # Main document body (white/light gray)
    document_color = (245, 248, 250, 255)  # Light blue-gray
    draw.rectangle([
        (doc_margin, doc_margin),
        (size - doc_margin, size - doc_margin)
    ], fill=document_color, outline=(180, 190, 200, 255), width=size//100)
    
    # Folded corner (top-right)
    fold_points = [
        (size - doc_margin - fold_size, doc_margin),
        (size - doc_margin, doc_margin + fold_size),
        (size - doc_margin - fold_size, doc_margin + fold_size)
    ]
    draw.polygon(fold_points, fill=(200, 210, 220, 255))
    
    # Triangle to show fold
    fold_shadow = [
        (size - doc_margin - fold_size, doc_margin),
        (size - doc_margin, doc_margin + fold_size),
        (size - doc_margin - fold_size, doc_margin + fold_size)
    ]
    draw.polygon(fold_shadow, outline=(150, 160, 170, 255), width=size//150)
    
    # Add parcel/land plot icon in center
    icon_size = size // 3
    center_x, center_y = size // 2, size // 2 + size // 20
    
    # Draw a stylized land parcel shape (irregular polygon)
    parcel_points = [
        (center_x - icon_size*0.4, center_y - icon_size*0.3),
        (center_x + icon_size*0.3, center_y - icon_size*0.4),
        (center_x + icon_size*0.5, center_y + icon_size*0.2),
        (center_x + icon_size*0.1, center_y + icon_size*0.4),
        (center_x - icon_size*0.3, center_y + icon_size*0.3),
    ]
    draw.polygon(parcel_points, fill=(100, 140, 255, 100), outline=(30, 100, 255, 255), width=size//80)
    
    # Add measurement points (corners)
    point_radius = size // 80
    for point in parcel_points:
        draw.ellipse([
            (point[0] - point_radius, point[1] - point_radius),
            (point[0] + point_radius, point[1] + point_radius)
        ], fill=(30, 100, 255, 255))
    
    # Add dimension lines
    draw.line([parcel_points[0], parcel_points[1]], fill=(30, 100, 255, 150), width=size//150)
    draw.line([parcel_points[1], parcel_points[2]], fill=(30, 100, 255, 150), width=size//150)
    
    # File extension label at bottom
    try:
        # Try to use a system font
        font_size = size // 10
        font = ImageFont.truetype("arial.ttf", font_size)
    except:
        font = ImageFont.load_default()
    
    # Draw .prcl text
    text = ".prcl"
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    text_x = (size - text_width) // 2
    text_y = size - doc_margin - size // 8
    
    # Text background
    padding = size // 50
    draw.rectangle([
        (text_x - padding, text_y - padding),
        (text_x + text_width + padding, text_y + text_height + padding)
    ], fill=(30, 100, 255, 255))
    
    draw.text((text_x, text_y), text, fill='white', font=font)
    
    return img

def create_ico_from_image(img, output_path):
    """Convert PIL Image to .ico with multiple sizes"""
    sizes = [(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)]
    icons = []
    for size in sizes:
        resized = img.resize(size, Image.Resampling.LANCZOS)
        icons.append(resized)
    icons[0].save(output_path, format='ICO', sizes=[(s[0], s[1]) for s in sizes])

def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    build_dir = os.path.join(script_dir, 'build')
    
    # Create build directory if it doesn't exist
    os.makedirs(build_dir, exist_ok=True)
    
    print("Creating professional icons for Parcel Tools...")
    print()
    
    # Create App Icon
    print("Creating app icon (theodolite/surveying instrument)...")
    app_icon = create_app_icon(512)
    app_icon_png = os.path.join(build_dir, 'app-icon.png')
    app_icon_ico = os.path.join(build_dir, 'app-icon.ico')
    app_icon.save(app_icon_png, 'PNG')
    create_ico_from_image(app_icon, app_icon_ico)
    print(f"   [OK] Saved: {app_icon_png}")
    print(f"   [OK] Saved: {app_icon_ico}")
    print()
    
    # Create File Icon
    print("Creating file icon (document with parcel symbol)...")
    file_icon = create_file_icon(512)
    file_icon_png = os.path.join(build_dir, 'file-icon.png')
    file_icon_ico = os.path.join(build_dir, 'file-icon.ico')
    file_icon.save(file_icon_png, 'PNG')
    create_ico_from_image(file_icon, file_icon_ico)
    print(f"   [OK] Saved: {file_icon_png}")
    print(f"   [OK] Saved: {file_icon_ico}")
    print()
    
    # Also update the old icon.png/ico for backwards compatibility
    print("Updating main icon files...")
    app_icon.save(os.path.join(build_dir, 'icon.png'), 'PNG')
    create_ico_from_image(app_icon, os.path.join(build_dir, 'icon.ico'))
    print(f"   [OK] Updated: build/icon.png and build/icon.ico")
    print()
    
    print("All icons created successfully!")
    print()
    print("Next steps:")
    print("1. Check the icons in the 'build' folder")
    print("2. Update package.json to use file-icon.ico for .prcl files")
    print("3. Rebuild the app with: npm run electron:build")

if __name__ == "__main__":
    main()

