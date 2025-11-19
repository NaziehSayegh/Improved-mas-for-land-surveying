"""
Create professional screenshots/mockups for the Parcel Tools website
"""

from PIL import Image, ImageDraw, ImageFont
import os

def create_dashboard_screenshot():
    """Create a professional dashboard screenshot mockup"""
    width, height = 1920, 1080
    img = Image.new('RGB', (width, height), '#0d1117')
    draw = ImageDraw.Draw(img)
    
    # Header bar
    draw.rectangle([(0, 0), (width, 80)], fill='#161b22')
    
    # Title
    try:
        title_font = ImageFont.truetype("arial.ttf", 40)
        subtitle_font = ImageFont.truetype("arial.ttf", 24)
        text_font = ImageFont.truetype("arial.ttf", 20)
    except:
        title_font = ImageFont.load_default()
        subtitle_font = ImageFont.load_default()
        text_font = ImageFont.load_default()
    
    draw.text((40, 25), "Parcel Tools", fill='white', font=title_font)
    
    # Navigation tabs
    tabs = ["Dashboard", "Calculator", "Data Files", "Plotting", "Assistant"]
    tab_x = 300
    for tab in tabs:
        if tab == "Dashboard":
            draw.rectangle([(tab_x, 20), (tab_x + 150, 60)], fill='#1f6feb', outline='#58a6ff')
            draw.text((tab_x + 20, 28), tab, fill='white', font=subtitle_font)
        else:
            draw.text((tab_x + 20, 28), tab, fill='#8b949e', font=subtitle_font)
        tab_x += 180
    
    # Main content area - Welcome card
    card_y = 120
    draw.rectangle([(60, card_y), (width - 60, card_y + 200)], fill='#161b22', outline='#30363d', width=2)
    draw.text((100, card_y + 30), "Welcome to Parcel Tools", fill='#58a6ff', font=title_font)
    draw.text((100, card_y + 90), "Professional surveying and mapping desktop application", fill='#8b949e', font=subtitle_font)
    draw.text((100, card_y + 140), "Start by creating a new project or opening an existing one", fill='#8b949e', font=text_font)
    
    # Quick actions cards
    card_y = 360
    cards = [
        ("New Project", "Create a new surveying project", "#238636"),
        ("Open Project", "Open an existing .prcl file", "#1f6feb"),
        ("Calculator", "Calculate parcel areas", "#8957e5"),
        ("Import Points", "Import survey points", "#da3633")
    ]
    
    card_x = 60
    card_width = 440
    card_height = 200
    spacing = 30
    
    for i, (title, desc, color) in enumerate(cards):
        if i == 2:
            card_x = 60
            card_y += card_height + spacing
        
        # Card background
        draw.rectangle(
            [(card_x, card_y), (card_x + card_width, card_y + card_height)],
            fill='#161b22',
            outline=color,
            width=3
        )
        
        # Icon circle
        icon_size = 60
        draw.ellipse(
            [(card_x + 30, card_y + 30), (card_x + 30 + icon_size, card_y + 30 + icon_size)],
            fill=color
        )
        
        # Text
        draw.text((card_x + 30, card_y + 110), title, fill='white', font=subtitle_font)
        draw.text((card_x + 30, card_y + 150), desc, fill='#8b949e', font=text_font)
        
        card_x += card_width + spacing
    
    # Recent files section
    recent_y = card_y + card_height + 60
    draw.text((60, recent_y), "Recent Projects", fill='white', font=title_font)
    
    # Recent file items
    file_y = recent_y + 60
    recent_files = [
        "Survey_Site_A.prcl",
        "Property_Boundary_2024.prcl",
        "Land_Division_Project.prcl"
    ]
    
    for filename in recent_files:
        draw.rectangle(
            [(60, file_y), (width - 60, file_y + 60)],
            fill='#161b22',
            outline='#30363d',
            width=2
        )
        # File icon
        draw.rectangle([(80, file_y + 15), (110, file_y + 45)], fill='#1f6feb')
        # Filename
        draw.text((130, file_y + 18), filename, fill='white', font=subtitle_font)
        file_y += 75
    
    return img

def create_calculator_screenshot():
    """Create a professional calculator screenshot mockup"""
    width, height = 1920, 1080
    img = Image.new('RGB', (width, height), '#0d1117')
    draw = ImageDraw.Draw(img)
    
    # Header bar
    draw.rectangle([(0, 0), (width, 80)], fill='#161b22')
    
    try:
        title_font = ImageFont.truetype("arial.ttf", 40)
        subtitle_font = ImageFont.truetype("arial.ttf", 24)
        text_font = ImageFont.truetype("arial.ttf", 20)
        small_font = ImageFont.truetype("arial.ttf", 16)
    except:
        title_font = ImageFont.load_default()
        subtitle_font = ImageFont.load_default()
        text_font = ImageFont.load_default()
        small_font = ImageFont.load_default()
    
    draw.text((40, 25), "Parcel Tools - Area Calculator", fill='white', font=title_font)
    
    # Left panel - Input area
    left_panel_width = 600
    draw.rectangle([(0, 80), (left_panel_width, height)], fill='#0d1117')
    draw.text((30, 100), "Survey Points", fill='#58a6ff', font=subtitle_font)
    
    # Points table header
    table_y = 150
    draw.rectangle([(30, table_y), (left_panel_width - 30, table_y + 50)], fill='#161b22')
    draw.text((50, table_y + 15), "Point", fill='white', font=text_font)
    draw.text((150, table_y + 15), "X (East)", fill='white', font=text_font)
    draw.text((300, table_y + 15), "Y (North)", fill='white', font=text_font)
    draw.text((450, table_y + 15), "Type", fill='white', font=text_font)
    
    # Sample points
    points = [
        ("1", "1000.00", "2000.00", "Line"),
        ("2", "1050.25", "2100.50", "Line"),
        ("3", "1100.75", "2050.25", "Arc"),
        ("4", "1025.50", "1975.00", "Line"),
    ]
    
    row_y = table_y + 50
    for point, x, y, type_str in points:
        draw.rectangle([(30, row_y), (left_panel_width - 30, row_y + 45)], fill='#0d1117', outline='#30363d')
        draw.text((50, row_y + 12), point, fill='#8b949e', font=text_font)
        draw.text((150, row_y + 12), x, fill='white', font=text_font)
        draw.text((300, row_y + 12), y, fill='white', font=text_font)
        draw.text((450, row_y + 12), type_str, fill='#58a6ff', font=text_font)
        row_y += 45
    
    # Add point button
    draw.rectangle([(30, row_y + 20), (250, row_y + 70)], fill='#238636', outline='#2ea043')
    draw.text((80, row_y + 35), "+ Add Point", fill='white', font=subtitle_font)
    
    # Calculate button
    draw.rectangle([(270, row_y + 20), (left_panel_width - 30, row_y + 70)], fill='#1f6feb', outline='#58a6ff')
    draw.text((350, row_y + 35), "Calculate Area", fill='white', font=subtitle_font)
    
    # Results panel
    results_y = row_y + 120
    draw.rectangle([(30, results_y), (left_panel_width - 30, results_y + 200)], fill='#161b22', outline='#30363d', width=2)
    draw.text((50, results_y + 20), "Calculation Results", fill='#58a6ff', font=subtitle_font)
    draw.text((50, results_y + 70), "Area:", fill='#8b949e', font=text_font)
    draw.text((200, results_y + 70), "2,547.85 m²", fill='white', font=title_font)
    draw.text((50, results_y + 120), "Perimeter:", fill='#8b949e', font=text_font)
    draw.text((200, results_y + 120), "215.75 m", fill='white', font=subtitle_font)
    
    # Right panel - Plot visualization
    plot_x = left_panel_width + 40
    draw.text((plot_x, 100), "Plot Visualization", fill='#58a6ff', font=subtitle_font)
    
    # Plot area
    plot_margin = 60
    plot_area = [(plot_x, 160), (width - 40, height - 40)]
    draw.rectangle(plot_area, fill='#161b22', outline='#30363d', width=2)
    
    # Grid lines
    grid_color = '#21262d'
    for i in range(5):
        # Vertical lines
        x = plot_area[0][0] + (plot_area[1][0] - plot_area[0][0]) * i // 4
        draw.line([(x, plot_area[0][1]), (x, plot_area[1][1])], fill=grid_color, width=1)
        # Horizontal lines
        y = plot_area[0][1] + (plot_area[1][1] - plot_area[0][1]) * i // 4
        draw.line([(plot_area[0][0], y), (plot_area[1][0], y)], fill=grid_color, width=1)
    
    # Draw sample parcel
    center_x = (plot_area[0][0] + plot_area[1][0]) // 2
    center_y = (plot_area[0][1] + plot_area[1][1]) // 2
    parcel_size = 300
    
    parcel_points = [
        (center_x - parcel_size//2, center_y - parcel_size//3),
        (center_x + parcel_size//2, center_y - parcel_size//2),
        (center_x + parcel_size//3, center_y + parcel_size//2),
        (center_x - parcel_size//3, center_y + parcel_size//3)
    ]
    
    # Fill parcel
    draw.polygon(parcel_points, fill='#1f6feb' + '40', outline='#58a6ff', width=3)
    
    # Draw points
    for px, py in parcel_points:
        draw.ellipse([(px-8, py-8), (px+8, py+8)], fill='#58a6ff')
    
    return img

def main():
    print("Creating professional screenshots for Parcel Tools website...")
    print()
    
    # Create screenshots directory
    os.makedirs('screenshots', exist_ok=True)
    
    # Create dashboard screenshot
    print("Creating dashboard screenshot...")
    dashboard = create_dashboard_screenshot()
    dashboard.save('screenshot-dashboard.png', 'PNG')
    print("   [OK] Saved: screenshot-dashboard.png")
    
    # Create calculator screenshot
    print("Creating calculator screenshot...")
    calculator = create_calculator_screenshot()
    calculator.save('screenshot-calculator.png', 'PNG')
    print("   [OK] Saved: screenshot-calculator.png")
    
    print()
    print("All screenshots created successfully!")
    print()
    print("Files created:")
    print("- screenshot-dashboard.png (1920x1080)")
    print("- screenshot-calculator.png (1920x1080)")
    print()
    print("These screenshots are now ready to use in your website!")

if __name__ == "__main__":
    main()

