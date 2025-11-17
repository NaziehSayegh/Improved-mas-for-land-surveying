import tkinter as tk
from tkinter import ttk, messagebox, filedialog, simpledialog
import os
import json
import shutil
import subprocess
import sys
import ctypes
import datetime
import re
import random
import math

# Per-widget key handling that avoids repeats and cross-screen interference

# Global key installer

def _install_keymap(root, keymap):
    # Unbind existing handlers safely
    root.unbind_all('<KeyRelease>')
    
    def _handler(event):
        ch = event.char if hasattr(event, 'char') else ''
        sym = event.keysym if hasattr(event, 'keysym') else ''
        func = keymap.get(ch) or keymap.get(sym)
        if func and callable(func):
            func()
    root.bind_all('<KeyRelease>', _handler)

# Points file helpers

def pick_points_file(parent=None):
    try:
        return filedialog.askopenfilename(
            parent=parent,
            title='Select Points File',
            filetypes=(("Points Files", "*.pnt;*.txt;*.csv"), ("All Files", "*.*")),
        )
    except Exception:
        return ''


def read_points_any(path):
    """Read points from .pnt/.txt/.csv files. Returns dict: id -> (x, y)."""
    pts = {}
    with open(path, 'r', encoding='utf-8', errors='ignore') as f:
        for raw in f:
            line = raw.strip()
            if not line or line.startswith('#') or line.startswith('//'):
                continue
            line = line.replace(';', ',')
            parts = [p.strip() for p in (line.split(',') if ',' in line else line.split()) if p.strip()]
            if len(parts) < 3:
                continue
            pid = parts[0]
            try:
                x = float(parts[1]); y = float(parts[2])
            except Exception:
                continue
            pts[pid] = (x, y)
    if not pts:
        raise ValueError('No points parsed from file')
    return pts

# Animated background icons for surveying/parcel measurement theme

def add_background_icons(parent):
    """Background icons disabled by user preference."""
    return

def start_global_background_icons(root):
    """Show animated surveying icons as background on the main window."""
    try:
        if getattr(root, '_overlay_icons_started', False):
            return
        
        # Build icons as Labels directly on the root window
        icons = ["🧭", "📏", "📐", "🛰️", "📍", "📊", "🔍", "⚡"]
        labels = []
        for ico in icons:
            lbl = tk.Label(
                root,
                text=ico,
                font=("Segoe UI Emoji", 32),
                foreground="#58a6ff",
                background="#0d1117",  # Match app background
                bd=0,
                relief='flat',
            )
            labels.append(lbl)
        
        print(f"Created {len(labels)} background icons on main window")

        # Animation state
        positions = []
        directions = []
        speeds = []
        running = {'on': True}

        def _init_positions():
            try:
                w = root.winfo_width()
                h = root.winfo_height()
                print(f"Window size: {w}x{h}")
                if w <= 1 or h <= 1:
                    root.after(120, _init_positions)
                    return
                positions.clear(); directions.clear(); speeds.clear()
                
                # Place icons in safe corner areas
                corners = [
                    (20, 20), (w-60, 20), (20, h-60), (w-60, h-60),
                    (w//4, 20), (3*w//4, 20), (20, h//2), (w-60, h//2)
                ]
                
                for i, lbl in enumerate(labels):
                    if i < len(corners):
                        x, y = corners[i]
                    else:
                        x, y = 20 + (i % 4) * 100, 20 + (i // 4) * 100
                    positions.append([x, y])
                    directions.append([random.choice([-1, 1]), random.choice([-1, 1])])
                    speeds.append(random.uniform(0.5, 1.2))
                    lbl.place(x=x, y=y)
                    lbl.lower()  # Keep behind other widgets
                    print(f"Placed icon {i} ({icons[i]}) at ({x}, {y})")
            except Exception as e:
                print(f"Error in _init_positions: {e}")

        def _animate():
            if not running['on']:
                return
            try:
                w = root.winfo_width()
                h = root.winfo_height()
                
                for i, lbl in enumerate(labels):
                    if i >= len(positions):
                        continue
                    pos = positions[i]
                    dirc = directions[i]
                    spd = speeds[i]
                    
                    # Update position
                    pos[0] += dirc[0] * spd
                    pos[1] += dirc[1] * spd
                    
                    # Bounce off edges
                    if pos[0] <= 10 or pos[0] >= w - 50:
                        dirc[0] *= -1
                    if pos[1] <= 10 or pos[1] >= h - 50:
                        dirc[1] *= -1
                    
                    # Keep within bounds
                    pos[0] = max(10, min(pos[0], w - 50))
                    pos[1] = max(10, min(pos[1], h - 50))
                    
                    # Update position and keep behind other widgets
                    lbl.place(x=pos[0], y=pos[1])
                    lbl.lower()
                    
            except Exception as e:
                print(f"Animation error: {e}")
            root.after(80, _animate)

        # Start animation
        root.after(300, _init_positions)
        root.after(500, _animate)

        def _cleanup(*_):
            running['on'] = False
            for lbl in labels:
                try:
                    lbl.destroy()
                except Exception:
                    pass

        root.bind('<Destroy>', _cleanup)
        root._overlay_icons_started = True
        print("Background icons system started")
        
    except Exception as e:
        print(f"Error starting background icons: {e}")

# Fullscreen toggle (F11) for a better full-screen experience

def install_fullscreen_toggle(root):
    state = {'on': False, 'geom': None}
    def toggle():
        try:
            if not state['on']:
                state['geom'] = root.geometry()
                root.attributes('-fullscreen', True)
                state['on'] = True
            else:
                root.attributes('-fullscreen', False)
                if state['geom']:
                    root.geometry(state['geom'])
                state['on'] = False
        except Exception:
            pass
    root.bind_all('<F11>', lambda e: toggle())

# Shared page scaffold: title, centered card panel, footer with back button
# It auto-adjusts panel width for full screen while keeping a max width for readability

def build_page_scaffold(master, title_text, back_text='↩  MAIN MENU', back_cmd=None, left_hint='Esc  Main Menu'):
    # Ultra-modern container with premium background
    container = tk.Frame(master, bg='#0d1117')
    container.pack(fill=tk.BOTH, expand=True, padx=32, pady=32)
    
    # Configure container to properly distribute space
    container.columnconfigure(0, weight=1)
    container.rowconfigure(1, weight=1)  # Make the content area expandable

    # Modern title with premium styling and card effect
    title_frame = tk.Frame(container, bg='#161b22', relief='solid', bd=1)
    title_frame.grid(row=0, column=0, pady=(0, 32), sticky='ew', padx=16)
    
    # Main title with modern typography
    title = tk.Label(title_frame, text=title_text, 
                    font=("Segoe UI", 24, "bold"), 
                    fg='#58a6ff', bg='#161b22')
    title.pack(anchor='center', pady=(16, 8))
    
    # Optional subtitle for context
    if 'DATA FILES' in title_text:
        subtitle = tk.Label(title_frame, text="Manage Projects & Points", 
                           font=("Segoe UI", 14, "normal"), 
                           fg='#8b949e', bg='#161b22')
        subtitle.pack(anchor='center', pady=(0, 16))
    elif 'WORK MODE' in title_text:
        subtitle = tk.Label(title_frame, text="Configure Survey Settings", 
                           font=("Segoe UI", 14, "normal"), 
                           fg='#8b949e', bg='#161b22')
        subtitle.pack(anchor='center', pady=(0, 16))

    # Ultra-modern content area with glass effect
    content_area = tk.Frame(container, bg='#0d1117')
    content_area.grid(row=1, column=0, sticky='nsew', pady=(0, 32))
    content_area.columnconfigure(0, weight=1)
    content_area.rowconfigure(0, weight=1)

    # Modern panel with elevated styling and card effect
    panel = tk.Frame(content_area, bg='#161b22', relief='solid', bd=1)
    panel.grid(row=0, column=0, sticky='nsew', padx=32)
    panel.columnconfigure(0, weight=1)

    # Ultra-modern footer with premium styling
    footer = tk.Frame(container, bg='#0d1117')
    footer.grid(row=2, column=0, sticky='ew')
    if back_cmd is not None:
        back_btn = ttk.Button(footer, text=back_text, style='Primary.TButton', command=back_cmd)
        back_btn.pack(side=tk.RIGHT, padx=(0, 16))
    if left_hint:
        hint_label = tk.Label(footer, text=left_hint, 
                            fg="#8b949e", bg='#0d1117',
                            font=('Segoe UI', 11, 'normal'))
        hint_label.pack(side=tk.LEFT, padx=(16, 0))
    
    # Add animated background icons to this page (same parent as buttons)
    add_background_icons(panel)

    # Keyboard: ESC uses the provided back_cmd (which should go to previous page)
    if back_cmd is not None:
        try:
            container.bind_all('<Escape>', lambda e: back_cmd())
        except Exception:
            pass

    # Make responsive to window resizing
    def on_window_resize(event=None):
        try:
            # Get current window size
            window_width = master.winfo_width()
            window_height = master.winfo_height()
            
            # Adjust title font and panel padding based on window size
            if window_width < 600:
                title_font = ("Segoe UI", 18, "bold")
                panel_padding = (16, 12)
            elif window_width < 900:
                title_font = ("Segoe UI", 20, "bold")
                panel_padding = (20, 16)
            else:
                title_font = ("Segoe UI", 22, "bold")
                panel_padding = (24, 20)
            
            # Update title font and panel padding
            title.configure(font=title_font)
            panel.configure(padx=panel_padding[0], pady=panel_padding[1])
            
            # Adjust vertical spacing based on window height
            if window_height < 600:
                title.grid_configure(pady=(0,10))
                content_area.grid_configure(pady=(0,10))
            elif window_height > 800:
                title.grid_configure(pady=(0,30))
                content_area.grid_configure(pady=(0,20))
            else:
                title.grid_configure(pady=(0,20))
                content_area.grid_configure(pady=(0,20))
            
        except Exception:
            pass
    
    # Bind resize event and call once to set initial size
    master.bind('<Configure>', on_window_resize)
    master.after(50, on_window_resize)

    # Install fullscreen toggle
    install_fullscreen_toggle(master)

    return panel, footer, container

class MainMenu:
    def __init__(self, master):
        self.master = master
        self.master.title("Parcel Tools - Main Menu")
        # Apply dark theme similar to the editor
        style = ttk.Style(master)
        if hasattr(style, 'theme_names') and 'parceldark' in style.theme_names():
            style.theme_use('parceldark')
        else:
            style.theme_use('clam')
            bg = '#0d1117'
            surface = '#161b22'
            surface_alt = '#21262d'
            text = '#f0f6fc'
            style.configure('TFrame', background=bg)
            style.configure('TLabel', background=bg, foreground=text)
            style.configure('MenuLarge.TButton', background=surface_alt, foreground=text, padding=(16,10), font=('Segoe UI Semibold', 13))
            style.map('MenuLarge.TButton', background=[('active', '#30363d')])

        if hasattr(master, 'configure'):
            master.configure(background='#0a0e13')

        # Modern container with premium background
        container = tk.Frame(master, bg='#0a0e13')
        container.pack(fill=tk.BOTH, expand=True, padx=24, pady=24)
        # Title
        try:
            title_font = ('Inter', 16, 'bold')
        except Exception:
            title_font = ("Segoe UI Semibold", 16)
        # Ultra-modern title with premium styling
        title_frame = tk.Frame(container, bg='#0d1117')
        title_frame.pack(anchor='center', pady=(0, 32))
        
        # Main title with modern typography and glow effect
        title_label = tk.Label(title_frame, text="📐 PARCEL TOOLS", 
                              font=('Segoe UI', 28, 'bold'), 
                              fg='#58a6ff', bg='#0d1117')
        title_label.pack(anchor='center')
        
        # Subtitle with modern styling
        subtitle_label = tk.Label(title_frame, text="Professional Surveying & Mapping Software", 
                                 font=('Segoe UI', 14, 'normal'), 
                                 fg='#8b949e', bg='#0d1117')
        subtitle_label.pack(anchor='center', pady=(8, 0))
        
        # Version badge
        version_label = tk.Label(title_frame, text="v2.0 Premium", 
                               font=('Segoe UI', 10, 'normal'), 
                               fg='#3fb950', bg='#0d1117')
        version_label.pack(anchor='center', pady=(4, 0))

        # Modern grid with premium background
        grid = tk.Frame(container, bg='#0a0e13')
        grid.pack(fill=tk.BOTH, expand=True)
        for c in range(2):
            grid.columnconfigure(c, weight=1, uniform='cols')
        for r in range(5):
            grid.rowconfigure(r, weight=1)

        # Styled large menu buttons - responsive sizing
        # Ensure our large dark buttons style exists even if theme load failed
        try:
            s2 = ttk.Style(master)
            
            # Get screen dimensions for responsive sizing
            screen_width = master.winfo_screenwidth()
            screen_height = master.winfo_screenheight()
            
            if screen_width < 800:  # Small screens
                button_padding = (12, 8)
                button_font = ('Segoe UI Semibold', 11)
                button_padx = 12
                button_pady = 8
            elif screen_width < 1200:  # Medium screens
                button_padding = (16, 10)
                button_font = ('Segoe UI Semibold', 13)
                button_padx = 18
                button_pady = 10
            else:  # Large screens
                button_padding = (20, 12)
                button_font = ('Segoe UI Semibold', 15)
                button_padx = 24
                button_pady = 12
            
            # Ultra-modern button styling with premium colors and effects
            s2.configure('MenuLarge.TButton', 
                        padding=button_padding, 
                        font=button_font,
                        background='#21262d',
                        foreground='#f0f6fc',
                        relief='flat',
                        borderwidth=1)
            s2.map('MenuLarge.TButton', 
                  background=[('active', '#30363d'), ('pressed', '#161b22')],
                  bordercolor=[('active', '#58a6ff'), ('!active', '#30363d')])
        except Exception:
            button_padx = 18
            button_pady = 10

        # Modern menu options with icons
        options_left = [
            (1, '⚙️ WORK MODE'), 
            (3, '📐 POLAR'), 
            (5, '⭕ CIRCLE'), 
            (7, '🌱 IMPLANTATIONS'), 
            (9, '📊 PLOTTING')
        ]
        options_right = [
            (2, '📁 DATA FILES'), 
            (4, '📏 OFFSETS'), 
            (6, '🔗 INTERSECTIONS'), 
            (8, '📐 AREA'), 
            (0, '🖥️ PLAN ON SCREEN')
        ]

        def make_text(n, label):
            return f"{n}   {label}"

        # Set consistent button width for main menu
        main_button_width = 20  # characters width for main menu buttons

        self.buttons = []
        for r, (n, label) in enumerate(options_left):
            b = ttk.Button(grid, text=make_text(n, label), style='MenuLarge.TButton', command=lambda nn=n: self.on_select(nn), width=main_button_width)
            b.grid(row=r, column=0, padx=button_padx, pady=button_pady)
            self.buttons.append(b)
        for r, (n, label) in enumerate(options_right):
            b = ttk.Button(grid, text=make_text(n, label), style='MenuLarge.TButton', command=lambda nn=n: self.on_select(nn), width=main_button_width)
            b.grid(row=r, column=1, padx=button_padx, pady=button_pady)
            self.buttons.append(b)

        # Key bindings 0-9
        keymap = {str(i): (lambda n=i: self.on_select(n)) for i in range(10)}
        # Do not exit on ESC in main menu
        keymap['Escape'] = (lambda: None)
        _install_keymap(container, keymap)

        # Footer hint with transparent background
        footer_label = tk.Label(container, text="Ctrl+X  Exit", fg='#7d8590', bg='#0d1117')
        footer_label.pack(anchor='w', pady=(12,0))
        self.master.bind_all('<Control-x>', lambda e: self.master.quit())
        
        # Add animated background icons to the same grid that holds buttons
        add_background_icons(grid)

        # Cached context from previous screens (if any)
        self.ctx = getattr(self.master, '_app_ctx', None)

        # Show project badge if any
        try:
            ctx = getattr(self.master, '_app_ctx', None)
            if ctx and ctx.get('project_path'):
                project_name = os.path.splitext(os.path.basename(ctx['project_path']))[0]
                badge_text = f"Project: {project_name}"
            else:
                badge_text = "Project: (none)"
            
            # Create badge label directly
            badge = tk.Label(self.master, text=badge_text, fg='#7d8590', bg='#0d1117', 
                           font=('Segoe UI', 9), bd=0, padx=6, pady=2)
            badge.place(relx=1.0, y=6, x=-8, anchor='ne')
            self.master._file_badge_label = badge
        except Exception:
            pass

    def on_select(self, number):
        if number == 1:  # WORK MODE
            for i in range(10):
                try:
                    self.master.unbind(str(i))
                except Exception:
                    pass
            for w in self.master.winfo_children():
                w.destroy()
            WorkModeScreen(self.master)
        elif number == 2:  # DATA FILES menu
            for i in range(10):
                try:
                    self.master.unbind(str(i))
                except Exception:
                    pass
            for w in self.master.winfo_children():
                w.destroy()
            DataFilesScreen(self.master)
        elif number == 8:  # AREA (open calculator UI directly)
            # Replace content with the calculator UI
            # Remove ALL menu keybindings so typing numbers doesn't trigger dialogs in other screens
            try:
                # Clear all number key bindings (0-9)
                for i in range(10):
                    self.master.unbind_all(str(i))
                # Clear KeyRelease bindings
                self.master.unbind_all('<KeyRelease>')
                # Clear any other conflicting bindings
                self.master.unbind_all('<Control-x>')
            except Exception:
                pass
            
            for w in self.master.winfo_children():
                w.destroy()
            # Continue with context if available
            ctx = getattr(self.master, '_app_ctx', None)
            if ctx and ctx.get('project_path') and ctx.get('state'):
                ParcelAreaApp(self.master, project_path=ctx['project_path'], project_state=ctx['state'])
            else:
                ParcelAreaApp(self.master)
        elif number == 0:  # PLAN ON SCREEN (placeholder)
            messagebox.showinfo("Plan on Screen", "This feature will be configured next.")
        else:
            messagebox.showinfo("Not Implemented", f"Option {number} is not implemented yet.")


class WorkModeScreen:
    def __init__(self, master):
        self.master = master
        self.master.title("Work Mode")
        try:
            style = ttk.Style(master)
            if 'parceldark' in style.theme_names():
                style.theme_use('parceldark')
        except Exception:
            pass

        # Load settings from global context
        settings = getattr(self.master, '_work_settings', {'unit': 'Degrees', 'vertical': '90', 'printing': 'Yes'})
        self.unit_var = tk.StringVar(value=settings.get('unit', 'Degrees'))
        self.vertical_var = tk.StringVar(value=settings.get('vertical', '90'))
        self.printing_var = tk.StringVar(value=settings.get('printing', 'Yes'))

        # Styled small menu buttons - responsive sizing
        try:
            style = ttk.Style(self.master)
            
            # Get screen width for responsive button sizing
            screen_width = self.master.winfo_screenwidth()
            if screen_width < 800:  # Small screens
                button_padding = (8, 8)
                button_font = ('Consolas', 10, 'bold')
            elif screen_width < 1200:  # Medium screens
                button_padding = (12, 10)
                button_font = ('Consolas', 12, 'bold')
            else:  # Large screens
                button_padding = (16, 12)
                button_font = ('Consolas', 14, 'bold')
            
            style.configure('MenuSmall.TButton', 
                          padding=button_padding, 
                          font=button_font, 
                          foreground='#f0f6fc', 
                          background='#21262d')
            style.map('MenuSmall.TButton', background=[('active', '#30363d')])
        except Exception:
            pass

        panel, footer, container = build_page_scaffold(self.master, "WORK  MODE", back_cmd=self.back_to_menu)
        
        # Show project badge on Work Mode screen
        try:
            ctx = getattr(self.master, '_app_ctx', None)
            if ctx and ctx.get('project_path'):
                project_name = os.path.splitext(os.path.basename(ctx['project_path']))[0]
                badge_text = f"Project: {project_name}"
            else:
                badge_text = "Project: (none)"
            
            badge = tk.Label(self.master, text=badge_text, fg='#7d8590', bg='#0d1117', 
                           font=('Segoe UI', 9), bd=0, padx=6, pady=2)
            badge.place(relx=1.0, y=6, x=-8, anchor='ne')
            self.master._file_badge_label = badge
        except Exception:
            pass

        # Create vertical button layout that responds to window size
        def update_button_layout():
            window_width = self.master.winfo_width() if hasattr(self.master, 'winfo_width') else 800
            window_height = self.master.winfo_height() if hasattr(self.master, 'winfo_height') else 600
            
            # Adjust button size and spacing based on window size
            if window_width < 600:  # Small window
                button_font = ('Consolas', 10, 'bold')
                button_padding = (8, 6)
                button_pady = 4
            elif window_width < 900:  # Medium window
                button_font = ('Consolas', 12, 'bold')
                button_padding = (12, 8)
                button_pady = 6
            else:  # Large window
                button_font = ('Consolas', 14, 'bold')
                button_padding = (16, 10)
                button_pady = 8
            
            # Update button style
            style = ttk.Style(self.master)
            style.configure('MenuSmall.TButton', 
                          padding=button_padding, 
                          font=button_font, 
                          foreground='#f0f6fc', 
                          background='#21262d')
            
            return button_pady
        
        button_pady = update_button_layout()
        
        # Center the buttons and distribute vertical space evenly
        panel.columnconfigure(0, weight=1)
        panel.columnconfigure(1, weight=0)
        panel.columnconfigure(2, weight=1)
        
        # Make rows expand to fill vertical space
        for i in range(3):
            panel.rowconfigure(i, weight=1)
        
        # Set consistent button width for all buttons
        button_width = 25  # characters width
        
        self.btn1 = ttk.Button(panel, text="1  ANGULAR     DEGREES", style='MenuSmall.TButton', command=self.toggle_unit, width=button_width)
        self.btn1.grid(row=0, column=1, pady=button_pady, padx=20)
        self.btn2 = ttk.Button(panel, text="2  VERTICAL    90", style='MenuSmall.TButton', command=self.edit_vertical, width=button_width)
        self.btn2.grid(row=1, column=1, pady=button_pady, padx=20)
        self.btn3 = ttk.Button(panel, text="3  PRINTING    YES", style='MenuSmall.TButton', command=self.toggle_printing, width=button_width)
        self.btn3.grid(row=2, column=1, pady=button_pady, padx=20)
        
        # Update layout when window is resized
        def on_resize(event=None):
            if event and event.widget == self.master:
                update_button_layout()  # This updates the button style
        
        self.master.bind('<Configure>', on_resize)

        # Defer text setup to ensure widget styles applied
        self.master.after(0, self._refresh_texts)

        _install_keymap(panel, {
            'Escape': self.back_to_menu,
            '1': self.toggle_unit,
            '2': self.edit_vertical,
            '3': self.toggle_printing,
        })

    def toggle_unit(self):
        self.unit_var.set('Grades' if self.unit_var.get() == 'Degrees' else 'Degrees')
        self._refresh_texts()

    def toggle_printing(self):
        self.printing_var.set('No' if self.printing_var.get() == 'Yes' else 'Yes')
        self._refresh_texts()

    def _refresh_texts(self):
        if hasattr(self, 'btn1') and self.btn1:
            self.btn1.configure(text=f"1  ANGULAR     {self.unit_var.get().upper()}")
        if hasattr(self, 'btn2') and self.btn2:
            self.btn2.configure(text=f"2  VERTICAL    {self.vertical_var.get()}")
        if hasattr(self, 'btn3') and self.btn3:
            self.btn3.configure(text=f"3  PRINTING    {self.printing_var.get().upper()}")

    def edit_vertical(self):
        new_val = simpledialog.askstring("Vertical", "Set vertical angle:", initialvalue=self.vertical_var.get(), parent=self.master)
        if new_val is None:
            return
        # Simple validation - check if it's a number
        if new_val.replace('.', '').replace('-', '').isdigit():
            self.vertical_var.set(new_val)
            self._refresh_texts()
            self._save_settings()

    def _save_settings(self):
        """Save current work mode settings to global context."""
        try:
            self.master._work_settings = {
                'unit': self.unit_var.get(),
                'vertical': self.vertical_var.get(),
                'printing': self.printing_var.get()
            }
        except Exception:
            pass

    def _validate_angle(self, val):
        if val == '':
            return True
        if val.replace('.', '').replace('-', '').isdigit():
            return True
        return False

    def back_to_menu(self):
        # Save settings before leaving Work Mode
        self._save_settings()
        for w in self.master.winfo_children():
            w.destroy()
        MainMenu(self.master)


class DataFilesScreen:
    def __init__(self, master):
        self.master = master
        self.master.title("Data Files")
        try:
            style = ttk.Style(master)
            if 'parceldark' in style.theme_names():
                style.theme_use('parceldark')
            
            # Get screen width for responsive button sizing
            screen_width = self.master.winfo_screenwidth()
            if screen_width < 800:  # Small screens
                button_padding = (8, 8)
                button_font = ('Consolas', 10, 'bold')
            elif screen_width < 1200:  # Medium screens
                button_padding = (12, 10)
                button_font = ('Consolas', 12, 'bold')
            else:  # Large screens
                button_padding = (16, 12)
                button_font = ('Consolas', 14, 'bold')
                
            style.configure('MenuSmall.TButton', 
                          padding=button_padding, 
                          font=button_font, 
                          foreground='#f0f6fc', 
                          background='#21262d')
            style.map('MenuSmall.TButton', background=[('active', '#30363d')])
        except Exception:
            pass

        panel, footer, container = build_page_scaffold(self.master, "DATA  FILES", back_cmd=self.back_to_menu)
        
        # Show project badge on Data Files screen
        try:
            ctx = getattr(self.master, '_app_ctx', None)
            if ctx and ctx.get('project_path'):
                project_name = os.path.splitext(os.path.basename(ctx['project_path']))[0]
                badge_text = f"Project: {project_name}"
            else:
                badge_text = "Project: (none)"
            
            badge = tk.Label(self.master, text=badge_text, fg='#7d8590', bg='#0d1117', 
                           font=('Segoe UI', 9), bd=0, padx=6, pady=2)
            badge.place(relx=1.0, y=6, x=-8, anchor='ne')
            self.master._file_badge_label = badge
        except Exception:
            pass

        # Create vertical button layout that responds to window size
        def update_button_layout():
            try:
                window_width = self.master.winfo_width()
                window_height = self.master.winfo_height()
                
                # Adjust button size and spacing based on window size
                if window_width < 600:  # Small window
                    button_font = ('Consolas', 10, 'bold')
                    button_padding = (8, 6)
                    button_pady = 3
                elif window_width < 900:  # Medium window
                    button_font = ('Consolas', 12, 'bold')
                    button_padding = (12, 8)
                    button_pady = 4
                else:  # Large window
                    button_font = ('Consolas', 14, 'bold')
                    button_padding = (16, 10)
                    button_pady = 6
                
                # Update button style
                style = ttk.Style(self.master)
                style.configure('MenuSmall.TButton', 
                              padding=button_padding, 
                              font=button_font, 
                              foreground='#f0f6fc', 
                              background='#21262d')
                
                return button_pady
            except Exception:
                return 4
        
        button_pady = update_button_layout()

        # Center the buttons and distribute vertical space evenly
        panel.columnconfigure(0, weight=1)
        panel.columnconfigure(1, weight=0)
        panel.columnconfigure(2, weight=1)
        
        # Make rows expand to fill vertical space
        for i in range(5):
            panel.rowconfigure(i, weight=1)

        # Set consistent button width for all buttons
        button_width = 25  # characters width
        
        def add_btn(row, text, cmd):
            b = ttk.Button(panel, text=text, style='MenuSmall.TButton', command=cmd, width=button_width)
            b.grid(row=row, column=1, pady=button_pady, padx=20)
            return b

        self.btns = [
            add_btn(0, "1  OPEN NEW FILE", self.open_new_file),
            add_btn(1, "2  READ OLD FILE", self.read_old_file),
            add_btn(2, "3  POINTS EDITOR", self.add_new_points),
            add_btn(3, "4  MODIFY FILE HEADING", self.modify_file_heading),
            add_btn(4, "5  DATA DISK", self.data_disk),
        ]
        
        # Update layout when window is resized
        def on_resize(event=None):
            if event and event.widget == self.master:
                update_button_layout()  # This updates the button style
        
        self.master.bind('<Configure>', on_resize)

        keymap = {
            '1': self.open_new_file,
            '2': self.read_old_file,
            '3': self.add_new_points,
            '4': self.modify_file_heading,
            '5': self.data_disk,
            'Escape': self.back_to_menu,
        }
        _install_keymap(panel, keymap)


    # Placeholder handlers (wire to real flows later)
    def open_new_file(self):
        """Create a new project by selecting save location and points file."""
        # First, ask where to save the new project
        save_path = filedialog.asksaveasfilename(
            parent=self.master,
            title='Create New Project',
            defaultextension='.parproj',
            filetypes=(("Project Files", "*.parproj"), ("All Files", "*.*"))
        )
        if not save_path:
            # User cancelled - stay on current page
            return
        
        # Then ask for points file to load
        pts_path = pick_points_file(parent=self.master)
        if not pts_path:
            # User cancelled - stay on current page
            return
        
        try:
            # Create project directory
            proj_dir = os.path.dirname(save_path)
            os.makedirs(proj_dir, exist_ok=True)
            
            # Copy points file into project folder
            dst_name = os.path.basename(pts_path)
            dst = os.path.join(proj_dir, dst_name)
            if not os.path.exists(dst):
                shutil.copy2(pts_path, dst)
            
            # Create initial project state
            state = {
                "parcel_number": "",
                "entered_ids": [],
                "points_file": dst_name,
                "parcels": [],
                "curves": [],
                "work_settings": getattr(self.master, '_work_settings', {}),
            }
            
            # Save the project
            save_project(save_path, state)
            
            # Switch to the calculator with the new project
            for w in self.master.winfo_children():
                w.destroy()
            ParcelAreaApp(self.master, project_path=save_path, project_state=state)
            
        except Exception as exc:
            messagebox.showerror("Create Project Error", f"Failed to create new project:\n{exc}")
    def read_old_file(self):
        # Open existing project
        opened = open_project_flow(self.master)
        if opened is None:
            # User cancelled - stay on current page
            return
        
        # User selected a project - proceed to calculator
        for w in self.master.winfo_children():
            w.destroy()
        path, state = opened
        ParcelAreaApp(self.master, project_path=path, project_state=state)
    def add_new_points(self):
        """Open a dialog to add new points to the current points file."""
        # Check if we have a project with points file
        ctx = getattr(self.master, '_app_ctx', None)
        if not ctx or not ctx.get('project_path') or not ctx.get('state', {}).get('points_file'):
            messagebox.showwarning("No Project", "Please open a project with a points file first.")
            return
        
        project_path = ctx['project_path']
        points_file = ctx['state']['points_file']
        proj_dir = os.path.dirname(project_path)
        pts_path = os.path.join(proj_dir, points_file)
        
        if not os.path.exists(pts_path):
            messagebox.showerror("File Not Found", f"Points file not found: {pts_path}")
            return
        
        # Clear ALL existing key bindings before opening Add Points screen
        try:
            for i in range(10):
                self.master.unbind_all(str(i))
            self.master.unbind_all('<Escape>')
            self.master.unbind_all('<KeyRelease>')
        except Exception:
            pass
        
        # Open the Add Points dialog
        for w in self.master.winfo_children():
            w.destroy()
        AddPointsScreen(self.master, pts_path, project_path)
    def delete_old_points(self):
        messagebox.showinfo('Data Files', 'Delete Old Points - to be implemented')
    def modify_old_points(self):
        messagebox.showinfo('Data Files', 'Modify Old Points - to be implemented')
    def modify_file_heading(self):
        """Open dialog to modify the project file heading information."""
        # Check if we have a project
        ctx = getattr(self.master, '_app_ctx', None)
        if not ctx or not ctx.get('project_path'):
            messagebox.showwarning("No Project", "Please open a project first.")
            return
        
        project_path = ctx['project_path']
        
        # Open the File Heading dialog
        for w in self.master.winfo_children():
            w.destroy()
        FileHeadingScreen(self.master, project_path)
    def data_disk(self):
        messagebox.showinfo('Data Files', 'Data Disk - to be implemented')
    def back_to_menu(self):
        for w in self.master.winfo_children():
            w.destroy()
        MainMenu(self.master)


class AddPointsScreen:
    def __init__(self, master, points_file_path, project_path):
        self.master = master
        self.points_file_path = points_file_path
        self.project_path = project_path
        self.master.title("Add New Points")
        
        # Load current points
        try:
            self.points_by_id = read_points_any(points_file_path)
        except Exception:
            self.points_by_id = {}
        
        panel, footer, container = build_page_scaffold(self.master, "ADD NEW POINTS", back_cmd=self.back_to_data_files)
        
        # Show project badge
        try:
            if self.project_path:
                project_name = os.path.splitext(os.path.basename(self.project_path))[0]
                badge_text = f"Project: {project_name}"
            else:
                badge_text = "Project: (none)"
            
            badge = tk.Label(self.master, text=badge_text, fg='#7d8590', bg='#0d1117', 
                           font=('Segoe UI', 9), bd=0, padx=6, pady=2)
            badge.place(relx=1.0, y=6, x=-8, anchor='ne')
            self.master._file_badge_label = badge
        except Exception:
            pass
        
        # Search bar
        search_frame = tk.Frame(panel, bg='#0d1117')
        search_frame.pack(fill=tk.X, pady=(0,8))
        
        tk.Label(search_frame, text="🔍 Search:", fg='#f0f6fc', bg='#0d1117').pack(side=tk.LEFT)
        self.search_var = tk.StringVar()
        self.search_entry = tk.Entry(search_frame, textvariable=self.search_var, width=20, 
                                    bg='#21262d', fg='#f0f6fc', insertbackground='#f0f6fc')
        self.search_entry.pack(side=tk.LEFT, padx=(8,8))
        self.search_entry.bind('<KeyRelease>', lambda e: self._refresh_points_list())
        
        clear_search_btn = tk.Button(search_frame, text="Clear", command=self.on_clear_search,
                                    bg='#21262d', fg='#f0f6fc', relief='flat', padx=8, pady=4)
        clear_search_btn.pack(side=tk.LEFT)
        
        # Entry form for new points
        entry_frame = tk.Frame(panel, bg='#0d1117')
        entry_frame.pack(fill=tk.X, pady=(8,16))
        
        tk.Label(entry_frame, text="Point ID:", fg='#f0f6fc', bg='#0d1117').grid(row=0, column=0, padx=(0,8), pady=4, sticky='w')
        self.id_var = tk.StringVar()
        self.id_entry = tk.Entry(entry_frame, textvariable=self.id_var, width=12, bg='#21262d', fg='#f0f6fc', insertbackground='#f0f6fc')
        self.id_entry.grid(row=0, column=1, padx=4, pady=4)
        
        tk.Label(entry_frame, text="X Coordinate:", fg='#f0f6fc', bg='#0d1117').grid(row=0, column=2, padx=(16,8), pady=4, sticky='w')
        self.x_var = tk.StringVar()
        self.x_entry = tk.Entry(entry_frame, textvariable=self.x_var, width=15, bg='#21262d', fg='#f0f6fc', insertbackground='#f0f6fc')
        self.x_entry.grid(row=0, column=3, padx=4, pady=4)
        
        tk.Label(entry_frame, text="Y Coordinate:", fg='#f0f6fc', bg='#0d1117').grid(row=1, column=0, padx=(0,8), pady=4, sticky='w')
        self.y_var = tk.StringVar()
        self.y_entry = tk.Entry(entry_frame, textvariable=self.y_var, width=15, bg='#21262d', fg='#f0f6fc', insertbackground='#f0f6fc')
        self.y_entry.grid(row=1, column=1, padx=4, pady=4)
        
        # Buttons
        btn_frame = tk.Frame(entry_frame, bg='#0d1117')
        btn_frame.grid(row=1, column=2, columnspan=2, padx=(16,0), pady=4, sticky='w')
        
        add_btn = tk.Button(btn_frame, text="Add Point", command=self.on_add_point, 
                           bg='#238636', fg='#ffffff', relief='flat', padx=12, pady=6)
        add_btn.pack(side=tk.LEFT, padx=(0,8))
        
        clear_btn = tk.Button(btn_frame, text="Clear", command=self.on_clear_form,
                             bg='#21262d', fg='#f0f6fc', relief='flat', padx=12, pady=6)
        clear_btn.pack(side=tk.LEFT)
        
        # Points list
        list_frame = tk.Frame(panel, bg='#0d1117')
        list_frame.pack(fill=tk.BOTH, expand=True)
        
        tk.Label(list_frame, text="Current Points:", fg='#f0f6fc', bg='#0d1117', font=('Segoe UI', 11, 'bold')).pack(anchor='w', pady=(0,8))
        
        # Listbox with scrollbar
        lb_frame = tk.Frame(list_frame, bg='#0d1117')
        lb_frame.pack(fill=tk.BOTH, expand=True)
        
        self.points_listbox = tk.Listbox(lb_frame, height=12, bg='#161b22', fg='#f0f6fc', 
                                        selectbackground='#238636', selectforeground='#ffffff',
                                        font=('Consolas', 9), relief=tk.FLAT, borderwidth=0)
        self.points_listbox.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        
        scrollbar = tk.Scrollbar(lb_frame, orient=tk.VERTICAL, command=self.points_listbox.yview)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
        self.points_listbox.configure(yscrollcommand=scrollbar.set)
        
        # Bottom buttons
        bottom_frame = tk.Frame(list_frame, bg='#0d1117')
        bottom_frame.pack(fill=tk.X, pady=(8,0))
        
        edit_btn = tk.Button(bottom_frame, text="✏️ Edit Selected", command=self.on_edit_selected,
                            bg='#238636', fg='#ffffff', relief='flat', padx=12, pady=6)
        edit_btn.pack(side=tk.LEFT)
        
        delete_btn = tk.Button(bottom_frame, text="🗑️ Delete Selected", command=self.on_delete_point,
                              bg='#da3633', fg='#ffffff', relief='flat', padx=12, pady=6)
        delete_btn.pack(side=tk.LEFT, padx=(8,0))
        
        # Auto-save status
        self.status_label = tk.Label(bottom_frame, text="Changes auto-saved", fg='#7d8590', bg='#0d1117', font=('Segoe UI', 9))
        self.status_label.pack(side=tk.RIGHT)
        
        # Populate the list
        self._refresh_points_list()
        
        # Key bindings
        self.id_entry.bind('<Return>', lambda e: self.x_entry.focus_set())
        self.x_entry.bind('<Return>', lambda e: self.y_entry.focus_set())
        self.y_entry.bind('<Return>', lambda e: self.on_add_point())
        self.points_listbox.bind('<Delete>', lambda e: self.on_delete_point())
        self.points_listbox.bind('<Double-1>', lambda e: self.on_edit_selected())
        
        # Clear any conflicting key bindings from previous screens
        try:
            for i in range(10):
                self.master.unbind_all(str(i))
            self.master.unbind_all('<KeyRelease>')
        except Exception:
            pass
        
        # Set up only ESC to go back to Data Files (previous page)
        try:
            self.master.bind_all('<Escape>', lambda e: self.back_to_data_files())
        except Exception:
            pass
        
        # Focus on first entry
        self.id_entry.focus_set()
    
    def _refresh_points_list(self):
        """Refresh the points listbox display with search filtering and sorting."""
        self.points_listbox.delete(0, tk.END)
        
        # Get search term
        search_term = self.search_var.get().strip().lower()
        
        # Sort points by ID (natural sort for mixed alphanumeric IDs)
        def natural_sort_key(item):
            pid = item[0]
            # Split into numeric and text parts for better sorting
            import re
            parts = re.split(r'(\d+)', pid.lower())
            result = []
            for part in parts:
                if part.isdigit():
                    result.append(int(part))
                else:
                    result.append(part)
            return result
        
        sorted_points = sorted(self.points_by_id.items(), key=natural_sort_key)
        
        # Filter and display points
        for pid, (x, y) in sorted_points:
            # Apply search filter
            if search_term and search_term not in pid.lower():
                continue
            
            self.points_listbox.insert(tk.END, f"{pid:<8} X: {x:>10.3f}  Y: {y:>10.3f}")
    
    def on_clear_search(self):
        """Clear the search field and refresh the list."""
        self.search_var.set("")
        self._refresh_points_list()
    
    def on_add_point(self):
        """Add a new point to the points dictionary."""
        pid = self.id_var.get().strip()
        x_str = self.x_var.get().strip()
        y_str = self.y_var.get().strip()
        
        if not pid:
            messagebox.showwarning("Missing ID", "Please enter a point ID.")
            self.id_entry.focus_set()
            return
        
        try:
            x = float(x_str)
            y = float(y_str)
        except ValueError:
            messagebox.showerror("Invalid Coordinates", "Please enter valid numeric coordinates.")
            self.x_entry.focus_set()
            return
        
        # Check if point already exists
        if pid in self.points_by_id:
            if not messagebox.askyesno("Point Exists", f"Point {pid} already exists. Replace it?"):
                return
        
        # Add/update point
        self.points_by_id[pid] = (x, y)
        self._refresh_points_list()
        self.on_clear_form()
        self.id_entry.focus_set()
        
        # Auto-save to file
        self._auto_save()
    
    def on_clear_form(self):
        """Clear the entry form."""
        self.id_var.set("")
        self.x_var.set("")
        self.y_var.set("")
    
    def on_delete_point(self):
        """Delete the selected point."""
        try:
            sel = self.points_listbox.curselection()
            if not sel:
                return
            idx = sel[0]
            # Extract point ID from the display string
            line = self.points_listbox.get(idx)
            pid = line.split()[0]
            if pid in self.points_by_id:
                if messagebox.askyesno("Delete Point", f"Delete point {pid}?"):
                    del self.points_by_id[pid]
                    self._refresh_points_list()
                    # Auto-save after deletion
                    self._auto_save()
        except Exception:
            pass
    
    def _auto_save(self):
        """Auto-save points to file without user interaction."""
        try:
            # Write points to file in standard format: ID, X, Y
            with open(self.points_file_path, 'w', encoding='utf-8') as f:
                f.write("# Points file - ID, X, Y\n")
                for pid, (x, y) in sorted(self.points_by_id.items()):
                    f.write(f"{pid}, {x:.3f}, {y:.3f}\n")
            
            # Update status quietly
            self.status_label.configure(text=f"Auto-saved ({len(self.points_by_id)} points)")
            
        except Exception as exc:
            self.status_label.configure(text="Auto-save failed")
            print(f"Auto-save error: {exc}")

    def on_edit_selected(self):
        """Load the selected point into the entry form for editing."""
        try:
            sel = self.points_listbox.curselection()
            if not sel:
                return
            idx = sel[0]
            # Extract point data from the display string
            line = self.points_listbox.get(idx)
            parts = line.split()
            pid = parts[0]
            
            if pid in self.points_by_id:
                x, y = self.points_by_id[pid]
                # Fill the form with current values
                self.id_var.set(pid)
                self.x_var.set(str(x))
                self.y_var.set(str(y))
                # Focus on X coordinate for quick editing
                self.x_entry.focus_set()
                self.x_entry.select_range(0, tk.END)
        except Exception:
            pass
    
    def back_to_data_files(self):
        """Return to Data Files menu."""
        # Clear any pending ESC events to prevent double-triggering
        try:
            self.master.unbind_all('<Escape>')
        except Exception:
            pass
        
        for w in self.master.winfo_children():
            w.destroy()
        
        # Small delay before creating DataFilesScreen to avoid ESC re-trigger
        self.master.after(50, lambda: DataFilesScreen(self.master))


class FileHeadingScreen:
    def __init__(self, master, project_path):
        self.master = master
        self.project_path = project_path
        self.master.title("File Heading")
        
        # Load current project state to get existing heading
        try:
            state = load_project(project_path)
            self.heading_data = state.get('file_heading', {})
        except Exception:
            self.heading_data = {}
        
        panel, footer, container = build_page_scaffold(self.master, "FILE HEADING", back_cmd=self.back_to_data_files)
        
        # Show project badge
        try:
            project_name = os.path.splitext(os.path.basename(self.project_path))[0]
            badge = tk.Label(self.master, text=f"Project: {project_name}", fg='#7d8590', bg='#0d1117', 
                           font=('Segoe UI', 9), bd=0, padx=6, pady=2)
            badge.place(relx=1.0, y=6, x=-8, anchor='ne')
            self.master._file_badge_label = badge
        except Exception:
            pass
        
        # Form for heading information
        form_frame = tk.Frame(panel, bg='#0d1117')
        form_frame.pack(fill=tk.BOTH, expand=True, padx=20, pady=10)
        
        # Block Number
        tk.Label(form_frame, text="Block Number:", fg='#f0f6fc', bg='#0d1117', font=('Segoe UI', 11)).grid(row=0, column=0, padx=(0,12), pady=8, sticky='w')
        self.block_var = tk.StringVar(value=self.heading_data.get('block', ''))
        self.block_entry = tk.Entry(form_frame, textvariable=self.block_var, width=20, 
                                   bg='#21262d', fg='#f0f6fc', insertbackground='#f0f6fc', font=('Segoe UI', 10))
        self.block_entry.grid(row=0, column=1, padx=4, pady=8, sticky='w')
        
        # Quarter Number
        tk.Label(form_frame, text="Quarter Number:", fg='#f0f6fc', bg='#0d1117', font=('Segoe UI', 11)).grid(row=1, column=0, padx=(0,12), pady=8, sticky='w')
        self.quarter_var = tk.StringVar(value=self.heading_data.get('quarter', ''))
        self.quarter_entry = tk.Entry(form_frame, textvariable=self.quarter_var, width=20,
                                     bg='#21262d', fg='#f0f6fc', insertbackground='#f0f6fc', font=('Segoe UI', 10))
        self.quarter_entry.grid(row=1, column=1, padx=4, pady=8, sticky='w')
        
        # Parcel Numbers
        tk.Label(form_frame, text="Parcel Numbers:", fg='#f0f6fc', bg='#0d1117', font=('Segoe UI', 11)).grid(row=2, column=0, padx=(0,12), pady=8, sticky='w')
        self.parcels_var = tk.StringVar(value=self.heading_data.get('parcels', ''))
        self.parcels_entry = tk.Entry(form_frame, textvariable=self.parcels_var, width=30,
                                     bg='#21262d', fg='#f0f6fc', insertbackground='#f0f6fc', font=('Segoe UI', 10))
        self.parcels_entry.grid(row=2, column=1, padx=4, pady=8, sticky='w')
        
        # Place/Location
        tk.Label(form_frame, text="Place/Location:", fg='#f0f6fc', bg='#0d1117', font=('Segoe UI', 11)).grid(row=3, column=0, padx=(0,12), pady=8, sticky='w')
        self.place_var = tk.StringVar(value=self.heading_data.get('place', ''))
        self.place_entry = tk.Entry(form_frame, textvariable=self.place_var, width=40,
                                   bg='#21262d', fg='#f0f6fc', insertbackground='#f0f6fc', font=('Segoe UI', 10))
        self.place_entry.grid(row=3, column=1, padx=4, pady=8, sticky='w')
        
        # Additional Info (optional)
        tk.Label(form_frame, text="Additional Info:", fg='#f0f6fc', bg='#0d1117', font=('Segoe UI', 11)).grid(row=4, column=0, padx=(0,12), pady=8, sticky='nw')
        self.info_text = tk.Text(form_frame, width=50, height=4, bg='#21262d', fg='#f0f6fc', 
                                insertbackground='#f0f6fc', font=('Segoe UI', 10), wrap=tk.WORD)
        self.info_text.grid(row=4, column=1, padx=4, pady=8, sticky='w')
        self.info_text.insert('1.0', self.heading_data.get('additional_info', ''))
        
        # Buttons
        button_frame = tk.Frame(form_frame, bg='#0d1117')
        button_frame.grid(row=5, column=0, columnspan=2, pady=20)
        
        save_btn = tk.Button(button_frame, text="💾 Save Heading", command=self.on_save_heading,
                            bg='#238636', fg='#ffffff', relief='flat', padx=16, pady=8, font=('Segoe UI', 10))
        save_btn.pack(side=tk.LEFT, padx=(0,12))
        
        preview_btn = tk.Button(button_frame, text="👁️ Preview", command=self.on_preview_heading,
                               bg='#21262d', fg='#f0f6fc', relief='flat', padx=16, pady=8, font=('Segoe UI', 10))
        preview_btn.pack(side=tk.LEFT)
        
        # Set up Enter key navigation between fields
        self.block_entry.bind('<Return>', lambda e: self.quarter_entry.focus_set())
        self.quarter_entry.bind('<Return>', lambda e: self.parcels_entry.focus_set())
        self.parcels_entry.bind('<Return>', lambda e: self.place_entry.focus_set())
        self.place_entry.bind('<Return>', lambda e: self.info_text.focus_set())
        
        # Auto-save on any change
        self.block_var.trace_add('write', lambda *args: self._auto_save_heading())
        self.quarter_var.trace_add('write', lambda *args: self._auto_save_heading())
        self.parcels_var.trace_add('write', lambda *args: self._auto_save_heading())
        self.place_var.trace_add('write', lambda *args: self._auto_save_heading())
        self.info_text.bind('<KeyRelease>', lambda e: self._auto_save_heading())
        
        # Focus on first entry
        self.block_entry.focus_set()
        
        # Clear conflicting key bindings
        try:
            for i in range(10):
                self.master.unbind_all(str(i))
            self.master.unbind_all('<KeyRelease>')
        except Exception:
            pass
        
        # ESC goes back to Data Files
        try:
            self.master.bind_all('<Escape>', lambda e: self.back_to_data_files())
        except Exception:
            pass
    
    def on_save_heading(self):
        """Save the heading information to the project file."""
        try:
            # Collect heading data
            heading_data = {
                'block': self.block_var.get().strip(),
                'quarter': self.quarter_var.get().strip(),
                'parcels': self.parcels_var.get().strip(),
                'place': self.place_var.get().strip(),
                'additional_info': self.info_text.get('1.0', tk.END).strip(),
            }
            
            # Load current project state
            state = load_project(self.project_path)
            state['file_heading'] = heading_data
            
            # Save updated project
            save_project(self.project_path, state)
            
            messagebox.showinfo("Saved", "File heading saved successfully!")
            
        except Exception as exc:
            messagebox.showerror("Save Error", f"Failed to save heading:\n{exc}")
    
    def _auto_save_heading(self):
        """Auto-save heading information whenever fields change."""
        try:
            # Collect heading data
            heading_data = {
                'block': self.block_var.get().strip(),
                'quarter': self.quarter_var.get().strip(),
                'parcels': self.parcels_var.get().strip(),
                'place': self.place_var.get().strip(),
                'additional_info': self.info_text.get('1.0', tk.END).strip(),
            }
            
            # Load current project state
            state = load_project(self.project_path)
            state['file_heading'] = heading_data
            
            # Save updated project quietly
            save_project(self.project_path, state)
            
        except Exception:
            pass  # Silent auto-save, don't show errors
    
    def on_preview_heading(self):
        """Show a preview of how the heading will appear in the PDF."""
        block = self.block_var.get().strip()
        quarter = self.quarter_var.get().strip()
        parcels = self.parcels_var.get().strip()
        place = self.place_var.get().strip()
        additional = self.info_text.get('1.0', tk.END).strip()
        
        preview_text = "PDF HEADING PREVIEW:\n" + "="*50 + "\n\n"
        if block:
            preview_text += f"BLOCK: {block}\n"
        if quarter:
            preview_text += f"QUARTER: {quarter}\n"
        if parcels:
            preview_text += f"PARCELS: {parcels}\n"
        if place:
            preview_text += f"PLACE: {place}\n"
        if additional:
            preview_text += f"\n{additional}\n"
        preview_text += "\n" + "="*50
        
        # Show in a simple dialog
        preview_window = tk.Toplevel(self.master)
        preview_window.title("PDF Heading Preview")
        preview_window.configure(bg='#0d1117')
        preview_window.geometry("500x400")
        
        text_widget = tk.Text(preview_window, bg='#161b22', fg='#f0f6fc', font=('Courier', 10),
                             wrap=tk.WORD, padx=10, pady=10)
        text_widget.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)
        text_widget.insert('1.0', preview_text)
        text_widget.configure(state='disabled')
        
        close_btn = tk.Button(preview_window, text="Close", command=preview_window.destroy,
                             bg='#21262d', fg='#f0f6fc', relief='flat', padx=12, pady=6)
        close_btn.pack(pady=10)
    
    def back_to_data_files(self):
        """Return to Data Files menu."""
        try:
            self.master.unbind_all('<Escape>')
        except Exception:
            pass
        
        for w in self.master.winfo_children():
            w.destroy()
        
        self.master.after(50, lambda: DataFilesScreen(self.master))


class ParcelAreaApp:
    def __init__(self, master, project_path=None, project_state=None):
        self.master = master
        self.master.title("Parcel Area Calculator")
        # Clear ALL conflicting key bindings from main menu and other screens
        try:
            # Clear main menu number key bindings (0-9)
            for i in range(10):
                self.master.unbind_all(str(i))
            # Clear KeyRelease bindings that might interfere
            self.master.unbind_all('<KeyRelease>')
            # Clear ESC binding
            self.master.unbind_all('<Escape>')
        except Exception:
            pass
        # Set default window size but allow resizing with minimum constraints
        self.master.geometry("1200x800")
        self.master.minsize(800, 600)  # Allow resizing but set minimum size

        # Apply a stunning modern premium dark theme with gradients and animations
        try:
            style = ttk.Style(master)
            base_parent = 'clam' if 'clam' in style.theme_names() else style.theme_use()
            
            # Ultra-premium modern color palette with advanced gradients
            bg_primary = '#0d1117'      # Deep space with subtle blue
            bg_secondary = '#161b22'    # Elevated dark slate
            bg_tertiary = '#21262d'     # Interactive surfaces
            bg_accent = '#30363d'       # Hover states
            bg_glass = '#1c2128'        # Glass effect with depth
            bg_card = '#0d1117'         # Card backgrounds
            bg_elevated = '#1f2937'     # Elevated elements
            
            # Premium text colors with perfect contrast
            text_primary = '#f0f6fc'    # Pure white
            text_secondary = '#8b949e'  # Muted gray
            text_accent = '#58a6ff'     # Bright blue
            text_success = '#3fb950'    # Success green
            text_warning = '#d29922'    # Warning orange
            text_danger = '#f85149'     # Danger red
            text_muted = '#6e7681'      # Very muted text
            
            # Advanced gradient colors
            primary = '#0969da'         # Modern blue
            primary_hover = '#0d7eff'   # Lighter blue
            primary_pressed = '#0860ca' # Darker blue
            primary_light = '#1f6feb'   # Light blue
            
            success = '#238636'         # Professional green
            success_hover = '#2ea043'   # Light green
            success_pressed = '#1a7f37' # Dark green
            success_light = '#2ea043'   # Light green
            
            danger = '#da3633'          # Modern red
            danger_hover = '#f85149'    # Light red
            danger_pressed = '#b91c1c'  # Dark red
            danger_light = '#f85149'    # Light red
            
            warning = '#d29922'         # Modern orange
            warning_hover = '#e3b341'   # Light orange
            warning_pressed = '#bf8700' # Dark orange
            warning_light = '#e3b341'   # Light orange
            
            # Advanced effects
            glass_border = '#30363d'
            shadow_color = '#00000060'
            glow_color = '#58a6ff20'
            border_radius = 8
            if 'parceldark' not in style.theme_names():
                style.theme_create('parceldark', parent=base_parent, settings={
                    'TFrame': {
                        'configure': {'background': bg_primary, 'borderwidth': 0, 'relief': 'flat'}
                    },
                    'Card.TFrame': {
                        'configure': {
                            'background': bg_card,
                            'borderwidth': 1,
                            'relief': 'solid',
                            'padding': (32, 24)
                        }
                    },
                    'Glass.TFrame': {
                        'configure': {
                            'background': bg_glass,
                            'borderwidth': 1,
                            'relief': 'solid',
                            'padding': (28, 20)
                        }
                    },
                    'Elevated.TFrame': {
                        'configure': {
                            'background': bg_elevated,
                            'borderwidth': 0,
                            'relief': 'flat',
                            'padding': (20, 16)
                        }
                    },
                    'Modern.TFrame': {
                        'configure': {
                            'background': bg_secondary,
                            'borderwidth': 1,
                            'relief': 'solid',
                            'padding': (24, 20)
                        }
                    },
                    'Rounded.TFrame': {
                        'configure': {
                            'background': bg_tertiary,
                            'borderwidth': 0,
                            'relief': 'flat',
                            'padding': (12, 8)
                        }
                    },
                    'RoundButton.TFrame': {
                        'configure': {
                            'background': bg_tertiary,
                            'borderwidth': 0,
                            'relief': 'flat',
                            'padding': (6, 6)
                        }
                    },
                    'TLabel': {
                        'configure': {
                            'background': bg_primary, 
                            'foreground': text_primary, 
                            'padding': (6, 4), 
                            'font': ('Segoe UI', 11, 'normal')
                        }
                    },
                    'Header.TLabel': {
                        'configure': {
                            'background': bg_primary, 
                            'foreground': text_accent, 
                            'padding': (8, 12), 
                            'font': ('Segoe UI', 20, 'bold')
                        }
                    },
                    'Subheader.TLabel': {
                        'configure': {
                            'background': bg_primary, 
                            'foreground': text_primary, 
                            'padding': (6, 8), 
                            'font': ('Segoe UI', 14, 'bold')
                        }
                    },
                    'Caption.TLabel': {
                        'configure': {
                            'background': bg_primary, 
                            'foreground': text_secondary, 
                            'padding': (4, 2), 
                            'font': ('Segoe UI', 9, 'normal')
                        }
                    },
                    'Status.TLabel': {
                        'configure': {
                            'background': bg_tertiary, 
                            'foreground': text_secondary, 
                            'padding': (12, 8), 
                            'relief': 'flat',
                            'font': ('Segoe UI', 10, 'normal')
                        }
                    },
                    'TButton': {
                        'configure': {
                            'background': bg_tertiary,
                            'foreground': text_primary,
                            'padding': (24, 16),
                            'relief': 'flat',
                            'borderwidth': 1,
                            'focuscolor': 'none',
                            'font': ('Segoe UI', 12, 'normal')
                        },
                        'map': {
                            'background': [('active', bg_accent), ('pressed', bg_secondary)],
                            'foreground': [('disabled', text_secondary)],
                            'bordercolor': [('active', primary_light), ('!active', glass_border)]
                        }
                    },
                    'Primary.TButton': {
                        'configure': {
                            'background': primary,
                            'foreground': 'white',
                            'padding': (32, 20),
                            'relief': 'flat',
                            'borderwidth': 0,
                            'font': ('Segoe UI', 13, 'bold')
                        },
                        'map': {
                            'background': [('active', primary_hover), ('pressed', primary_pressed)],
                            'foreground': [('active', 'white'), ('pressed', 'white')]
                        }
                    },
                    'Success.TButton': {
                        'configure': {
                            'background': success,
                            'foreground': 'white',
                            'padding': (28, 16),
                            'relief': 'flat',
                            'borderwidth': 0,
                            'font': ('Segoe UI', 12, 'bold')
                        },
                        'map': {
                            'background': [('active', success_hover), ('pressed', success_pressed)]
                        }
                    },
                    'Danger.TButton': {
                        'configure': {
                            'background': danger,
                            'foreground': 'white',
                            'padding': (28, 16),
                            'relief': 'flat',
                            'borderwidth': 0,
                            'font': ('Segoe UI', 12, 'bold')
                        },
                        'map': {
                            'background': [('active', danger_hover), ('pressed', danger_pressed)]
                        }
                    },
                    'Warning.TButton': {
                        'configure': {
                            'background': warning,
                            'foreground': 'white',
                            'padding': (28, 16),
                            'relief': 'flat',
                            'borderwidth': 0,
                            'font': ('Segoe UI', 12, 'bold')
                        },
                        'map': {
                            'background': [('active', warning_hover), ('pressed', warning_pressed)]
                        }
                    },
                    'Toolbar.TButton': {
                        'configure': {
                            'padding': (12, 8), 
                            'font': ('Segoe UI', 10, 'normal')
                        }
                    },
                    'Accent.TButton': {
                        'configure': {
                            'background': primary,
                            'foreground': 'white',
                            'padding': (24, 14),
                            'relief': 'flat',
                            'borderwidth': 0,
                            'font': ('Segoe UI', 11, 'bold')
                        },
                        'map': {
                            'background': [('active', primary_hover), ('pressed', primary_pressed)]
                        }
                    },
                    'TEntry': {
                        'configure': {
                            'fieldbackground': bg_secondary,
                            'foreground': text_primary,
                            'background': bg_secondary,
                            'insertcolor': text_accent,
                            'borderwidth': 2,
                            'relief': 'solid',
                            'padding': (24, 16),
                            'font': ('Segoe UI', 12, 'normal'),
                            'highlightthickness': 0,
                            'bd': 0,
                            'focuscolor': 'none',
                            'selectborderwidth': 0
                        },
                        'map': {
                            'fieldbackground': [('focus', bg_tertiary)],
                            'background': [('focus', bg_tertiary)],
                            'bordercolor': [('focus', primary_light), ('!focus', glass_border)],
                            'borderwidth': [('focus', 3), ('!focus', 2)],
                            'highlightthickness': [('focus', 0), ('!focus', 0)]
                        }
                    },
                    'TSeparator': {
                        'configure': {'background': glass_border}
                    },
                    'Treeview': {
                        'configure': {
                            'background': bg_secondary,
                            'fieldbackground': bg_secondary,
                            'foreground': text_primary,
                            'rowheight': 48,
                            'borderwidth': 1,
                            'relief': 'solid',
                            'font': ('Segoe UI', 12, 'normal')
                        },
                        'map': {
                            'background': [('selected', primary)],
                            'foreground': [('selected', 'white')]
                        }
                    },
                    'Treeview.Heading': {
                        'configure': {
                            'background': bg_tertiary, 
                            'foreground': text_primary, 
                            'borderwidth': 0, 
                            'relief': 'flat',
                            'font': ('Segoe UI', 12, 'bold'),
                            'padding': (12,8)
                        }
                    },
                    'TNotebook': {
                        'configure': {
                            'background': bg_primary, 
                            'tabmargins': [8, 8, 8, 0], 
                            'borderwidth': 0, 
                            'relief': 'flat'
                        }
                    },
                    'TNotebook.Tab': {
                        'configure': {
                            'background': bg_tertiary, 
                            'foreground': text_secondary, 
                            'padding': [28, 16],
                            'borderwidth': 0,
                            'relief': 'flat',
                            'font': ('Segoe UI', 12, 'normal')
                        },
                        'map': {
                            'background': [('selected', bg_secondary), ('active', bg_accent)], 
                            'foreground': [('selected', text_primary), ('active', text_primary)]
                        }
                    },
                    'Vertical.TScrollbar': {
                        'configure': {
                            'background': bg_tertiary, 
                            'troughcolor': bg_primary, 
                            'arrowcolor': text_secondary,
                            'borderwidth': 0,
                            'relief': 'flat',
                            'width': 16
                        },
                        'map': {
                            'background': [('active', bg_accent)]
                        }
                    },
                    'Horizontal.TScrollbar': {
                        'configure': {
                            'background': bg_tertiary, 
                            'troughcolor': bg_primary, 
                            'arrowcolor': text_secondary,
                            'borderwidth': 0,
                            'relief': 'flat',
                            'height': 16
                        },
                        'map': {
                            'background': [('active', bg_accent)]
                        }
                    },
                    'TListbox': {
                        'configure': {
                            'background': bg_secondary,
                            'foreground': text_primary,
                            'selectbackground': primary,
                            'selectforeground': 'white',
                            'borderwidth': 2,
                            'relief': 'solid',
                            'font': ('Segoe UI', 11, 'normal')
                        }
                    }
                })
            style.theme_use('parceldark')
            # Global font (premium modern typography)
            try:
                # Use modern system fonts with fallbacks
                modern_fonts = ['Segoe UI Variable', 'Segoe UI', 'Inter', 'SF Pro Display', 'Roboto', 'Arial']
                default_font = ('Segoe UI', 11)  # Modern, clean font
                if getattr(self, '_small_screen', False):
                    default_font = (default_font[0], 10)
                style.configure('.', font=default_font)
            except Exception:
                pass
            # Root bg and modern styling
            try:
                master.configure(background=bg_primary)
                # Override default entry styling for modern look
                master.option_add('*TEntry*highlightThickness', '0')
                master.option_add('*TEntry*relief', 'solid')
                master.option_add('*TEntry*borderwidth', '2')
                master.option_add('*TEntry*borderWidth', '0')
                master.option_add('*TEntry*relief', 'flat')
                master.option_add('*Entry*highlightThickness', '0')
                master.option_add('*Entry*borderWidth', '0')
                master.option_add('*Entry*relief', 'flat')
            except Exception:
                pass
        except Exception:
            pass

        self.points_by_id = {}
        self.entered_ids = []
        self.computed_area = None
        self.parcel_number_var = tk.StringVar(value="")
        self.id_var = tk.StringVar(value="")
        self.edit_index = None  # index currently being edited in the list (None if appending)
        self.project_path = project_path
        # path to points file stored inside the project directory (filename only)
        self.project_points_file = None
        # Storage for committed parcels: list of dicts with number, ids, area
        self.parcels = []
        # Curve specifications (middle ordinate adjustments) applied to legs
        # Each item: { 'from': str, 'to': str, 'M': float, 'sign': +1/-1 }
        self.curve_specs = []

        # Toolbar with rounded appearance
        # Add animated background icons to the calculator
        add_background_icons(master)

        toolbar = ttk.Frame(master)
        toolbar.pack(fill=tk.X, padx=8, pady=(8,4))
        try:
            toolbar.configure(style='Card.TFrame')
        except Exception:
            pass
        ttk.Button(toolbar, text="New", style='Toolbar.TButton', command=self.menu_new_project).pack(side=tk.LEFT, padx=(0,4))
        ttk.Button(toolbar, text="Open", style='Toolbar.TButton', command=self.menu_open_project).pack(side=tk.LEFT, padx=4)
        ttk.Button(toolbar, text="Save", style='Toolbar.TButton', command=self.menu_save_project).pack(side=tk.LEFT, padx=4)
        ttk.Separator(toolbar, orient='vertical').pack(side=tk.LEFT, fill=tk.Y, padx=8)
        ttk.Button(toolbar, text="Load Points", style='Accent.TButton', command=self.on_load_file).pack(side=tk.LEFT, padx=4)
        ttk.Button(toolbar, text="🔄 Refresh", style='Toolbar.TButton', command=self.on_refresh_points).pack(side=tk.LEFT, padx=4)
        ttk.Button(toolbar, text="Export PDF", style='Accent.TButton', command=self.on_export_pdf).pack(side=tk.LEFT, padx=4)

        # Remove visible separators for cleaner look
        # ttk.Separator(master, orient='horizontal').pack(fill=tk.X, padx=0)

        # File status line
        top = ttk.Frame(master)
        top.pack(fill=tk.X, padx=8, pady=(0,8))

        # Ultra-modern app title/logo area with premium styling
        title_frame = ttk.Frame(top)
        title_frame.pack(side=tk.LEFT, fill=tk.X, expand=True)
        
        # Main title with modern typography and glow effect
        main_title = ttk.Label(title_frame, text="📐 Parcel Area Calculator", style='Header.TLabel')
        main_title.pack(side=tk.LEFT)
        
        # Subtitle for professional look
        subtitle = ttk.Label(title_frame, text="Professional Surveying Tool", 
                           style='Caption.TLabel')
        subtitle.pack(side=tk.LEFT, padx=(16, 0))
        
        # Status indicator
        status_indicator = ttk.Label(title_frame, text="●", 
                                   foreground='#3fb950', 
                                   font=('Segoe UI', 12))
        status_indicator.pack(side=tk.LEFT, padx=(8, 0))
        
        # Ultra-modern file status with enhanced styling
        file_frame = ttk.Frame(top)
        file_frame.pack(side=tk.RIGHT)
        self.file_label_var = tk.StringVar(value="📁 No file loaded")
        file_label = ttk.Label(file_frame, textvariable=self.file_label_var, 
                             style='Caption.TLabel')
        file_label.pack(side=tk.RIGHT)

        # If launched with an existing project/state (from the first page), auto-load points here
        try:
            if project_path and project_state:
                proj_dir = os.path.dirname(project_path)
                pts_file = project_state.get("points_file")
                if pts_file:
                    pts_path = os.path.join(proj_dir, pts_file)
                    if os.path.exists(pts_path):
                        self.points_by_id = read_points_any(pts_path)
                        self.file_label_var.set(f"📁 Loaded {len(self.points_by_id)} points: {os.path.basename(pts_path)}")
                        self.project_points_file = pts_file
                        # Recompute areas for saved parcels based on current coordinates
                        self._recompute_all_saved_parcels(autosave=True)
                        # Start file watcher to auto-reload if .pnt changes on disk
                        try:
                            self._start_points_watcher(os.path.abspath(pts_path))
                        except Exception:
                            pass
        except Exception:
            pass

        # SIMPLE INPUT AREA - Easy to understand
        input_container = ttk.Frame(master, style='Card.TFrame')
        input_container.pack(fill=tk.X, padx=10, pady=10)
        
        # Clear instructions
        instructions = ttk.Label(input_container, 
                               text="📝 STEP 1: Enter parcel number → STEP 2: Add point IDs one by one", 
                               font=('Segoe UI', 10, 'bold'),
                               foreground='#58a6ff')
        instructions.pack(pady=10)
        
        # Input row - everything in one line for simplicity
        input_row = ttk.Frame(input_container)
        input_row.pack(fill=tk.X, padx=20, pady=10)
        
        # Parcel number input
        ttk.Label(input_row, text="Parcel #:", font=('Segoe UI', 11, 'bold')).pack(side=tk.LEFT, padx=(0, 5))
        self.parcel_entry = ttk.Entry(input_row, textvariable=self.parcel_number_var, width=12, font=('Segoe UI', 11))
        self.parcel_entry.pack(side=tk.LEFT, padx=(0, 20))
        # Pressing Enter in parcel field moves to Point ID field
        self.parcel_entry.bind("<Return>", lambda e: self.id_entry.focus_set())
        self.parcel_entry.bind("<Tab>", lambda e: self.id_entry.focus_set())
        
        # Point ID input - THIS IS WHERE YOU TYPE THE POINT NUMBERS
        ttk.Label(input_row, text="Point ID:", font=('Segoe UI', 11, 'bold')).pack(side=tk.LEFT, padx=(0, 5))
        self.id_entry = ttk.Entry(input_row, textvariable=self.id_var, width=15, font=('Segoe UI', 11))
        self.id_entry.pack(side=tk.LEFT, padx=(0, 10))
        # Pressing Enter in Point ID field adds the point
        self.id_entry.bind("<Return>", lambda e: self.on_add_id())
        # Make the entry field more visible when focused
        self.id_entry.configure(foreground='black')
        
        # Big obvious Add button
        add_btn = ttk.Button(input_row, text="ADD POINT ➕", command=self.on_add_id, style='Accent.TButton')
        add_btn.pack(side=tk.LEFT, padx=(0, 10))
        
        # Undo and Reset buttons
        ttk.Button(input_row, text="Undo ↶", command=self.on_undo).pack(side=tk.LEFT, padx=5)
        ttk.Button(input_row, text="Reset All", command=self.on_reset).pack(side=tk.LEFT, padx=5)

        # Main content uses a Notebook with pages for Editor and Saved Parcels
        self.notebook = ttk.Notebook(master)
        self.notebook.pack(fill=tk.BOTH, expand=True, padx=0, pady=0)
        editor_page = ttk.Frame(self.notebook)
        saved_page = ttk.Frame(self.notebook)
        self.notebook.add(editor_page, text="Editor")
        self.notebook.add(saved_page, text="Saved Parcels")
        self.notebook.bind('<<NotebookTabChanged>>', lambda e: self._do_resize())
        # POINTS DISPLAY AREA - ABSOLUTE FULL WIDTH
        display_container = ttk.Frame(editor_page, style='Card.TFrame')
        display_container.pack(fill=tk.BOTH, expand=True, padx=0, pady=0)
        
        # Simple clear header
        header = ttk.Frame(display_container)
        header.pack(fill=tk.X, pady=(5, 5), padx=10)
        
        title_label = ttk.Label(header, text="YOUR POINTS:", font=('Segoe UI', 13, 'bold'))
        title_label.pack(side=tk.LEFT)
        
        count_label = ttk.Label(header, text="0 points", font=('Segoe UI', 11), foreground='#58a6ff')
        count_label.pack(side=tk.LEFT, padx=(10, 0))
        self.count_label = count_label
        
        # Display area with NO padding - use full width
        self.ids_display_frame = ttk.Frame(display_container)
        self.ids_display_frame.pack(fill=tk.BOTH, expand=True, pady=0)
        
        # Canvas for the points - ABSOLUTE FULL WIDTH with scrolling
        canvas_frame = ttk.Frame(self.ids_display_frame)
        canvas_frame.pack(fill=tk.BOTH, expand=True, padx=0, pady=0)
        
        # Scrollbar for vertical scrolling
        v_scrollbar = ttk.Scrollbar(canvas_frame, orient=tk.VERTICAL)
        v_scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
        
        # Canvas with NO borders, full width edge to edge
        self.ids_canvas = tk.Canvas(canvas_frame, bg='#161b22', highlightthickness=0, 
                                    highlightbackground='#30363d', height=150, relief='flat', bd=0,
                                    yscrollcommand=v_scrollbar.set)
        self.ids_canvas.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=0, pady=0)
        
        v_scrollbar.configure(command=self.ids_canvas.yview)
        
        # Create frame inside canvas for the horizontal layout
        self.ids_inner_frame = ttk.Frame(self.ids_canvas)
        self.ids_canvas.create_window((0, 0), window=self.ids_inner_frame, anchor="nw")
        
        # Bind canvas resize to update scroll region and refresh display
        self.ids_canvas.bind('<Configure>', self._on_canvas_configure)
        
        # Bind window resize to refresh horizontal display
        self.master.bind('<Configure>', self._on_window_configure)
        
        # Enable mouse wheel scrolling
        def _on_mousewheel(event):
            self.ids_canvas.yview_scroll(int(-1*(event.delta/120)), "units")
        
        self.ids_canvas.bind_all("<MouseWheel>", _on_mousewheel)
        
        # Initialize the horizontal display
        self._refresh_horizontal_display()

        # Force layout update after initialization
        self.master.after(50, self._refresh_horizontal_display)
        self.master.after(100, lambda: self.ids_canvas.configure(scrollregion=self.ids_canvas.bbox("all")))

        # Action buttons - simple and clear
        actions = ttk.Frame(display_container)
        actions.pack(fill=tk.X, pady=(5, 5), padx=10)
        
        # Status on the left with instructions
        self.status_label = ttk.Label(actions, 
                                     text="💡 Left-click point to EDIT | Right-click to DELETE | Click ➕ to INSERT between points", 
                                     font=('Segoe UI', 9), foreground='#58a6ff')
        self.status_label.pack(side=tk.LEFT)
        
        # Delete button on the right
        delete_btn = ttk.Button(actions, text="🗑️ Delete Last Point", style='Danger.TButton', command=self.on_delete_selected)
        delete_btn.pack(side=tk.RIGHT)
        # Remove separator for cleaner appearance
        # ttk.Separator(list_frame, orient='horizontal').pack(fill=tk.X, pady=(6,0))

        # Saved parcels live on a separate page - using card style
        saved_frame = ttk.Frame(saved_page, style='Card.TFrame')
        ttk.Label(saved_frame, text="Saved parcels:").pack(anchor="w")
        columns = ("parcel", "area", "points")
        tree_wrap = ttk.Frame(saved_frame)
        tree_wrap.pack(fill=tk.BOTH, expand=True)
        self.saved_tree = ttk.Treeview(tree_wrap, columns=columns, show='headings', height=6, selectmode='extended')
        self.saved_tree.heading('parcel', text='Parcel')
        self.saved_tree.heading('area', text='Area')
        self.saved_tree.heading('points', text='Points')
        self.saved_tree.column('parcel', width=100, anchor='center')
        self.saved_tree.column('area', width=120, anchor='e')
        self.saved_tree.column('points', width=80, anchor='center')
        self.saved_tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        # Alternate row colors for readability
        try:
            self.saved_tree.tag_configure('even', background='#161b22')
            self.saved_tree.tag_configure('odd', background='#1c2128')
        except Exception:
            pass
        # Scrollbars for small windows
        tree_scroll_y = ttk.Scrollbar(tree_wrap, orient=tk.VERTICAL, command=self.saved_tree.yview)
        tree_scroll_y.pack(side=tk.RIGHT, fill=tk.Y)
        self.saved_tree.configure(yscrollcommand=tree_scroll_y.set)
        tree_scroll_x = ttk.Scrollbar(saved_frame, orient=tk.HORIZONTAL, command=self.saved_tree.xview)
        tree_scroll_x.pack(fill=tk.X)
        self.saved_tree.configure(xscrollcommand=tree_scroll_x.set)
        self.saved_tree.bind("<Double-1>", lambda e: self.on_load_saved_parcel())
        saved_buttons = ttk.Frame(saved_frame)
        saved_buttons.pack(fill=tk.X, pady=(6,0))
        ttk.Button(saved_buttons, text="Load Selected", command=self.on_load_saved_parcel).pack(side=tk.LEFT)
        ttk.Button(saved_buttons, text="📄 Export Selected", style='Accent.TButton', command=self.on_export_selected_parcels).pack(side=tk.LEFT, padx=(6,0))

        # Pack the two pages' root frames
        display_container.pack(in_=editor_page, fill=tk.BOTH, expand=True)
        saved_frame.pack(in_=saved_page, fill=tk.BOTH, expand=True)

        # Area result with rounded appearance
        bottom = ttk.Frame(master)
        bottom.pack(fill=tk.X, padx=8, pady=(0,8))
        try:
            bottom.configure(style='Card.TFrame')
        except Exception:
            pass
        self.area_var = tk.StringVar(value="Area: -")
        ttk.Label(bottom, textvariable=self.area_var).pack(side=tk.LEFT)
        ttk.Button(bottom, text="📄 Export All", style='Accent.TButton', command=self.on_export_pdf).pack(side=tk.RIGHT)
        ttk.Button(bottom, text="Save Parcel", style='Accent.TButton', command=self.on_commit_parcel).pack(side=tk.RIGHT, padx=(0,8))
        # Remove separator for minimal design
        # ttk.Separator(master, orient='horizontal').pack(fill=tk.X, padx=0)

        # Status/help
        help_text = (
            "Workflow: Load points file, type PARCEL NUMBER then press Enter. "
            "Now type point IDs; press Enter after each. When you re-enter the first ID, the polygon closes and the area is computed."
        )
        # Keep a reference so we can adjust wraplength on resize
        self.help_label = ttk.Label(master, text=help_text, wraplength=760)
        self.help_label.pack(fill=tk.X, padx=8, pady=(0,8))

        # Initial focus for keyboard-only flow
        self.parcel_entry.focus_set()

        # Menu bar
        self._build_menu()

        # Status bar
        self.status_var = tk.StringVar(value="Ready")
        status = ttk.Label(master, textvariable=self.status_var, relief=tk.SUNKEN, anchor='w', style='Status.TLabel')
        status.pack(fill=tk.X, side=tk.BOTTOM)

        # Keyboard shortcuts
        master.bind_all('<Control-l>', lambda e: self.on_load_file())
        master.bind_all('<Control-e>', lambda e: self.on_export_pdf())
        master.bind_all('<Control-m>', lambda e: self.go_to_main_menu())
        master.bind_all('<Escape>', lambda e: self.go_to_main_menu())
        # Remove old listbox bindings - now using horizontal display

        # Responsive behavior: adjust wrapping, tree columns; use debounced resize to avoid churn
        self._resize_job = None
        master.bind('<Configure>', self._schedule_resize)

        if project_state is not None:
            self._hydrate_from_state(project_state)
            # Force another refresh to ensure display is updated
            self.master.after(100, self._refresh_horizontal_display)

        # Set initial focus to the Point ID entry field for easier input
        self.master.after(200, lambda: self.id_entry.focus_set())
        
        # Add visual feedback when entry fields get focus
        def on_entry_focus_in(event, entry):
            try:
                entry.configure(style='Focused.TEntry')
            except:
                pass
        
        def on_entry_focus_out(event, entry):
            try:
                entry.configure(style='TEntry')
            except:
                pass
        
        self.parcel_entry.bind("<FocusIn>", lambda e: on_entry_focus_in(e, self.parcel_entry))
        self.parcel_entry.bind("<FocusOut>", lambda e: on_entry_focus_out(e, self.parcel_entry))
        self.id_entry.bind("<FocusIn>", lambda e: on_entry_focus_in(e, self.id_entry))
        self.id_entry.bind("<FocusOut>", lambda e: on_entry_focus_out(e, self.id_entry))

        # Stop watcher on window close
        try:
            self.master.bind('<Destroy>', lambda e: self._stop_points_watcher())
        except Exception:
            pass

        # Show project badge on calculator screen
        try:
            if self.project_path:
                project_name = os.path.splitext(os.path.basename(self.project_path))[0]
                badge_text = f"Project: {project_name}"
            else:
                badge_text = "Project: (none)"
            
            badge = tk.Label(self.master, text=badge_text, fg='#7d8590', bg='#0d1117', 
                           font=('Segoe UI', 9), bd=0, padx=6, pady=2)
            badge.place(relx=1.0, y=6, x=-8, anchor='ne')
            self.master._file_badge_label = badge
        except Exception:
            pass

    def _recompute_all_saved_parcels(self, autosave=True):
        """Recompute area for every saved parcel using current coordinates.
        Updates the saved list and optionally autosaves the project.
        """
        try:
            if not self.parcels or not self.points_by_id:
                return
            changed = False
            for p in self.parcels:
                ids_seq = p.get('ids') or []
                curves = p.get('curves') or []
                area_now = compute_parcel_area_from_points(ids_seq, self.points_by_id, curves)
                if area_now is not None:
                    old_area = p.get('area', 0)
                    if abs(old_area - area_now) > 1e-9:
                        p['area'] = area_now
                        changed = True
            if changed:
                self._refresh_saved_parcels_list()
                if self.project_path and autosave:
                    try:
                        save_project(self.project_path, self._collect_state())
                    except Exception:
                        pass
                print(f"Updated {len(self.parcels)} saved parcels with new coordinates")
        except Exception as e:
            print(f"Error in _recompute_all_saved_parcels: {e}")

    def _schedule_resize(self, event):
        try:
            if self._resize_job is not None:
                self.master.after_cancel(self._resize_job)
        except Exception:
            pass
        self._resize_job = self.master.after(60, self._do_resize)

    def _do_resize(self):
        self._resize_job = None
        try:
            # Update help text wrap to current width minus padding
            if hasattr(self, 'help_label'):
                new_wrap = max(400, self.master.winfo_width() - 40)
                self.help_label.configure(wraplength=new_wrap)
            # Stretch treeview columns proportionally (also allow horizontal scroll if cramped)
            if hasattr(self, 'saved_tree'):
                total = max(1, self.saved_tree.winfo_width() - 20)
                self.saved_tree.column('parcel', width=max(80, int(total * 0.25)))
                self.saved_tree.column('area', width=max(120, int(total * 0.45)))
                self.saved_tree.column('points', width=max(60, int(total * 0.20)))
                if total < 420:
                    self.saved_tree.column('parcel', width=120)
                    self.saved_tree.column('area', width=180)
                    self.saved_tree.column('points', width=120)
        except Exception:
            pass

    def on_load_file(self):
        path = pick_points_file()
        if not path:
            return
        try:
            # If in a project, copy the file into the project folder so it persists with the project
            load_path = path
            if self.project_path:
                proj_dir = os.path.dirname(self.project_path)
                os.makedirs(proj_dir, exist_ok=True)
                base = os.path.basename(path)
                dst = os.path.join(proj_dir, base)
                if not os.path.exists(dst):
                    try:
                        shutil.copy2(path, dst)
                    except Exception:
                        pass
                load_path = dst
                self.project_points_file = base
            self.points_by_id = read_points_any(load_path)
            self.file_label_var.set(f"📁 Loaded {len(self.points_by_id)} points: {os.path.basename(load_path)}")
            # Update file badge
            try:
                if hasattr(self.master, '_file_badge_label') and self.master._file_badge_label:
                    self.master._file_badge_label.configure(text=f"File: {os.path.basename(load_path)}")
            except Exception:
                pass
            self.on_reset()
            self.set_status("File loaded successfully")
            # Recompute saved parcels with the new coordinates
            self._recompute_all_saved_parcels(autosave=True)
            # Restart points watcher
            try:
                self._start_points_watcher(os.path.abspath(load_path))
            except Exception:
                pass
            try:
                if self.project_path:
                    save_project(self.project_path, self._collect_state())
            except Exception:
                pass
        except Exception as exc:
            messagebox.showerror("Load Error", f"Failed to read points file:\n{exc}")
            self.set_status("Failed to load file")

    def on_refresh_points(self):
        """Refresh/reload the current points file and recompute all saved parcels."""
        if not self.project_points_file:
            messagebox.showwarning("No File", "No points file is currently loaded.")
            return
        
        try:
            # Determine the path to reload
            if self.project_path:
                proj_dir = os.path.dirname(self.project_path)
                pts_path = os.path.join(proj_dir, self.project_points_file)
            else:
                messagebox.showwarning("Refresh", "Cannot refresh - no project path available.")
                return
            
            if not os.path.exists(pts_path):
                messagebox.showerror("File Not Found", f"Points file not found: {pts_path}")
                return
            
            # Reload points
            self.points_by_id = read_points_any(pts_path)
            self.file_label_var.set(f"📁 Loaded {len(self.points_by_id)} points: {os.path.basename(pts_path)} (refreshed)")
            
            # Update file badge
            try:
                if hasattr(self.master, '_file_badge_label') and self.master._file_badge_label:
                    self.master._file_badge_label.configure(text=f"File: {os.path.basename(pts_path)} (refreshed)")
            except Exception:
                pass
            
            # Recompute all saved parcels with updated coordinates
            self._recompute_all_saved_parcels(autosave=True)
            
            # Refresh current area if polygon is closed
            self._refresh_area_if_closed(show_message=False)
            
            self.set_status("Points file refreshed - all areas updated")
            
        except Exception as exc:
            messagebox.showerror("Refresh Error", f"Failed to refresh points file:\n{exc}")
            self.set_status("Failed to refresh file")

    def _recompute_all_saved_parcels(self, autosave=True):
        """Recompute area for every saved parcel using current coordinates."""
        try:
            if not self.parcels or not self.points_by_id:
                return
            changed = False
            for p in self.parcels:
                ids_seq = p.get('ids') or []
                curves = p.get('curves') or []
                area_now = compute_parcel_area_from_points(ids_seq, self.points_by_id, curves)
                if area_now is not None:
                    old_area = p.get('area', 0)
                    if abs(old_area - area_now) > 1e-9:
                        p['area'] = area_now
                        changed = True
            if changed:
                self._refresh_saved_parcels_list()
                if self.project_path and autosave:
                    try:
                        save_project(self.project_path, self._collect_state())
                    except Exception:
                        pass
                print(f"Updated areas for {len(self.parcels)} saved parcels")
        except Exception as e:
            print(f"Error recomputing parcels: {e}")

    def _start_points_watcher(self, path):
        """Start watching the points file for changes."""
        try:
            self._points_watch = {
                'path': path,
                'mtime': os.path.getmtime(path) if os.path.exists(path) else None,
                'job': None,
            }
            self._schedule_points_watch()
        except Exception:
            self._points_watch = None

    def _schedule_points_watch(self):
        """Schedule the next file check."""
        try:
            if not getattr(self, '_points_watch', None):
                return
            if self._points_watch.get('job') is not None:
                self.master.after_cancel(self._points_watch['job'])
            self._points_watch['job'] = self.master.after(1200, self._check_points_file)
        except Exception:
            pass

    def _check_points_file(self):
        """Check if the points file has been modified and reload if so."""
        try:
            if not getattr(self, '_points_watch', None):
                return
            path = self._points_watch.get('path')
            if not path or not os.path.exists(path):
                self._schedule_points_watch()
                return
            
            mtime = os.path.getmtime(path)
            last = self._points_watch.get('mtime')
            if last is None:
                self._points_watch['mtime'] = mtime
            elif mtime > last:
                self._points_watch['mtime'] = mtime
                # File changed - reload and update everything
                try:
                    self.points_by_id = read_points_any(path)
                    self.file_label_var.set(f"📁 Loaded {len(self.points_by_id)} points: {os.path.basename(path)} (auto-updated)")
                    
                    # Update file badge
                    try:
                        if hasattr(self.master, '_file_badge_label') and self.master._file_badge_label:
                            self.master._file_badge_label.configure(text=f"File: {os.path.basename(path)} (auto-updated)")
                    except Exception:
                        pass
                    
                    # Recompute all saved parcels and refresh the display
                    self._recompute_all_saved_parcels(autosave=True)
                    
                    # Also refresh current area if polygon is closed
                    self._refresh_area_if_closed(show_message=False)
                    
                    print(f"Auto-reloaded {os.path.basename(path)} and updated all areas")
                except Exception as e:
                    print(f"Error auto-reloading points: {e}")
        finally:
            self._schedule_points_watch()

    def _stop_points_watcher(self):
        """Stop the points file watcher."""
        try:
            if getattr(self, '_points_watch', None) and self._points_watch.get('job') is not None:
                self.master.after_cancel(self._points_watch['job'])
        except Exception:
            pass
        self._points_watch = None

    def on_add_id(self):
        pid = self.id_var.get().strip()
        if not pid:
            return
        if not self.points_by_id:
            messagebox.showwarning("No Points", "Load a points file first.")
            return
        if pid not in self.points_by_id:
            messagebox.showerror("Unknown ID", f"ID '{pid}' not found in loaded points.")
            return

        # Add or apply edit
        if self.edit_index is not None:
            idx = self.edit_index
            self.entered_ids[idx] = pid
            self.edit_index = None
        else:
            self.entered_ids.append(pid)

        # Refresh horizontal display immediately
        self._refresh_horizontal_display()
        self.id_var.set("")

        # Update status
        count = len(self.entered_ids)
        if hasattr(self, 'status_label'):
            self.status_label.configure(text=f"Added point {pid} ({count} total)")

        # Check closure: if we have at least 4 entries and last equals the first
        if len(self.entered_ids) >= 4 and self.entered_ids[-1] == self.entered_ids[0]:
            self._refresh_area_if_closed(show_message=True)
        else:
            if hasattr(self, 'status_label'):
                self.status_label.configure(text=f"Point {pid} added successfully")

    def on_undo(self):
        if not self.entered_ids:
            return
        self.entered_ids.pop()
        # Refresh horizontal display
        self._refresh_horizontal_display()
        self.area_var.set("Area: -")
        self.computed_area = None
        # Undo invalidates curve specs for safety
        if self.curve_specs:
            self.curve_specs = []
        # Update status
        if hasattr(self, 'status_label'):
            count = len(self.entered_ids)
            self.status_label.configure(text=f"Undid last point ({count} remaining)")

    def on_reset(self):
        self.entered_ids = []
        # Refresh horizontal display
        self._refresh_horizontal_display()
        self.area_var.set("Area: -")
        self.id_var.set("")
        self.edit_index = None
        self.curve_specs = []
        # Update status
        if hasattr(self, 'status_label'):
            self.status_label.configure(text="All points cleared")

    def _on_canvas_configure(self, event):
        """Update canvas scroll region when canvas is resized."""
        self.ids_canvas.configure(scrollregion=self.ids_canvas.bbox("all"))
    
    def _on_window_configure(self, event):
        """Handle window resize to refresh horizontal display."""
        # Only refresh if the window is being resized (not just moved)
        if event.widget == self.master:
            # Use after_idle to avoid excessive refreshes during resize
            self.master.after_idle(self._refresh_horizontal_display)
    
    def _refresh_horizontal_display(self):
        """Refresh the horizontal display of entered IDs with question marks."""
        # Clear existing widgets
        for widget in self.ids_inner_frame.winfo_children():
            widget.destroy()

        # Update count label first
        if hasattr(self, 'count_label'):
            count = len(self.entered_ids)
            self.count_label.configure(text=f"{count} points")

        if not self.entered_ids:
            # Show helpful empty state message
            empty_label = tk.Label(
                self.ids_inner_frame,
                text="👉 No points added yet. Type a point ID above and click 'ADD POINT' to start!",
                bg='#161b22',
                fg='#58a6ff',
                font=('Segoe UI', 11, 'bold'),
                justify='center'
            )
            empty_label.pack(pady=30)
            return

        # Calculate how many items can fit per row based on canvas width
        canvas_width = self.ids_canvas.winfo_width()
        if canvas_width < 100:  # Canvas not yet initialized
            canvas_width = 1150  # Default to wider width
        
        # Use FULL width
        usable_width = canvas_width - 20  # Small margin for scrollbar

        # Fixed small box width - don't stretch them!
        fixed_box_width = 70  # Keep boxes small and compact
        insert_button_width = 12  # Small + button
        
        # Calculate how many boxes fit per row with their normal size
        item_plus_insert = fixed_box_width + insert_button_width
        items_per_row = max(1, int(usable_width / item_plus_insert))
        
        # Use fixed width - don't stretch
        optimal_item_width = fixed_box_width

        # Create horizontal layout with wrapping
        current_row = 0
        current_col = 0

        for i, point_id in enumerate(self.entered_ids):
            # Add SMALL insert button BEFORE this point (except for first item)
            if i > 0:
                insert_btn = tk.Label(
                    self.ids_inner_frame,
                    text="+",
                    bg='#21262d',
                    fg='#58a6ff',
                    font=('Consolas', 8, 'bold'),
                    cursor='hand2',
                    padx=2,
                    pady=2,
                    relief='flat'
                )
                insert_btn.grid(row=current_row, column=current_col, padx=0, pady=2, sticky='w')
                
                # Tooltip and click handler for insert
                def on_insert_click(event, idx=i):
                    self._insert_point_at_index(idx)
                
                def on_insert_enter(event, btn=insert_btn):
                    btn.configure(bg='#58a6ff', fg='#ffffff')
                    
                def on_insert_leave(event, btn=insert_btn):
                    btn.configure(bg='#21262d', fg='#58a6ff')
                
                insert_btn.bind('<Button-1>', on_insert_click)
                insert_btn.bind('<Enter>', on_insert_enter)
                insert_btn.bind('<Leave>', on_insert_leave)
                
                current_col += 1
                if current_col >= items_per_row:
                    current_row += 1
                    current_col = 0
            
            # Create a frame for each point ID
            item_frame = ttk.Frame(self.ids_inner_frame)
            item_frame.grid(row=current_row, column=current_col, padx=2, pady=2, sticky='w')

            # Keep boxes small with consistent sizing
            font_size = 9
            padx, pady = 6, 3

            # Create label with point ID and question mark - SMALL and compact
            id_label = tk.Label(
                item_frame,
                text=f"{point_id}?",
                bg='#238636',  # Green background for better visibility
                fg='#ffffff',  # White text
                font=('Segoe UI', font_size, 'bold'),
                relief='raised',
                bd=2,
                padx=padx,
                pady=pady,
                cursor='hand2'  # Hand cursor on hover
            )
            id_label.pack()

            # Add hover effects
            def on_enter(event, label=id_label):
                label.configure(bg='#2ea043')  # Lighter green on hover

            def on_leave(event, label=id_label):
                label.configure(bg='#238636')  # Back to original green

            id_label.bind('<Enter>', on_enter)
            id_label.bind('<Leave>', on_leave)

            # Bind right-click to delete and left-click to edit
            id_label.bind('<Button-1>', lambda e, idx=i: self._edit_id_at_index(idx))
            id_label.bind('<Button-3>', lambda e, idx=i: self._delete_point_at_index(idx))

            # Move to next position
            current_col += 1
            if current_col >= items_per_row:
                current_row += 1
                current_col = 0

        # Update canvas scroll region - force update to show all content
        self.ids_inner_frame.update_idletasks()
        self.ids_canvas.configure(scrollregion=self.ids_canvas.bbox("all"))
        
        # Auto-scroll to bottom if we have many rows
        if len(self.entered_ids) > 10:
            self.ids_canvas.yview_moveto(1.0)
    
    def _insert_point_at_index(self, index):
        """Insert a new point at the specified index."""
        if 0 <= index <= len(self.entered_ids):
            # Prompt for new point ID
            from tkinter import simpledialog
            new_id = simpledialog.askstring("Insert Point", 
                                           f"Enter point ID to insert before {self.entered_ids[index]}:",
                                           parent=self.master)
            if new_id and new_id.strip():
                new_id = new_id.strip()
                if new_id not in self.points_by_id:
                    messagebox.showerror("Unknown ID", f"Point '{new_id}' not found in loaded points.")
                    return
                # Insert at the specified position
                self.entered_ids.insert(index, new_id)
                self._refresh_horizontal_display()
                if hasattr(self, 'status_label'):
                    self.status_label.configure(text=f"Inserted {new_id} before {self.entered_ids[index+1]}")
    
    def _delete_point_at_index(self, index):
        """Delete the point at the specified index."""
        if 0 <= index < len(self.entered_ids):
            deleted_id = self.entered_ids[index]
            if messagebox.askyesno("Delete Point", f"Delete point {deleted_id}?"):
                del self.entered_ids[index]
                self._refresh_horizontal_display()
                if hasattr(self, 'status_label'):
                    self.status_label.configure(text=f"Deleted {deleted_id}")
    
    def _edit_id_at_index(self, index):
        """Edit the ID at the specified index."""
        if 0 <= index < len(self.entered_ids):
            self.edit_index = index
            self.id_var.set(self.entered_ids[index])
            self.id_entry.focus_set()
            if hasattr(self, 'status_label'):
                self.status_label.configure(text=f"Editing point {index + 1} - type new ID and press Enter")

    def _compute_area(self):
        # Build polygon vertices from unique sequence, excluding the final repeated first ID
        if len(self.entered_ids) < 4:
            return None
        if self.entered_ids[-1] != self.entered_ids[0]:
            return None
        unique_ids = self.entered_ids[:-1]
        if len(unique_ids) < 3:
            return None
        vertices = [self.points_by_id[pid] for pid in unique_ids]
        # Shoelace formula
        area2 = 0.0
        n = len(vertices)
        for i in range(n):
            x1, y1 = vertices[i]
            x2, y2 = vertices[(i + 1) % n]
            area2 += x1 * y2 - x2 * y1
        base_area = abs(area2) / 2.0
        # Apply curve adjustments using middle ordinates if any
        if not self.curve_specs:
            return base_area
        try:
            adjustments = 0.0
            # Helper to compute distance
            def _dist(a, b):
                return ((b[0]-a[0])**2 + (b[1]-a[1])**2) ** 0.5
            # Build pairs around the polygon
            pairs = []
            for i in range(len(unique_ids)):
                a = unique_ids[i]
                b = unique_ids[(i+1) % len(unique_ids)]
                pairs.append((a, b))
            for spec in self.curve_specs:
                frm = spec.get('from')
                to = spec.get('to')
                M = float(spec.get('M', 0.0))
                sgn = 1 if spec.get('sign', 1) in (1, '+', 'add', 'ADD', 'Add') else -1
                if M <= 0:
                    continue
                # Find the first matching leg
                try:
                    idx = next(i for i,(a,b) in enumerate(pairs) if a == frm and b == to)
                except StopIteration:
                    # If not found in forward order, try reverse order (user may have reversed IDs)
                    try:
                        idx = next(i for i,(a,b) in enumerate(pairs) if a == to and b == frm)
                        # If reversed, keep chord length but sign unchanged (user intent applies to that edge)
                        frm, to = to, frm
                    except StopIteration:
                        continue
                A = self.points_by_id[frm]
                B = self.points_by_id[to]
                C = _dist(A, B)
                # Radius from chord C and sagitta (middle ordinate) M
                R = (C*C) / (8.0*M) + (M/2.0)
                # Central angle
                import math
                theta = 2.0 * math.asin(min(1.0, max(0.0, C/(2.0*R))))
                # Circular segment area (between chord and arc)
                seg_area = 0.5 * R*R * (theta - math.sin(theta))
                adjustments += sgn * seg_area
            return base_area + adjustments
        except Exception:
            # Fallback to base area if anything goes wrong
            return base_area

    def on_parcel_ready(self):
        value = self.parcel_number_var.get().strip()
        if not value:
            messagebox.showwarning("Parcel Number", "Please enter the parcel number.")
            return
        # Move focus to ID entry to continue keyboard sequence
        self.id_entry.focus_set()

    def _build_menu(self):
        menubar = tk.Menu(self.master)
        filemenu = tk.Menu(menubar, tearoff=0)
        filemenu.add_command(label="New Project", command=self.menu_new_project)
        filemenu.add_command(label="Open Project", command=self.menu_open_project)
        filemenu.add_command(label="Main Menu\tCtrl+M", command=self.go_to_main_menu)
        filemenu.add_separator()
        filemenu.add_command(label="Save Project", command=self.menu_save_project)
        filemenu.add_command(label="Save Project As...", command=self.menu_save_project_as)
        filemenu.add_separator()
        filemenu.add_command(label="Load Points File\tCtrl+L", command=self.on_load_file)
        filemenu.add_command(label="Export to PDF\tCtrl+E", command=self.on_export_pdf)
        filemenu.add_separator()
        filemenu.add_command(label="Exit", command=self.master.quit)
        menubar.add_cascade(label="File", menu=filemenu)
        self.master.config(menu=menubar)

    def go_to_main_menu(self):
        try:
            # Persist project context on the master so Main Menu can resume it
            try:
                self.master._app_ctx = {
                    'project_path': getattr(self, 'project_path', None),
                    'state': self._collect_state(),
                }
            except Exception:
                pass
            for w in self.master.winfo_children():
                w.destroy()
        except Exception:
            pass
        MainMenu(self.master)

    def set_status(self, text):
        try:
            self.status_var.set(text)
        except Exception:
            pass

    # -------- Project persistence helpers on the view --------
    def _collect_state(self):
        # Include work mode settings in project state
        work_settings = getattr(self.master, '_work_settings', {})
        return {
            "parcel_number": self.parcel_number_var.get().strip(),
            "entered_ids": list(self.entered_ids),
            "parcels": list(self.parcels),
            "points_file": self.project_points_file,
            "curves": list(self.curve_specs),
            "work_settings": work_settings,
        }

    def _hydrate_from_state(self, state):
        self.entered_ids = list(state.get("entered_ids", []))
        # Refresh horizontal display immediately after loading
        self._refresh_horizontal_display()
        self.parcel_number_var.set(state.get("parcel_number", ""))
        # Load saved parcels
        self.parcels = list(state.get("parcels", []))
        self._refresh_saved_parcels_list()
        self._refresh_area_if_closed(show_message=False)
        # Track points file from project state if any
        self.project_points_file = state.get("points_file")
        # Load curve specs if any
        self.curve_specs = list(state.get("curves", []))
        # Load work mode settings
        work_settings = state.get("work_settings", {})
        if work_settings:
            self.master._work_settings = work_settings

    def _refresh_saved_parcels_list(self):
        # Clear
        try:
            for i in self.saved_tree.get_children():
                self.saved_tree.delete(i)
        except Exception:
            return
        
        # Always read parcels from project file instead of memory
        if self.project_path and os.path.exists(self.project_path):
            try:
                state = load_project(self.project_path)
                parcels = state.get("parcels", [])
                # Update in-memory list to match file
                self.parcels = list(parcels)
            except Exception:
                parcels = self.parcels  # Fallback to memory if file read fails
        else:
            parcels = self.parcels  # Fallback to memory if no project file
        
        for p in parcels:
            num_points = len(p['ids']) - 1 if p['ids'] and p['ids'][-1] == p['ids'][0] else len(p['ids'])
            self.saved_tree.insert('', tk.END, values=(p['parcel_number'], f"{p['area']:.3f}", num_points))

    def on_load_saved_parcel(self):
        try:
            sel = self.saved_tree.selection()
            if not sel:
                return
            item = sel[0]
            parcel_num = self.saved_tree.item(item, 'values')[0]
            
            # Read parcels from project file to get the most current data
            parcels = self.parcels  # Default fallback
            if self.project_path and os.path.exists(self.project_path):
                try:
                    state = load_project(self.project_path)
                    parcels = state.get("parcels", [])
                except Exception:
                    pass
            
            idx = next((i for i,p in enumerate(parcels) if str(p['parcel_number']) == str(parcel_num)), None)
            if idx is None:
                return
            parcel = parcels[idx]
        except Exception:
            return
        # Load parcel into editor for modification
        self.parcel_number_var.set(parcel['parcel_number'])
        self.entered_ids = list(parcel['ids'])
        # Refresh horizontal display
        self._refresh_horizontal_display()
        self._refresh_area_if_closed(show_message=False)
        self.id_entry.focus_set()


    def on_export_selected_parcels(self):
        """Export PDF for the selected parcels (multiple selection supported)."""
        try:
            selections = self.saved_tree.selection()
            if not selections:
                messagebox.showwarning("No Selection", "Please select one or more parcels to export.")
                return
            
            # Read parcels from project file to get the most current data
            parcels = self.parcels  # Default fallback
            if self.project_path and os.path.exists(self.project_path):
                try:
                    state = load_project(self.project_path)
                    parcels = state.get("parcels", [])
                except Exception:
                    pass
            
            # Get selected parcels
            selected_parcels = []
            for item in selections:
                parcel_num = self.saved_tree.item(item, 'values')[0]
                idx = next((i for i,p in enumerate(parcels) if str(p['parcel_number']) == str(parcel_num)), None)
                if idx is not None:
                    selected_parcels.append(parcels[idx])
            
            if not selected_parcels:
                messagebox.showerror("Selection Error", "No valid parcels selected.")
                return
                
        except Exception:
            messagebox.showerror("Selection Error", "Failed to get selected parcels.")
            return

        if not self.points_by_id:
            messagebox.showwarning("No Points", "Load a points file first.")
            return

        # Generate filename suggestion
        if len(selected_parcels) == 1:
            filename_suggestion = f"Parcel_{selected_parcels[0]['parcel_number']}.pdf"
            title = f"Export Parcel {selected_parcels[0]['parcel_number']} to PDF"
        else:
            parcel_nums = [str(p['parcel_number']) for p in selected_parcels]
            filename_suggestion = f"Parcels_{'-'.join(parcel_nums)}.pdf"
            title = f"Export {len(selected_parcels)} Selected Parcels to PDF"

        path = filedialog.asksaveasfilename(
            title=title,
            defaultextension=".pdf",
            filetypes=(("PDF Files", "*.pdf"), ("All Files", "*.*")),
            initialfile=filename_suggestion
        )
        if not path:
            return

        try:
            ensure_reportlab()
        except Exception as exc:
            messagebox.showerror("ReportLab Missing", str(exc))
            return

        try:
            # Export selected parcels using the multi-parcel export function
            # Get file heading from project
            file_heading = None
            if self.project_path:
                try:
                    state = load_project(self.project_path)
                    file_heading = state.get('file_heading')
                except Exception:
                    pass
            
            export_parcels_pdf(
                pdf_path=path,
                parcels=selected_parcels,
                points_by_id=self.points_by_id,
                work_settings=getattr(self.master, '_work_settings', {}),
                file_heading=file_heading,
            )
            # Open the PDF file automatically
            try:
                os.startfile(path)  # Windows
            except Exception:
                try:
                    subprocess.run(['start', path], shell=True)  # Windows fallback
                except Exception:
                    pass
            
            if len(selected_parcels) == 1:
                messagebox.showinfo("Exported", f"Parcel {selected_parcels[0]['parcel_number']} exported to:\n{path}")
            else:
                parcel_list = ", ".join(str(p['parcel_number']) for p in selected_parcels)
                messagebox.showinfo("Exported", f"Parcels {parcel_list} exported to:\n{path}")
        except Exception as exc:
            messagebox.showerror("Export Error", f"Failed to export selected parcels:\n{exc}")

    def menu_new_project(self):
        created = new_project_flow(self.master)
        if created is None:
            return
        path, state = created
        self.project_path = path
        self._hydrate_from_state(state)
        self.set_status("New project created")

    def menu_open_project(self):
        opened = open_project_flow(self.master)
        if opened is None:
            return
        path, state = opened
        self.project_path = path
        # Load points file for the project automatically
        proj_dir = os.path.dirname(path)
        pts_file = state.get("points_file")
        if pts_file:
            pts_path = os.path.join(proj_dir, pts_file)
            if os.path.exists(pts_path):
                self.points_by_id = read_points_any(pts_path)
                self.file_label_var.set(f"📁 Loaded {len(self.points_by_id)} points: {os.path.basename(pts_path)}")
                self.project_points_file = pts_file
                # Recompute saved parcels based on current coordinates
                self._recompute_all_saved_parcels(autosave=True)
                # Start watcher
                try:
                    self._start_points_watcher(os.path.abspath(pts_path))
                except Exception:
                    pass
            else:
                messagebox.showwarning("Project", f"Points file not found: {pts_path}\nYou may need to load points manually.")
                self.file_label_var.set("📁 No file loaded")
        else:
            self.file_label_var.set("📁 No file loaded")
        self._hydrate_from_state(state)
        self.set_status("Project opened")

    def menu_save_project(self):
        if not getattr(self, 'project_path', None):
            return self.menu_save_project_as()
        try:
            save_project(self.project_path, self._collect_state())
            self.set_status("Project saved")
        except Exception as exc:
            messagebox.showerror("Save Project", f"Failed to save project:\n{exc}")

    def menu_save_project_as(self):
        path = filedialog.asksaveasfilename(parent=self.master, title="Save Project As", defaultextension=".parproj", filetypes=(("Project Files","*.parproj"),("All Files","*.*")))
        if not path:
            return
        state = self._collect_state()
        # If state has no points_file, prompt to select and copy into project folder
        if not state.get("points_file"):
            src = pick_points_file()
            if not src:
                return
            proj_dir = os.path.dirname(path)
            os.makedirs(proj_dir, exist_ok=True)
            dst_name = os.path.basename(src)
            dst = os.path.join(proj_dir, dst_name)
            if not os.path.exists(dst):
                shutil.copy2(src, dst)
            state["points_file"] = dst_name
            self.project_points_file = dst_name
            try:
                self.points_by_id = read_points_any(dst)
                self.file_label_var.set(f"📁 Loaded {len(self.points_by_id)} points: {os.path.basename(dst)}")
            except Exception as exc:
                messagebox.showerror("Points", f"Failed to load points: {exc}")
        try:
            save_project(path, state)
            self.project_path = path
            self.set_status("Project saved")
        except Exception as exc:
            messagebox.showerror("Save Project", f"Failed to save project:\n{exc}")

    def on_begin_edit_selected(self):
        if len(self.entered_ids) == 0:
            return
        # For horizontal display, we'll edit the last added item by default
        # or allow user to click on specific items
        self.edit_index = len(self.entered_ids) - 1
        self.id_var.set(self.entered_ids[self.edit_index])
        self.id_entry.focus_set()
        self.set_status(f"Editing point {self.edit_index + 1} of {len(self.entered_ids)}")
        # Editing points invalidates curve specs to avoid mismatches
        if self.curve_specs:
            self.curve_specs = []
            self.set_status("Curves cleared due to edit")

    def on_delete_selected(self):
        if len(self.entered_ids) == 0:
            return
        # For horizontal display, we'll delete the last added item by default
        del self.entered_ids[-1]
        # Refresh horizontal display
        self._refresh_horizontal_display()
        self.edit_index = None
        # After deletion, recompute/clear area depending on closure
        self._refresh_area_if_closed(show_message=False)
        self.set_status("Point deleted")
        # Deleting points invalidates curve specs
        if self.curve_specs:
            self.curve_specs = []
            self.set_status("Curves cleared due to delete")
        # Autosave after deleting a saved parcel
        if self.project_path:
            try:
                save_project(self.project_path, self._collect_state())
            except Exception:
                pass

    def _refresh_area_if_closed(self, show_message=False):
        if len(self.entered_ids) >= 4 and self.entered_ids[-1] == self.entered_ids[0]:
            area = self._compute_area()
            if area is None:
                self.area_var.set("Area: -")
                self.computed_area = None
                return
            # On first closure event, offer curve segment adjustments
            if show_message:
                maybe_area = self._maybe_prompt_curve_segments()
                if maybe_area is not None:
                    area = maybe_area
            self.area_var.set(f"Area: {area:.3f}")
            self.computed_area = area
            if show_message:
                if messagebox.askyesno("Boundary Closed", f"Area = {area:.3f}. Continue to next parcel?\nYes = commit and start next, No = keep editing"):
                    self.on_commit_parcel()
        else:
            self.area_var.set("Area: -")
            self.computed_area = None

    # Modify on_add_id to support editing

    def on_commit_parcel(self):
        # Validate closure and parcel number
        if len(self.entered_ids) < 4 or self.entered_ids[-1] != self.entered_ids[0]:
            messagebox.showwarning("Not Closed", "Close the polygon by repeating the first ID.")
            return
        parcel_no = self.parcel_number_var.get().strip()
        if not parcel_no:
            messagebox.showwarning("Parcel Number", "Enter parcel number before saving parcel.")
            return
        area = self._compute_area()
        if area is None:
            messagebox.showerror("Area", "Unable to compute area.")
            return
        
        # Check if parcel number already exists and replace it
        existing_idx = None
        for i, p in enumerate(self.parcels):
            if str(p.get('parcel_number', '')) == str(parcel_no):
                existing_idx = i
                break
        
        new_parcel = {
            'parcel_number': parcel_no,
            'ids': list(self.entered_ids),
            'area': area,
            'curves': list(self.curve_specs),
        }
        
        if existing_idx is not None:
            # Replace existing parcel
            self.parcels[existing_idx] = new_parcel
            self.set_status(f"Parcel {parcel_no} updated (replaced existing).")
        else:
            # Add new parcel
            self.parcels.append(new_parcel)
            self.set_status(f"Parcel {parcel_no} saved.")
        
        # Save to project file immediately
        if self.project_path:
            try:
                save_project(self.project_path, self._collect_state())
            except Exception:
                pass
        
        # Refresh the list to show updated data
        self._refresh_saved_parcels_list()
        
        # Prepare for next parcel: increment number, clear list
        try:
            next_no = str(int(parcel_no) + 1)
        except Exception:
            next_no = parcel_no
        self.parcel_number_var.set(next_no)
        self.on_reset()
        # Focus parcel number for immediate manual confirmation/edit; keyboard-only
        try:
            self.parcel_entry.focus_set()
            self.parcel_entry.select_range(0, tk.END)
        except Exception:
            pass

    def _maybe_prompt_curve_segments(self):
        # Offer to configure curve segment adjustments after closure
        try:
            unique_ids = self.entered_ids[:-1]
            if len(unique_ids) < 3:
                return None
            # Base area before adjustments
            base_area = None
            try:
                # Temporarily stash and clear curves to get base
                old = list(self.curve_specs)
                self.curve_specs = []
                base_area = self._compute_area()
                self.curve_specs = old
            except Exception:
                pass
            # Ask user if they want to apply or edit segments
            prompt = "Apply curve segment adjustment?"
            if self.curve_specs:
                # If exists, ask whether to keep or replace
                if messagebox.askyesno("Curves", "Keep existing curve adjustments?\nYes = keep, No = replace"):
                    return self._compute_area()
                else:
                    self.curve_specs = []
            more = messagebox.askyesno("Curves", prompt)
            if not more:
                return self._compute_area()
            # Build valid consecutive legs set
            legs = set()
            for i in range(len(unique_ids)):
                a = unique_ids[i]
                b = unique_ids[(i+1) % len(unique_ids)]
                legs.add((a,b))
                legs.add((b,a))  # accept reverse input for convenience
            # Loop to add multiple segments
            while True:
                add_mode = messagebox.askyesno("Curves", "Add or Subtract?\nYes = Add, No = Subtract")
                sign = 1 if add_mode else -1
                frm = simpledialog.askstring("Curves", "From point ID:", parent=self.master)
                if not frm:
                    break
                to = simpledialog.askstring("Curves", "To point ID:", parent=self.master)
                if not to:
                    break
                if (frm, to) not in legs:
                    messagebox.showerror("Curves", "Selected points are not consecutive on the boundary.")
                    # Ask to try again
                    if not messagebox.askyesno("Curves", "Try again?"):
                        break
                    else:
                        continue
                m_text = simpledialog.askstring("Curves", "Middle ordinate (M):", parent=self.master)
                if not m_text:
                    break
                try:
                    M = float(m_text)
                except Exception:
                    messagebox.showerror("Curves", "Enter a numeric middle ordinate.")
                    if not messagebox.askyesno("Curves", "Try again?"):
                        break
                    else:
                        continue
                if M <= 0:
                    messagebox.showerror("Curves", "Middle ordinate must be positive.")
                    if not messagebox.askyesno("Curves", "Try again?"):
                        break
                    else:
                        continue
                # Normalize direction to match stored leg orientation
                spec = {'from': frm, 'to': to, 'M': M, 'sign': sign}
                # Replace if already present for same leg orientation
                replaced = False
                for i,s in enumerate(self.curve_specs):
                    if s.get('from') == spec['from'] and s.get('to') == spec['to']:
                        self.curve_specs[i] = spec
                        replaced = True
                        break
                if not replaced:
                    self.curve_specs.append(spec)
                # Ask to add more
                if not messagebox.askyesno("Curves", "Add another segment?"):
                    break
            # Return adjusted area
            return self._compute_area()
        except Exception:
            return None

    def on_export_pdf(self):
        if not self.points_by_id:
            messagebox.showwarning("No Points", "Load a points file first.")
            return
        # Require closed polygon and computed area
        if not self.entered_ids or len(self.entered_ids) < 4 or self.entered_ids[-1] != self.entered_ids[0]:
            # It's okay if current parcel not closed; export committed ones only
            if not self.parcels:
                messagebox.showwarning("Nothing to Export", "Commit at least one parcel or close current parcel.")
                return
        parcel_no = self.parcel_number_var.get().strip()
        # If current is closed, offer to include it
        if self.entered_ids and len(self.entered_ids) >= 4 and self.entered_ids[-1] == self.entered_ids[0]:
            if messagebox.askyesno("Include Current Parcel", "Include the current closed parcel in the export?"):
                area = self._compute_area()
                if area is not None:
                    self.parcels.append({'parcel_number': parcel_no or str(len(self.parcels)+1), 'ids': list(self.entered_ids), 'area': area, 'curves': list(self.curve_specs)})
        # Do not force area computation for the current working parcel here.
        # Export should succeed as long as there is at least one saved parcel.

        path = filedialog.asksaveasfilename(
            title="Save PDF",
            defaultextension=".pdf",
            filetypes=(("PDF Files", "*.pdf"), ("All Files", "*.*")),
        )
        if not path:
            return
        try:
            ensure_reportlab()
        except Exception as exc:
            messagebox.showerror("ReportLab Missing", str(exc))
            return
        try:
            # Get file heading from project
            file_heading = None
            if self.project_path:
                try:
                    state = load_project(self.project_path)
                    file_heading = state.get('file_heading')
                except Exception:
                    pass
            
            # Read parcels from project file to get the most current data
            parcels = self.parcels  # Default fallback
            if self.project_path and os.path.exists(self.project_path):
                try:
                    state = load_project(self.project_path)
                    parcels = state.get("parcels", [])
                except Exception:
                    pass
            
            export_parcels_pdf(
                pdf_path=path,
                parcels=parcels,
                points_by_id=self.points_by_id,
                work_settings=getattr(self.master, '_work_settings', {}),
                file_heading=file_heading,
            )
            # Open the PDF file automatically
            try:
                os.startfile(path)  # Windows
            except Exception:
                try:
                    subprocess.run(['start', path], shell=True)  # Windows fallback
                except Exception:
                    pass
            
            messagebox.showinfo("Exported", f"PDF saved to:\n{path}")
        except Exception as exc:
            messagebox.showerror("Export Error", f"Failed to export PDF:\n{exc}")


def ensure_reportlab():
    try:
        import reportlab  # noqa: F401
        return
    except Exception:
        # Try to install via pip
        pip_exe = sys.executable
        try:
            subprocess.check_call([pip_exe, "-m", "pip", "install", "reportlab"])  # may prompt/print
        except Exception as install_exc:
            raise RuntimeError(
                "ReportLab is required to export PDF. Install it with: pip install reportlab"
            ) from install_exc


def compute_parcel_area_from_points(parcel_ids, points_by_id, curves=None):
    """Compute area for a closed parcel from current coordinates and optional curves.
    - parcel_ids: sequence of point IDs; last may repeat the first (closed).
    - points_by_id: dict id -> (x, y)
    - curves: list of dicts {from, to, M, sign}
    Returns float area or None if cannot compute.
    """
    try:
        if not parcel_ids or len(parcel_ids) < 3:
            return None
        # Ensure closed
        ids_unique = parcel_ids[:-1] if len(parcel_ids) >= 2 and parcel_ids[-1] == parcel_ids[0] else list(parcel_ids)
        if len(ids_unique) < 3:
            return None
        # Build vertices
        vertices = []
        for pid in ids_unique:
            if pid not in points_by_id:
                return None
            vertices.append(points_by_id[pid])
        # Shoelace base area
        area2 = 0.0
        n = len(vertices)
        for i in range(n):
            x1, y1 = vertices[i]
            x2, y2 = vertices[(i + 1) % n]
            area2 += x1 * y2 - x2 * y1
        base_area = abs(area2) / 2.0
        if not curves:
            return base_area
        # Apply curve segment adjustments
        adjustments = 0.0
        def _dist(a, b):
            return ((b[0]-a[0])**2 + (b[1]-a[1])**2) ** 0.5
        # Consecutive leg pairs
        pairs = []
        for i in range(len(ids_unique)):
            a = ids_unique[i]
            b = ids_unique[(i+1) % len(ids_unique)]
            pairs.append((a, b))
        from math import asin, sin
        for spec in curves:
            try:
                frm = spec.get('from')
                to = spec.get('to')
                M = float(spec.get('M', 0.0))
                if M <= 0:
                    continue
                # Locate leg (accept reverse)
                try:
                    _ = next(i for i,(a,b) in enumerate(pairs) if a == frm and b == to)
                except StopIteration:
                    try:
                        _ = next(i for i,(a,b) in enumerate(pairs) if a == to and b == frm)
                        frm, to = to, frm
                    except StopIteration:
                        continue
                if frm not in points_by_id or to not in points_by_id:
                    continue
                A = points_by_id[frm]
                B = points_by_id[to]
                C = _dist(A, B)
                if C <= 0:
                    continue
                R = (C*C) / (8.0*M) + (M/2.0)
                theta = 2.0 * asin(min(1.0, max(0.0, C/(2.0*R))))
                seg_area = 0.5 * R*R * (theta - sin(theta))
                sign = spec.get('sign', 1)
                if sign not in (1, '+', 'add', 'ADD', 'Add'):
                    seg_area = -seg_area
                adjustments += seg_area
            except Exception:
                continue
        return base_area + adjustments
    except Exception:
        return None


def export_parcel_pdf(pdf_path, parcel_ids, points_by_id, area_value, parcel_number):
    from reportlab.lib.pagesizes import A4
    from reportlab.platypus import SimpleDocTemplate, Spacer, Preformatted
    from reportlab.lib.styles import ParagraphStyle
    from math import atan2, degrees, hypot

    # Build unique vertex list and closed pairs
    ids_unique = parcel_ids[:-1] if len(parcel_ids) >= 2 and parcel_ids[-1] == parcel_ids[0] else parcel_ids[:]
    pairs = []
    for i in range(len(ids_unique)):
        a = ids_unique[i]
        b = ids_unique[(i + 1) % len(ids_unique)]
        pairs.append((a, b))

    # Compute distance and azimuth per leg
    def azimuth_deg(from_xy, to_xy):
        dx = to_xy[0] - from_xy[0]
        dy = to_xy[1] - from_xy[1]
        ang = degrees(atan2(dx, dy))  # from North clockwise
        return (ang + 360.0) % 360.0

    lines = []
    lines.append("PARCEL  NUMBER".ljust(18) + f"{parcel_number}")
    lines.append("")
    lines.append("ANGLES   IN   DEGREES")
    lines.append("=" * 50)
    lines.append("")
    # Header row
    header = f"{'FROM':<4}  {'TO':<4}  {'DISTANCE':>8}  {'AZIMUTH':>8}    {'POINT':<5}  {'Y':>10}  {'X':>10}"
    sep    = f"{'====':<4}  {'====':<4}  {'========':>8}  {'========':>8}    {'=====':<5}  {'==========':>10}  {'==========':>10}"
    lines.append(header)
    lines.append(sep)

    # Table rows (legs and point coords side by side)
    for (frm, to) in pairs:
        p_from = points_by_id[frm]
        p_to = points_by_id[to]
        dist = hypot(p_to[0] - p_from[0], p_to[1] - p_from[1])
        azi = azimuth_deg(p_from, p_to)
        # The example shows alongside a point row for 'to' with Y then X
        yx_point = points_by_id[to]
        line = (
            f"{str(frm):<4}  {str(to):<4}  "
            f"{dist:>8.2f}  {azi:>8.4f}    "
            f"{str(to):<5}  {yx_point[1]:>10.2f}  {yx_point[0]:>10.2f}"
        )
        lines.append(line)

    # No curve breakdown in single-parcel variant; only final area
    lines.append("")
    lines.append(f"AREA = {area_value:.3f}")

    mono = ParagraphStyle(name='mono', fontName='Courier', fontSize=10, leading=12)
    body = "\n".join(lines)

    doc = SimpleDocTemplate(
        pdf_path, pagesize=A4, leftMargin=36, rightMargin=36, topMargin=36, bottomMargin=36
    )
    story = [Preformatted(body, mono)]
    doc.build(story)


def export_parcels_pdf(pdf_path, parcels, points_by_id, work_settings=None, file_heading=None):
    from reportlab.lib.pagesizes import A4
    from reportlab.platypus import SimpleDocTemplate, Spacer, Preformatted, PageBreak
    from reportlab.lib.styles import ParagraphStyle
    from math import atan2, degrees, hypot

    mono = ParagraphStyle(name='mono', fontName='Courier', fontSize=10, leading=12)
    header_style = ParagraphStyle(name='header', fontName='Courier-Bold', fontSize=12, leading=14)
    blocks = []
    
    # Add file heading if provided
    if file_heading:
        heading_lines = []
        heading_lines.append("="*60)
        if file_heading.get('block'):
            heading_lines.append(f"BLOCK: {file_heading['block']}")
        if file_heading.get('quarter'):
            heading_lines.append(f"QUARTER: {file_heading['quarter']}")
        if file_heading.get('parcels'):
            heading_lines.append(f"PARCELS: {file_heading['parcels']}")
        if file_heading.get('place'):
            heading_lines.append(f"PLACE: {file_heading['place']}")
        if file_heading.get('additional_info'):
            heading_lines.append("")
            heading_lines.append(file_heading['additional_info'])
        heading_lines.append("="*60)
        heading_lines.append("")
        
        blocks.append("\n".join(heading_lines))

    # Use work mode settings for angle units
    if not work_settings:
        work_settings = {}
    angle_unit = work_settings.get('unit', 'Degrees')
    is_grades = (angle_unit.lower() == 'grades')

    for parcel in parcels:
        parcel_number = parcel['parcel_number']
        parcel_ids = parcel['ids']
        # Build pairs
        ids_unique = parcel_ids[:-1] if len(parcel_ids) >= 2 and parcel_ids[-1] == parcel_ids[0] else parcel_ids[:]
        pairs = []
        for i in range(len(ids_unique)):
            a = ids_unique[i]
            b = ids_unique[(i + 1) % len(ids_unique)]
            pairs.append((a, b))

        def azimuth_deg(from_xy, to_xy):
            dx = to_xy[0] - from_xy[0]
            dy = to_xy[1] - from_xy[1]
            ang = degrees(atan2(dx, dy))
            if is_grades:
                ang = ang * 400.0 / 360.0  # Convert degrees to grades
            return (ang + (400.0 if is_grades else 360.0)) % (400.0 if is_grades else 360.0)

        lines = []
        lines.append("PARCEL  NUMBER".ljust(18) + f"{parcel_number}")
        lines.append("")
        lines.append(f"ANGLES   IN   {angle_unit.upper()}")
        lines.append("=" * 50)
        lines.append("")
        header = f"{'FROM':<4}  {'TO':<4}  {'DISTANCE':>8}  {'AZIMUTH':>8}    {'POINT':<5}  {'Y':>10}  {'X':>10}"
        sep    = f"{'====':<4}  {'====':<4}  {'========':>8}  {'========':>8}    {'=====':<5}  {'==========':>10}  {'==========':>10}"
        lines.append(header)
        lines.append(sep)
        for (frm, to) in pairs:
            p_from = points_by_id[frm]
            p_to = points_by_id[to]
            dist = hypot(p_to[0] - p_from[0], p_to[1] - p_from[1])
            azi = azimuth_deg(p_from, p_to)
            yx_point = points_by_id[to]
            line = (
                f"{str(frm):<4}  {str(to):<4}  "
                f"{dist:>8.2f}  {azi:>8.4f}    "
                f"{str(to):<5}  {yx_point[1]:>10.2f}  {yx_point[0]:>10.2f}"
            )
            lines.append(line)
        # If there are curve adjustments saved with the parcel, print summary line(s) like the example
        curves = parcel.get('curves') or []
        if curves:
            from math import asin, sin
            def _dist(a, b):
                return ((b[0]-a[0])**2 + (b[1]-a[1])**2) ** 0.5
            for spec in curves:
                try:
                    frm = spec.get('from')
                    to = spec.get('to')
                    M = float(spec.get('M', 0.0))
                    if M <= 0:
                        continue
                    A = points_by_id.get(frm)
                    B = points_by_id.get(to)
                    if A is None or B is None:
                        continue
                    C = _dist(A, B)
                    if C <= 0:
                        continue
                    R = (C*C) / (8.0*M) + (M/2.0)
                    # Compute signed segment area to show as PARCEL AREA (adjustment amount)
                    theta = 2.0 * asin(min(1.0, max(0.0, C/(2.0*R))))
                    seg_area = 0.5 * R*R * (theta - sin(theta))
                    seg_area_signed = seg_area  # default positive
                    # Sign is determined by user specification; negative means subtract
                    sign = spec.get('sign', 1)
                    if sign not in (1, '+', 'add', 'ADD', 'Add'):
                        seg_area_signed = -seg_area
                    # Example formatting targeted:
                    # FROM PARCEL  107 --> 109 =  2.29   R =  3.73   F =  0.180   PARCEL AREA=  0.28
                    lines.append("")
                    lines.append(
                        f"FROM PARCEL  {str(frm)} --> {str(to)} =  {C:0.2f}   R =  {R:0.2f}   F =  {M:0.3f}   PARCEL AREA=  {seg_area_signed:0.2f}"
                    )
                except Exception:
                    continue
        lines.append("")
        # Compute area from current coordinates (ignore stored 'area')
        computed_area = compute_parcel_area_from_points(parcel_ids, points_by_id, parcel.get('curves'))
        lines.append(f"AREA = {computed_area:.3f}")
        blocks.append("\n".join(lines))

    # Add page numbers and build PDF
    from reportlab.platypus import PageTemplate, Frame
    from reportlab.lib.units import inch
    
    def add_page_number(canvas, doc):
        """Add page numbers to each page."""
        canvas.saveState()
        canvas.setFont('Helvetica', 9)
        page_num = canvas.getPageNumber()
        text = f"Page {page_num}"
        canvas.drawRightString(A4[0] - 36, 36, text)
        canvas.restoreState()
    
    doc = SimpleDocTemplate(
        pdf_path, pagesize=A4, leftMargin=36, rightMargin=36, topMargin=36, bottomMargin=50
    )
    
    story = []
    for idx, block in enumerate(blocks):
        story.append(Preformatted(block, mono if idx > 0 else header_style))
        if idx != len(blocks) - 1:
            story.append(Spacer(1, 24))
    
    doc.build(story, onFirstPage=add_page_number, onLaterPages=add_page_number)


# ---------- Project helpers ----------

def get_app_data_dir():
    base = os.environ.get('LOCALAPPDATA') or os.path.expanduser('~')
    path = os.path.join(base, 'ParcelAreaApp')
    os.makedirs(path, exist_ok=True)
    return path


def save_project(project_path, state):
    if not project_path.lower().endswith('.parproj'):
        project_path += '.parproj'
    proj_dir = os.path.dirname(project_path)
    os.makedirs(proj_dir, exist_ok=True)
    with open(project_path, 'w', encoding='utf-8') as f:
        json.dump(state, f, ensure_ascii=False, indent=2)
    # Track recent projects
    recent_path = os.path.join(get_app_data_dir(), 'recent.json')
    recent = []
    if os.path.exists(recent_path):
        try:
            with open(recent_path, 'r', encoding='utf-8') as rf:
                recent = json.load(rf)
        except Exception:
            recent = []
    if project_path in recent:
        recent.remove(project_path)
    recent.insert(0, project_path)
    recent = recent[:10]
    with open(recent_path, 'w', encoding='utf-8') as rf:
        json.dump(recent, rf, ensure_ascii=False, indent=2)


def load_project(project_path):
    with open(project_path, 'r', encoding='utf-8') as f:
        return json.load(f)


def new_project_flow(master):
    pts = pick_points_file()
    if not pts:
        return None
    default_name = os.path.splitext(os.path.basename(pts))[0] + '.parproj'
    save_path = filedialog.asksaveasfilename(parent=master, title='Create Project', initialfile=default_name, defaultextension='.parproj', filetypes=(("Project Files","*.parproj"),("All Files","*.*")))
    if not save_path:
        return None
    proj_dir = os.path.dirname(save_path)
    os.makedirs(proj_dir, exist_ok=True)
    dst_name = os.path.basename(pts)
    dst = os.path.join(proj_dir, dst_name)
    if not os.path.exists(dst):
        shutil.copy2(pts, dst)
    state = {
        "parcel_number": "",
        "entered_ids": [],
        "points_file": dst_name,
        "parcels": [],
    }
    save_project(save_path, state)
    return save_path, state


def open_project_flow(master):
    path = filedialog.askopenfilename(parent=master, title='Open Project', defaultextension='.parproj', filetypes=(("Project Files","*.parproj"),("All Files","*.*")))
    if not path:
        return None
    state = load_project(path)
    # The points file will be loaded automatically when the project is opened
    # No need to check here - the main app will handle it
    # Guarantee keys
    state.setdefault('parcels', [])
    state.setdefault('entered_ids', [])
    state.setdefault('parcel_number', '')
    return path, state


def main():
    root = tk.Tk()
    # Set default window size but allow resizing with minimum constraints
    root.geometry("1200x800")
    root.minsize(800, 600)  # Allow resizing but set minimum size
    # Background icons are now added per-page instead of globally
    MainMenu(root)
    root.mainloop()


if __name__ == "__main__":
    main()
