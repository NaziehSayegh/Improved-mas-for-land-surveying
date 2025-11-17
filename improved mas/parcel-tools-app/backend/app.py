"""
Flask Backend API for Parcel Tools Desktop App
Provides endpoints for area calculations, point management, and data operations
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import json
import os
import math
from datetime import datetime
import re

app = Flask(__name__)
CORS(app)  # Enable CORS for Electron frontend

# Data storage paths
DATA_DIR = os.path.join(os.path.dirname(__file__), 'data')
PROJECTS_FILE = os.path.join(DATA_DIR, 'projects.json')
POINTS_DIR = os.path.join(DATA_DIR, 'points')
AI_CONFIG_FILE = os.path.join(DATA_DIR, 'ai_config.json')
RECENT_FILES_FILE = os.path.join(DATA_DIR, 'recent_files.json')

# Ensure data directories exist
os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(POINTS_DIR, exist_ok=True)


def load_projects():
    """Load projects from JSON file"""
    if os.path.exists(PROJECTS_FILE):
        with open(PROJECTS_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return []


def save_projects(projects):
    """Save projects to JSON file"""
    with open(PROJECTS_FILE, 'w', encoding='utf-8') as f:
        json.dump(projects, f, indent=2, ensure_ascii=False)


def load_ai_config():
    if os.path.exists(AI_CONFIG_FILE):
        try:
            with open(AI_CONFIG_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception:
            return {}
    return {}


def save_ai_config(cfg):
    try:
        with open(AI_CONFIG_FILE, 'w', encoding='utf-8') as f:
            json.dump(cfg, f, indent=2)
        return True
    except Exception:
        return False


def load_recent_files():
    """Load recent files history"""
    if os.path.exists(RECENT_FILES_FILE):
        try:
            with open(RECENT_FILES_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception:
            return {'projects': [], 'points': []}
    return {'projects': [], 'points': []}


def save_recent_files(recent_files):
    """Save recent files history"""
    try:
        with open(RECENT_FILES_FILE, 'w', encoding='utf-8') as f:
            json.dump(recent_files, f, indent=2, ensure_ascii=False)
        return True
    except Exception:
        return False


def add_to_recent_files(file_type, file_path, file_name, metadata=None):
    """Add a file to recent files history"""
    print(f'[Recent Files] Adding {file_type}: {file_path}')
    recent = load_recent_files()
    print(f'[Recent Files] Current {file_type} count: {len(recent.get(file_type, []))}')
    file_list = recent.get(file_type, [])
    
    # Remove if already exists
    file_list = [f for f in file_list if f.get('path') != file_path]
    
    # Add to beginning
    file_entry = {
        'path': file_path,
        'name': file_name,
        'lastAccessed': datetime.now().isoformat(),
        'metadata': metadata or {}
    }
    file_list.insert(0, file_entry)
    
    # Keep only last 50 entries per type
    file_list = file_list[:50]
    
    recent[file_type] = file_list
    save_result = save_recent_files(recent)
    print(f'[Recent Files] Save result: {save_result}, New {file_type} count: {len(file_list)}')
    return recent


@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({'status': 'ok', 'message': 'Parcel Tools API is running'})


@app.route('/api/calculate-area', methods=['POST'])
def calculate_area():
    """
    Calculate parcel area using shoelace formula
    Expected JSON: { "points": [{"x": 0, "y": 0}, ...], "curves": [...] (optional) }
    """
    try:
        data = request.get_json()
        points = data.get('points', [])
        curves = data.get('curves', [])
        
        if len(points) < 3:
            return jsonify({'error': 'At least 3 points required'}), 400
        
        # Shoelace formula for polygon area
        base_area = 0
        n = len(points)
        for i in range(n):
            j = (i + 1) % n
            base_area += points[i]['x'] * points[j]['y']
            base_area -= points[j]['x'] * points[i]['y']
        
        base_area = abs(base_area) / 2
        
        # Calculate perimeter
        perimeter = 0
        for i in range(n):
            j = (i + 1) % n
            dx = points[j]['x'] - points[i]['x']
            dy = points[j]['y'] - points[i]['y']
            perimeter += math.sqrt(dx * dx + dy * dy)
        
        # Calculate centroid
        cx = sum(p['x'] for p in points) / n
        cy = sum(p['y'] for p in points) / n
        
        # Apply curve adjustments
        curve_adjustments = []
        total_curve_adjustment = 0
        
        if curves:
            for curve in curves:
                M = curve.get('M', 0)
                sign = curve.get('sign', 1)
                from_idx = curve.get('fromIndex', 0)
                to_idx = curve.get('toIndex', 1)
                
                if M > 0 and from_idx < len(points) and to_idx < len(points):
                    # Calculate chord length
                    from_pt = points[from_idx]
                    to_pt = points[to_idx]
                    dx = to_pt['x'] - from_pt['x']
                    dy = to_pt['y'] - from_pt['y']
                    C = math.sqrt(dx * dx + dy * dy)
                    
                    if C > 0:
                        # Calculate radius and segment area
                        R = (C * C) / (8.0 * M) + (M / 2.0)
                        theta = 2.0 * math.asin(min(1.0, C / (2.0 * R)))
                        seg_area = 0.5 * R * R * (theta - math.sin(theta))
                        
                        adjustment = seg_area * sign
                        total_curve_adjustment += adjustment
                        
                        curve_adjustments.append({
                            'C': C,
                            'R': R,
                            'F': seg_area / (C * C) if C > 0 else 0,
                            'segmentArea': seg_area,
                            'adjustment': adjustment
                        })
        
        final_area = base_area + total_curve_adjustment
        
        return jsonify({
            'baseArea': round(base_area, 4),
            'curveAdjustment': round(total_curve_adjustment, 4),
            'area': round(final_area, 4),
            'perimeter': round(perimeter, 4),
            'centroid': {'x': round(cx, 4), 'y': round(cy, 4)},
            'point_count': n,
            'curveDetails': curve_adjustments
        })
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/calculate-area-error', methods=['POST'])
def calculate_area_error():
    """
    Calculate error statistics for parcel area
    Error propagation based on coordinate precision
    Expected JSON: { 
        "points": [{"x": 0, "y": 0, "errorX": 0.01, "errorY": 0.01}, ...], 
        "area": 1000.0,
        "coordinateError": 0.01 (optional, default if not in points)
    }
    """
    try:
        data = request.get_json()
        points = data.get('points', [])
        area = data.get('area', 0)
        default_coord_error = data.get('coordinateError', 0.01)  # Default 1cm error
        
        if len(points) < 3:
            return jsonify({'error': 'At least 3 points required'}), 400
        
        n = len(points)
        
        # Error propagation for shoelace formula
        # Area A = 0.5 * |Σ(xi*yi+1 - xi+1*yi)|
        # Partial derivatives: ∂A/∂xi = 0.5 * (yi-1 - yi+1)
        #                      ∂A/∂yi = 0.5 * (xi+1 - xi-1)
        
        variance_sum = 0.0
        
        for i in range(n):
            # Get coordinate errors (use default if not provided)
            error_x = points[i].get('errorX', default_coord_error)
            error_y = points[i].get('errorY', default_coord_error)
            
            # Previous and next indices (circular)
            prev_idx = (i - 1) % n
            next_idx = (i + 1) % n
            
            # Partial derivatives
            dA_dxi = 0.5 * (points[prev_idx]['y'] - points[next_idx]['y'])
            dA_dyi = 0.5 * (points[next_idx]['x'] - points[prev_idx]['x'])
            
            # Variance contribution: (∂A/∂xi)²σx² + (∂A/∂yi)²σy²
            variance_sum += (dA_dxi ** 2) * (error_x ** 2) + (dA_dyi ** 2) * (error_y ** 2)
        
        # Standard error of area
        standard_error = math.sqrt(variance_sum)
        
        # Relative error (percentage)
        relative_error = (standard_error / area * 100) if area > 0 else 0
        
        # Confidence intervals (assuming normal distribution)
        # 68% confidence (1σ), 95% confidence (2σ), 99.7% confidence (3σ)
        ci_68_lower = area - standard_error
        ci_68_upper = area + standard_error
        ci_95_lower = area - 2 * standard_error
        ci_95_upper = area + 2 * standard_error
        ci_99_lower = area - 3 * standard_error
        ci_99_upper = area + 3 * standard_error
        
        # Error ellipse parameters (simplified)
        # Maximum error contribution
        max_error_contribution = max([
            math.sqrt((0.5 * (points[(i-1)%n]['y'] - points[(i+1)%n]['y']))**2 * 
                     (points[i].get('errorX', default_coord_error)**2) +
                     (0.5 * (points[(i+1)%n]['x'] - points[(i-1)%n]['x']))**2 * 
                     (points[i].get('errorY', default_coord_error)**2))
            for i in range(n)
        ])
        
        return jsonify({
            'area': round(area, 4),
            'standardError': round(standard_error, 6),
            'relativeError': round(relative_error, 4),
            'variance': round(variance_sum, 8),
            'confidenceIntervals': {
                '68': {
                    'lower': round(ci_68_lower, 4),
                    'upper': round(ci_68_upper, 4),
                    'range': round(2 * standard_error, 4)
                },
                '95': {
                    'lower': round(ci_95_lower, 4),
                    'upper': round(ci_95_upper, 4),
                    'range': round(4 * standard_error, 4)
                },
                '99': {
                    'lower': round(ci_99_lower, 4),
                    'upper': round(ci_99_upper, 4),
                    'range': round(6 * standard_error, 4)
                }
            },
            'maxErrorContribution': round(max_error_contribution, 6),
            'pointCount': n
        })
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/project/save', methods=['POST'])
def save_project_file():
    """Save complete project state to file - REQUIRES user-selected filePath"""
    try:
        data = request.get_json()
        project_name = data.get('projectName', 'untitled')
        project_data = data.get('projectData', {})
        custom_filepath = data.get('filePath')  # REQUIRED: user must select a path
        
        # REQUIRE user-selected path - never save to app data directory
        if not custom_filepath:
            return jsonify({'error': 'File path is required. User must select a save location.'}), 400
        
        # Use the user-selected path
        filepath = custom_filepath
        # Ensure .prcl extension
        if not filepath.lower().endswith('.prcl'):
            filepath += '.prcl'
        
        # Ensure directory exists (for the user-selected path)
        file_dir = os.path.dirname(filepath)
        if file_dir:
            os.makedirs(file_dir, exist_ok=True)
        
        # Save project data
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(project_data, f, indent=2, ensure_ascii=False)
        
        # Add to recent files
        metadata = {
            'projectName': project_name,
            'parcelCount': len(project_data.get('savedParcels', [])),
            'pointsCount': len(project_data.get('loadedPoints', {}))
        }
        print(f'[Save] Adding to recent files: {filepath}')
        add_to_recent_files('projects', filepath, os.path.basename(filepath), metadata)
        print(f'[Save] Recent files updated successfully')
        
        return jsonify({
            'success': True,
            'message': 'Project saved successfully',
            'filePath': filepath,
            'fileName': os.path.basename(filepath)
        })
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/project/load', methods=['POST'])
def load_project_file():
    """Load project from file content or file path"""
    try:
        data = request.get_json()
        file_content = data.get('fileContent', '')
        file_path = data.get('filePath', '')
        file_name = data.get('fileName', '')
        
        # If file path or name is provided, try to load from backend/data
        loaded_file_path = None
        if file_path or file_name:
            if file_name and not file_path:
                # Load from backend/data directory
                file_path = os.path.join(DATA_DIR, file_name)
            
            if os.path.exists(file_path):
                loaded_file_path = file_path
                with open(file_path, 'r', encoding='utf-8') as f:
                    project_data = json.load(f)
            else:
                return jsonify({'error': f'File not found: {file_path}'}), 404
        elif file_content:
            # Parse JSON from provided content
            project_data = json.loads(file_content)
            # If we have a path from the file, use it
            if file_path and os.path.exists(file_path):
                loaded_file_path = file_path
        else:
            return jsonify({'error': 'No file content, filePath, or fileName provided'}), 400
        
        # Add to recent files if we have a valid path
        if loaded_file_path:
            metadata = {
                'projectName': project_data.get('projectName', ''),
                'parcelCount': len(project_data.get('savedParcels', [])),
                'pointsCount': len(project_data.get('loadedPoints', {}))
            }
            add_to_recent_files('projects', loaded_file_path, os.path.basename(loaded_file_path), metadata)
        
        return jsonify({
            'success': True,
            'projectData': project_data,
            'filePath': loaded_file_path  # Return the file path for auto-save
        })
    
    except json.JSONDecodeError as e:
        return jsonify({'error': f'Invalid JSON: {str(e)}'}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/projects', methods=['GET'])
def list_project_files():
    """List all saved project files (from DATA_DIR and recent files)"""
    try:
        projects = []
        project_paths_seen = set()  # Track paths to avoid duplicates
        
        # First, get projects from DATA_DIR
        if os.path.exists(DATA_DIR):
            for filename in os.listdir(DATA_DIR):
                if filename.endswith('.prcl'):
                    filepath = os.path.join(DATA_DIR, filename)
                    try:
                        if os.path.exists(filepath):
                            with open(filepath, 'r', encoding='utf-8') as f:
                                data = json.load(f)
                            
                            projects.append({
                                'fileName': filename,
                                'filePath': filepath,
                                'projectName': data.get('projectName', filename.replace('.prcl', '')),
                                'savedParcels': len(data.get('savedParcels', [])),
                                'pointsFile': data.get('pointsFileName', 'N/A'),
                                'lastModified': os.path.getmtime(filepath)
                            })
                            project_paths_seen.add(filepath)
                    except Exception:
                        continue
        
        # Also include projects from recent files (includes custom paths from Save As)
        # First clean up recent files to remove deleted entries
        recent = load_recent_files()
        cleaned_projects = []
        cleaned_points = []
        needs_cleanup = False
        
        # Clean projects in recent files
        for file_entry in recent.get('projects', []):
            filepath = file_entry.get('path', '')
            if filepath and os.path.exists(filepath):
                cleaned_projects.append(file_entry)
            else:
                needs_cleanup = True  # Found deleted file
        
        # Clean points in recent files
        for file_entry in recent.get('points', []):
            filepath = file_entry.get('path', '')
            if filepath and os.path.exists(filepath):
                cleaned_points.append(file_entry)
            else:
                needs_cleanup = True  # Found deleted file
        
        # Save cleaned list if needed
        if needs_cleanup:
            recent['projects'] = cleaned_projects
            recent['points'] = cleaned_points
            save_recent_files(recent)
        
        # Now process cleaned projects list
        for file_entry in cleaned_projects:
            filepath = file_entry.get('path', '')
            
            # Double-check file still exists (race condition protection)
            if not filepath or not os.path.exists(filepath):
                continue
            
            if filepath not in project_paths_seen:
                try:
                    # Check if it's already in DATA_DIR (skip to avoid duplicates)
                    if not filepath.startswith(DATA_DIR):
                        with open(filepath, 'r', encoding='utf-8') as f:
                            data = json.load(f)
                        
                        # Get last modified time
                        last_modified = os.path.getmtime(filepath)
                        
                        projects.append({
                            'fileName': os.path.basename(filepath),
                            'filePath': filepath,
                            'projectName': data.get('projectName', file_entry.get('name', '').replace('.prcl', '')),
                            'savedParcels': len(data.get('savedParcels', [])),
                            'pointsFile': data.get('pointsFileName', 'N/A'),
                            'lastModified': last_modified
                        })
                        project_paths_seen.add(filepath)
                except Exception:
                    # If file can't be read, skip it (already cleaned from recent files)
                    continue
        
        # Sort by last modified
        projects.sort(key=lambda x: x['lastModified'], reverse=True)
        
        print(f'[List Projects] Returning {len(projects)} projects')
        for p in projects:
            print(f'  - {p["projectName"]} ({p["fileName"]}) at {p["filePath"]}')
        
        return jsonify(projects)
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/check-file-modified', methods=['POST'])
def check_file_modified():
    """Check if a file has been modified"""
    try:
        data = request.get_json()
        file_path = data.get('filePath', '')
        
        if not os.path.exists(file_path):
            return jsonify({'error': 'File not found'}), 404
        
        modified_time = os.path.getmtime(file_path)
        
        return jsonify({'modified': modified_time})
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/reload-points-file', methods=['POST'])
def reload_points_file():
    """Reload points from file"""
    try:
        data = request.get_json()
        file_path = data.get('filePath', '')
        
        if not os.path.exists(file_path):
            return jsonify({'error': 'File not found'}), 404
        
        # Read points
        points = []
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith('#') or line.startswith('//'):
                    continue
                
                line = line.replace(';', ',')
                parts = [p.strip() for p in (line.split(',') if ',' in line else line.split()) if p.strip()]
                
                if len(parts) >= 3:
                    try:
                        point_id = parts[0]
                        x = float(parts[1])
                        y = float(parts[2])
                        points.append({'id': point_id, 'x': x, 'y': y})
                    except ValueError:
                        continue
        
        # Add to recent files
        metadata = {'pointsCount': len(points)}
        add_to_recent_files('points', file_path, os.path.basename(file_path), metadata)
        
        return jsonify({'points': points, 'count': len(points)})
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/import-points', methods=['POST'])
def import_points():
    """
    Import points from text data
    Expected JSON: { "data": "id,x,y\n1,0,0\n2,100,0\n..." }
    """
    try:
        data = request.get_json()
        text_data = data.get('data', '')
        
        points = []
        for line in text_data.strip().split('\n'):
            line = line.strip()
            if not line or line.startswith('#') or line.startswith('//'):
                continue
            
            # Replace semicolons with commas
            line = line.replace(';', ',')
            
            # Split by comma or whitespace
            parts = [p.strip() for p in (line.split(',') if ',' in line else line.split()) if p.strip()]
            
            if len(parts) >= 3:
                try:
                    point_id = parts[0]
                    x = float(parts[1])
                    y = float(parts[2])
                    points.append({'id': point_id, 'x': x, 'y': y})
                except ValueError:
                    continue
        
        if not points:
            return jsonify({'error': 'No valid points found'}), 400
        
        return jsonify({'points': points, 'count': len(points)})
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/save-points-file', methods=['POST'])
def save_points_file():
    """
    Save points back to .pnt/.txt file
    Expected JSON: { "fileName": "points.pnt", "content": "text data", "filePath": "..." }
    """
    try:
        data = request.get_json()
        file_name = data.get('fileName', 'points.pnt')
        content = data.get('content', '')
        file_path = data.get('filePath', '')
        
        # If we have a path, use it; otherwise save to data directory
        if file_path and os.path.dirname(file_path):
            save_path = file_path
        else:
            save_path = os.path.join(DATA_DIR, file_name)
        
        # Ensure directory exists
        os.makedirs(os.path.dirname(save_path) if os.path.dirname(save_path) else DATA_DIR, exist_ok=True)
        
        # Write file
        with open(save_path, 'w', encoding='utf-8') as f:
            f.write(content)
        
        return jsonify({
            'success': True,
            'message': 'Points file saved successfully',
            'fileName': os.path.basename(save_path),
            'filePath': save_path
        })
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/export-points', methods=['POST'])
def export_points():
    """
    Export points to text format
    Expected JSON: { "points": [{"id": "1", "x": 0, "y": 0}, ...] }
    """
    try:
        data = request.get_json()
        points = data.get('points', [])
        
        lines = ['# Parcel Tools - Point Export', f'# Generated: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}', '# Format: ID, X, Y', '']
        
        for point in points:
            lines.append(f"{point.get('id', '')}, {point.get('x', 0)}, {point.get('y', 0)}")
        
        return jsonify({'data': '\n'.join(lines)})
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/export-pdf', methods=['POST'])
def export_pdf():
    """
    Export parcels to PDF - PROFESSIONAL SURVEYING FORMAT
    Expected JSON: { "parcels": [...], "points": {...} }
    """
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.pdfgen import canvas
        import io
        import base64
        
        data = request.get_json()
        parcels = data.get('parcels', [])
        points_by_id = data.get('points', {})
        file_heading = data.get('fileHeading', {})
        error_results = data.get('errorResults', None)  # Error calculation results
        
        # Create PDF in memory
        buffer = io.BytesIO()
        c = canvas.Canvas(buffer, pagesize=A4)
        width, height = A4
        
        # Track if heading was added (only once)
        heading_added = False
        
        for parcel_idx, parcel in enumerate(parcels):
            # Only add new page if we run out of space, not for each parcel
            if parcel_idx == 0:
                y_position = height - 40
            else:
                # Check if we need a new page (add spacing between parcels)
                if y_position < 100:
                    c.showPage()
                    y_position = height - 40
                else:
                    y_position -= 30  # Space between parcels
            
            # Add file heading on first page only if it exists and has content
            if not heading_added and file_heading:
                # Check if heading has any actual content
                has_content = any([
                    file_heading.get('block'),
                    file_heading.get('quarter'),
                    file_heading.get('parcels'),
                    file_heading.get('place'),
                    file_heading.get('additionalInfo')
                ])
                
                if has_content:
                    c.setFont("Courier-Bold", 11)
                    c.drawString(40, y_position, "=" * 60)
                    y_position -= 15
                    
                    if file_heading.get('block'):
                        c.drawString(40, y_position, f"BLOCK: {file_heading['block']}")
                        y_position -= 12
                    if file_heading.get('quarter'):
                        c.drawString(40, y_position, f"QUARTER: {file_heading['quarter']}")
                        y_position -= 12
                    if file_heading.get('parcels'):
                        c.drawString(40, y_position, f"PARCELS: {file_heading['parcels']}")
                        y_position -= 12
                    if file_heading.get('place'):
                        c.drawString(40, y_position, f"PLACE: {file_heading['place']}")
                        y_position -= 12
                    if file_heading.get('additionalInfo'):
                        y_position -= 5
                        c.setFont("Courier", 9)
                        c.drawString(40, y_position, file_heading['additionalInfo'])
                        y_position -= 12
                    
                    c.setFont("Courier-Bold", 11)
                    c.drawString(40, y_position, "=" * 60)
                    y_position -= 25
                    
                    heading_added = True
            
            parcel_num = parcel.get('number', 'N/A')
            ids = parcel.get('ids', [])
            area = parcel.get('area', 0)
            curves = parcel.get('curves', [])
            
            # Get unique IDs (remove closing duplicate)
            ids_unique = ids[:-1] if len(ids) >= 2 and ids[-1] == ids[0] else ids[:]
            
            # PARCEL NUMBER
            c.setFont("Courier", 12)
            c.drawString(40, y_position, f"PARCEL  NUMBER    {parcel_num}")
            y_position -= 30
            
            # ANGLES IN DEGREES
            c.setFont("Courier", 10)
            c.drawString(40, y_position, "ANGLES   IN   DEGREES")
            y_position -= 15
            c.drawString(40, y_position, "=" * 60)
            y_position -= 25
            
            # Table header
            c.setFont("Courier", 9)
            header = f"{'FROM':<4}  {'TO':<4}  {'DISTANCE':>8}  {'AZIMUTH':>8}    {'POINT':<5}  {'Y':>10}  {'X':>10}"
            c.drawString(40, y_position, header)
            y_position -= 12
            
            sep = f"{'====':<4}  {'====':<4}  {'========':>8}  {'========':>8}    {'=====':<5}  {'==========':>10}  {'==========':>10}"
            c.drawString(40, y_position, sep)
            y_position -= 12
            
            # Calculate and draw each leg
            for i in range(len(ids_unique)):
                from_id = ids_unique[i]
                to_id = ids_unique[(i + 1) % len(ids_unique)]
                
                if from_id in points_by_id and to_id in points_by_id:
                    from_pt = points_by_id[from_id]
                    to_pt = points_by_id[to_id]
                    
                    # Calculate distance
                    dx = to_pt['x'] - from_pt['x']
                    dy = to_pt['y'] - from_pt['y']
                    distance = math.sqrt(dx * dx + dy * dy)
                    
                    # Calculate azimuth (bearing from north)
                    azimuth = math.degrees(math.atan2(dx, dy))
                    if azimuth < 0:
                        azimuth += 360.0
                    
                    # Format line exactly like the example
                    line = (
                        f"{str(from_id):<4}  {str(to_id):<4}  "
                        f"{distance:>8.2f}  {azimuth:>8.4f}    "
                        f"{str(to_id):<5}  {to_pt['y']:>10.2f}  {to_pt['x']:>10.2f}"
                    )
                    c.drawString(40, y_position, line)
                    y_position -= 12
                    
                    if y_position < 50:
                        c.showPage()
                        y_position = height - 40
                        c.setFont("Courier", 9)
            
            y_position -= 10
            
            # Curve calculations if any
            if curves:
                for curve in curves:
                    from_id = curve.get('from')
                    to_id = curve.get('to')
                    M = curve.get('M', 0)
                    sign = curve.get('sign', 1)
                    
                    if from_id in points_by_id and to_id in points_by_id:
                        from_pt = points_by_id[from_id]
                        to_pt = points_by_id[to_id]
                        
                        # Calculate chord length
                        dx = to_pt['x'] - from_pt['x']
                        dy = to_pt['y'] - from_pt['y']
                        C = math.sqrt(dx * dx + dy * dy)
                        
                        # Calculate radius and segment area
                        R = (C * C) / (8.0 * M) + (M / 2.0) if M > 0 else 0
                        theta = 2.0 * math.asin(min(1.0, C / (2.0 * R))) if R > 0 else 0
                        seg_area = 0.5 * R * R * (theta - math.sin(theta)) if R > 0 else 0
                        
                        # F value (sagitta factor)
                        F = seg_area / (C * C) if C > 0 else 0
                        
                        sign_text = "+" if sign == 1 else "-"
                        
                        curve_line = f"FROM PARCEL  {from_id} --> {to_id} = {C:.2f}   R = {R:.2f}   F = {F:.3f}   PARCEL AREA= {seg_area:.2f}"
                        c.drawString(40, y_position, curve_line)
                        y_position -= 12
                
                y_position -= 10
            
            # Final AREA
            c.setFont("Courier", 11)
            c.drawString(40, y_position, f"AREA = {area:.3f}")
            y_position -= 30
        
        # Add Error Calculations section if available
        if error_results and error_results.get('parcelResults'):
            # Check if we need a new page
            if y_position < 200:
                c.showPage()
                y_position = height - 40
            
            y_position -= 20
            
            # Error Calculations Header
            c.setFont("Courier-Bold", 12)
            c.drawString(40, y_position, "=" * 60)
            y_position -= 20
            c.drawString(40, y_position, "ERROR CALCULATIONS")
            y_position -= 15
            c.drawString(40, y_position, "=" * 60)
            y_position -= 25
            
            # Overall Summary
            c.setFont("Courier-Bold", 10)
            c.drawString(40, y_position, "OVERALL CALCULATION SUMMARY:")
            y_position -= 20
            
            c.setFont("Courier", 9)
            c.drawString(40, y_position, f"Total Registered Area:    {error_results['totalRegisteredArea']:.4f} m²")
            y_position -= 15
            c.drawString(40, y_position, f"Total Calculated Area:    {error_results['totalCalculatedArea']:.4f} m²")
            y_position -= 15
            c.drawString(40, y_position, f"Absolute Difference:      {error_results['absoluteDifference']:.4f} m²")
            y_position -= 15
            c.drawString(40, y_position, f"Permissible Error:        {error_results['permissibleError']:.4f} m²")
            y_position -= 20
            
            # Formula
            c.setFont("Courier", 8)
            formula_text = f"Formula: Permissible Error = 0.8 × √({error_results['totalRegisteredArea']:.2f}) + 0.002 × {error_results['totalRegisteredArea']:.2f}"
            c.drawString(40, y_position, formula_text)
            y_position -= 20
            
            # Status
            c.setFont("Courier-Bold", 10)
            if error_results['exceedsLimit']:
                c.drawString(40, y_position, "⚠ ERROR EXCEEDS PERMISSIBLE LIMITS - Using original calculated areas")
            else:
                c.drawString(40, y_position, "✓ WITHIN PERMISSIBLE LIMITS - Areas adjusted proportionally")
            y_position -= 30
            
            # Parcel Results Table Header
            c.setFont("Courier-Bold", 10)
            c.drawString(40, y_position, "PARCEL RESULTS:")
            y_position -= 20
            
            # Table header
            c.setFont("Courier", 8)
            header_line = f"{'Parcel #':<12} {'Original (m²)':>15} {'Adjusted (m²)':>15} {'Rounded (m²)':>15} {'Points':>8}"
            c.drawString(40, y_position, header_line)
            y_position -= 12
            
            sep_line = f"{'-'*12:<12} {'-'*15:>15} {'-'*15:>15} {'-'*15:>15} {'-'*8:>8}"
            c.drawString(40, y_position, sep_line)
            y_position -= 15
            
            # Parcel rows
            c.setFont("Courier", 8)
            for parcel_result in error_results['parcelResults']:
                if y_position < 60:
                    c.showPage()
                    y_position = height - 40
                    c.setFont("Courier", 8)
                
                parcel_num = str(parcel_result['parcelNumber'])
                original = parcel_result['calculatedArea']
                adjusted = parcel_result['adjustedArea']
                rounded = parcel_result['roundedArea']
                points = parcel_result['pointCount']
                
                row_line = f"{parcel_num:<12} {original:>15.4f} {adjusted:>15.4f} {rounded:>15} {points:>8}"
                c.drawString(40, y_position, row_line)
                y_position -= 12
            
            # Total row
            if y_position < 60:
                c.showPage()
                y_position = height - 40
            
            y_position -= 5
            c.setFont("Courier-Bold", 8)
            total_original = sum(p['calculatedArea'] for p in error_results['parcelResults'])
            total_adjusted = sum(p['adjustedArea'] for p in error_results['parcelResults'])
            total_rounded = sum(p['roundedArea'] for p in error_results['parcelResults'])
            total_points = sum(p['pointCount'] for p in error_results['parcelResults'])
            
            total_line = f"{'TOTAL:':<12} {total_original:>15.4f} {total_adjusted:>15.4f} {total_rounded:>15} {total_points:>8}"
            c.drawString(40, y_position, total_line)
            y_position -= 20
        
        c.save()
        
        # Convert to base64 to send to frontend
        buffer.seek(0)
        pdf_data = base64.b64encode(buffer.read()).decode('utf-8')
        
        return jsonify({'pdfData': pdf_data, 'fileName': 'parcels_export.pdf'})
    
    except ImportError:
        return jsonify({'error': 'ReportLab not installed. Run: pip install reportlab'}), 500
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/ai/ask', methods=['POST'])
def ai_ask():
    """
    Assistant endpoint. If OPENAI_API_KEY is set, forwards to OpenAI.
    Otherwise, answers from local docs/FAQs with simple keyword ranking.
    Expected JSON: { "messages": [{role, content}, ...] }
    """
    try:
        data = request.get_json() or {}
        messages = data.get('messages', [])
        user_q = ''
        for m in reversed(messages):
            if m.get('role') == 'user':
                user_q = m.get('content', '').strip()
                break
        if not user_q:
            return jsonify({ 'answer': 'Please type a question about Parcel Tools.' })

        # If OpenAI key is present, try using it
        cfg = load_ai_config()
        openai_key = os.environ.get('OPENAI_API_KEY') or cfg.get('openai_api_key')
        model = cfg.get('model', 'gpt-4o-mini')
        if openai_key:
            try:
                import requests
                prompt = (
                    "You are the Parcel Tools in-app assistant. Answer briefly and concretely. "
                    "Focus on how to use features of the Electron+React app with Python backend: "
                    "points loading, area calculator with curves, project save/load, PDF export, auto-watch.\n\n"
                    f"User: {user_q}"
                )
                resp = requests.post(
                    'https://api.openai.com/v1/chat/completions',
                    headers={
                        'Authorization': f'Bearer {openai_key}',
                        'Content-Type': 'application/json'
                    },
                    json={
                        'model': model,
                        'messages': [
                            { 'role': 'system', 'content': 'You are a helpful assistant for the Parcel Tools desktop app.' },
                            { 'role': 'user', 'content': prompt }
                        ],
                        'temperature': 0.2
                    }, timeout=12
                )
                if resp.ok:
                    data = resp.json()
                    answer = data['choices'][0]['message']['content']
                    return jsonify({ 'answer': answer })
            except Exception:
                pass  # Fall back to local docs

        # Local docs/FAQ fallback
        kb_paths = [
            os.path.join(os.path.dirname(__file__), '..', 'README.md'),
            os.path.join(os.path.dirname(__file__), '..', 'SETUP.md'),
            os.path.join(os.path.dirname(__file__), '..', 'BUILD_INSTRUCTIONS.md'),
            os.path.join(os.path.dirname(__file__), '..', 'src', 'pages', 'ParcelCalculator.jsx'),
            os.path.join(os.path.dirname(__file__), '..', 'src', 'pages', 'DataFiles.jsx'),
            os.path.join(os.path.dirname(__file__), '..', 'WHAT_WAS_CREATED.md'),
            os.path.join(os.path.dirname(__file__), '..', 'BACKUP_INSTRUCTIONS.md'),
        ]

        docs = []
        for p in kb_paths:
            try:
                with open(p, 'r', encoding='utf-8', errors='ignore') as f:
                    text = f.read()
                    docs.append((os.path.basename(p), text))
            except Exception:
                continue

        # Very simple keyword score
        tokens = [t for t in re.split(r"[^\w]+", user_q.lower()) if t]
        scored = []
        for name, text in docs:
            tl = text.lower()
            score = sum(tl.count(tok) for tok in tokens)
            scored.append((score, name, text))
        scored.sort(reverse=True)

        if not scored or scored[0][0] == 0:
            return jsonify({ 'answer': 'I could not find this in the docs. Try asking about: loading points, entering IDs, curves (M value), auto-save, or PDF export.' })

        # Return top 3 snippets (first 700 chars each)
        snippets = []
        for i, (_, name, text) in enumerate(scored[:3]):
            snippets.append(f"From {name}:\n" + text[:700].strip())
        answer = ("Here is what I found:\n\n" + "\n\n---\n\n".join(snippets))
        return jsonify({ 'answer': answer })

    except Exception as e:
        return jsonify({ 'answer': f'Assistant error: {str(e)}' })


@app.route('/api/ai/config', methods=['GET', 'POST'])
def ai_config():
    try:
        if request.method == 'GET':
            cfg = load_ai_config()
            safe_cfg = {
                'hasKey': bool(cfg.get('openai_api_key') or os.environ.get('OPENAI_API_KEY')),
                'model': cfg.get('model', 'gpt-4o-mini')
            }
            return jsonify(safe_cfg)
        else:
            data = request.get_json() or {}
            cfg = load_ai_config()
            if 'openai_api_key' in data and data['openai_api_key']:
                cfg['openai_api_key'] = data['openai_api_key']
            if 'model' in data and data['model']:
                cfg['model'] = data['model']
            ok = save_ai_config(cfg)
            return jsonify({ 'success': ok })
    except Exception as e:
        return jsonify({ 'success': False, 'error': str(e) }), 500


@app.route('/api/recent-files', methods=['GET'])
def get_recent_files():
    """Get recent files history - with automatic cleanup of deleted files"""
    try:
        recent = load_recent_files()
        
        # Clean up deleted files from recent files
        cleaned_projects = []
        cleaned_points = []
        needs_save = False
        
        # Clean projects
        for file_entry in recent.get('projects', []):
            filepath = file_entry.get('path', '')
            if filepath and os.path.exists(filepath):
                cleaned_projects.append(file_entry)
            else:
                needs_save = True  # File was deleted, need to save cleaned list
        
        # Clean points
        for file_entry in recent.get('points', []):
            filepath = file_entry.get('path', '')
            if filepath and os.path.exists(filepath):
                cleaned_points.append(file_entry)
            else:
                needs_save = True  # File was deleted, need to save cleaned list
        
        # Save cleaned list if needed
        if needs_save:
            recent['projects'] = cleaned_projects
            recent['points'] = cleaned_points
            save_recent_files(recent)
        
        return jsonify(recent)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/recent-files', methods=['POST'])
def add_recent_file():
    """Add a file to recent files history"""
    try:
        data = request.get_json() or {}
        file_type = data.get('type')  # 'projects' or 'points'
        file_path = data.get('path', '')
        file_name = data.get('name', '')
        metadata = data.get('metadata', {})
        
        if not file_type or not file_path or not file_name:
            return jsonify({'error': 'Missing required fields: type, path, name'}), 400
        
        if file_type not in ['projects', 'points']:
            return jsonify({'error': 'Type must be "projects" or "points"'}), 400
        
        add_to_recent_files(file_type, file_path, file_name, metadata)
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/recent-files/clear', methods=['POST'])
def clear_recent_files():
    """Clear recent files history"""
    try:
        data = request.get_json() or {}
        file_type = data.get('type')  # 'projects', 'points', or None for all
        
        recent = load_recent_files()
        if file_type:
            if file_type in recent:
                recent[file_type] = []
        else:
            recent = {'projects': [], 'points': []}
        
        save_recent_files(recent)
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    print("==> Starting Parcel Tools Backend API...")
    print("==> API running on http://localhost:5000")
    print("==> Ready to accept connections from Electron app")
    app.run(host='localhost', port=5000, debug=True)


