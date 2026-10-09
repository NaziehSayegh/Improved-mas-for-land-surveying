"""Built-in help for the in-app Assistant. Used when no OpenAI key is configured.
Shipped inside the backend so it works in the installed app (no docs/source files needed)."""
import re

FAQ = [
    {
        'title': 'Loading a points file',
        'keywords': ['load', 'points', 'file', 'import', 'pnt', 'txt', 'csv', 'coordinates', 'open', 'format', 'bom', 'duplicate'],
        'answer': (
            "Area Calculator → Load Points, then choose a .pnt, .txt or .csv file.\n"
            "Each line is: ID, X, Y (separated by commas, spaces, tabs or semicolons). Lines starting with # or // are ignored.\n"
            "If the same ID appears twice, the first one is kept and you get a warning listing the ignored IDs.\n"
            "UTF-8 and Arabic (Windows-1256) files are both supported."
        ),
    },
    {
        'title': 'Drawing a parcel and closing the boundary',
        'keywords': ['parcel', 'boundary', 'close', 'closed', 'corner', 'enter', 'add', 'area', 'perimeter', 'calculate', 'new', 'draw', 'ids', 'point id'],
        'answer': (
            "1. Type the parcel number.\n"
            "2. Type each corner's Point ID and press ADD (or click the point on the map).\n"
            "3. Close the boundary by entering the first ID again (or clicking the first point).\n"
            "The area and perimeter appear under Calculated Results. The app then asks if there are curves and if you want to save the parcel.\n"
            "A warning appears if the boundary crosses itself — in that case the area is not valid, so check the point order."
        ),
    },
    {
        'title': 'Curves (middle ordinate M)',
        'keywords': ['curve', 'curves', 'arc', 'ordinate', 'm', 'sign', 'convex', 'concave', 'bulge', 'radius'],
        'answer': (
            "In Curves Adjustment enter From Pt, To Pt (two corners of the parcel) and the middle ordinate M in metres (the distance from the chord's midpoint to the arc).\n"
            "Sign '+ Add (convex)' adds the circular segment to the area; '− Subtract (concave)' removes it. Then press + Add Curve.\n"
            "Curves can be edited or deleted from the list under the form. In CAD import, arcs in the drawing are filled in automatically."
        ),
    },
    {
        'title': 'Saving parcels and duplicate parcel numbers',
        'keywords': ['save', 'parcel', 'duplicate', 'same', 'number', 'overwrite', 'edit', 'update', 'versions', 'delete'],
        'answer': (
            "Press Save Parcel (or answer Yes when the app asks). Saved parcels are listed in the Saved Parcels tab with their area and points.\n"
            "If you reuse a parcel number, the app asks: Edit Existing, Create New (Allow Duplicate) or Cancel. Duplicates are kept in the All Versions tab.\n"
            "Use the pencil icon to edit a saved parcel (then Save Changes) and the red bin icon to delete it."
        ),
    },
    {
        'title': 'Projects: save, open and auto-save',
        'keywords': ['project', 'projects', 'save', 'open', 'prcl', 'autosave', 'auto-save', 'close', 'new', 'recent', 'file'],
        'answer': (
            "Projects are saved as .prcl files. Use Save As… the first time to choose the location; after that changes are auto-saved.\n"
            "Open reopens a project (or double-click a .prcl file). Close Project clears the workspace. Recent projects appear in Data Files → Saved Projects.\n"
            "Your points file path is stored in the project and found again next to the project if it was moved."
        ),
    },
    {
        'title': 'Exporting to PDF',
        'keywords': ['pdf', 'export', 'report', 'print', 'heading', 'arabic', 'many', 'multiple'],
        'answer': (
            "Open the Saved Parcels tab. Use the green export icon on a parcel for one PDF, or tick several parcels (or Select All) and press Export All to 1 File.\n"
            "The File Heading (Data Files → File Heading: Block, Quarter, Parcels, Place, extra info) is printed at the top of the report. Arabic text is supported.\n"
            "After saving, the PDF opens automatically."
        ),
    },
    {
        'title': 'CAD import (DXF / DWG)',
        'keywords': ['cad', 'dxf', 'dwg', 'autocad', 'import', 'drawing', 'layer', 'layers', 'oda', 'converter'],
        'answer': (
            "Main menu → 5 CAD Import. You need an active project first (open or create one). Then press OPEN DWG and choose a .dxf or .dwg file.\n"
            ".dwg files are converted first: keep AutoCAD open, or install the free ODA File Converter.\n"
            "Click a parcel polygon (on the GIS/Parcel layer) and press CREATE PARCEL: the app matches corner labels to your points file, shows a review window, and saves the parcel."
        ),
    },
    {
        'title': 'Parcels from a hatch',
        'keywords': ['hatch', 'filled', 'fill', 'hole', 'island', 'arc', 'cad', 'create'],
        'answer': (
            "Click a filled hatch in the CAD view and press CREATE PARCEL — it works on any layer.\n"
            "Hatch boundaries made of lines and arcs keep their true arcs (the curve is added to the parcel with its M value), so the area matches CAD.\n"
            "Holes inside a hatch are subtracted from the area. Circles and splines are converted to a fine polygon."
        ),
    },
    {
        'title': 'Error calculations (area adjustment)',
        'keywords': ['error', 'adjust', 'adjustment', 'registered', 'title', 'limit', 'permissible', 'tolerance', 'difference'],
        'answer': (
            "Area Calculator → Error Calculations. Enter the total registered (title) area, tick the parcels and press Calculate Adjustment.\n"
            "The permissible limit is 0.8·√A + 0.002·A. If the difference is within the limit, every parcel is adjusted proportionally and rounded; otherwise you get a warning.\n"
            "Save Results stores the adjustment with the project."
        ),
    },
    {
        'title': 'Editing points files',
        'keywords': ['data', 'files', 'edit', 'points', 'add', 'delete', 'heading', 'autosave', 'save'],
        'answer': (
            "Main menu → 2 Data Files. Open a points file to edit it: add a point (ID, X, Y), edit or delete rows. Changes auto-save after 3 seconds, or press Save All Changes.\n"
            "File Heading stores the Block/Quarter/Parcels/Place text used on PDF reports."
        ),
    },
    {
        'title': 'License, trial and devices',
        'keywords': ['license', 'licence', 'key', 'activate', 'trial', 'expired', 'device', 'devices', 'pc', 'computer', 'gumroad', 'buy', 'premium', 'login', 'password', 'sign'],
        'answer': (
            "A new account starts a 30-day trial. To unlock the full version buy a license on Gumroad and enter your email and key on the License page.\n"
            "One account can be used on up to 2 computers; sign out on one to free the slot (or ask support to reset the computer binding).\n"
            "Forgot your password or locked out? Contact nsayegh2003@gmail.com."
        ),
    },
    {
        'title': 'Keyboard shortcuts',
        'keywords': ['keyboard', 'shortcut', 'shortcuts', 'key', 'f1', 'esc', 'hotkey'],
        'answer': "On the main menu: 1–5 open the menu items, F1 opens this Assistant, Esc goes back, Ctrl+X exits.",
    },
    {
        'title': 'Updates',
        'keywords': ['update', 'updates', 'version', 'upgrade', 'new version', 'install'],
        'answer': "Parcel Tools checks for updates automatically on start. When one is available a window appears — choose Download, then Restart to finish installing. Your projects are not affected.",
    },
]

_STOP = {'how', 'do', 'i', 'a', 'an', 'the', 'to', 'in', 'of', 'is', 'can', 'my', 'me', 'it', 'on', 'for', 'and', 'what', 'where', 'does', 'with', 'this', 'that', 'use', 'make', 'get'}


def _tokens(text):
    return [t for t in re.split(r'[^\w\-]+', text.lower()) if t and t not in _STOP]


def best_answer(question, min_score=1.0):
    """Return the best FAQ entry for a question, or None."""
    toks = _tokens(question)
    if not toks:
        return None
    best, best_score = None, 0.0
    for entry in FAQ:
        kws = set(entry['keywords'])
        score = 0.0
        for t in toks:
            if t in kws:
                score += 1.0
            elif len(t) >= 4 and any(t in k or k in t for k in kws if len(k) >= 4):
                score += 0.5
        title = entry['title'].lower()
        score += 0.5 * sum(1 for t in toks if t in title)
        if score > best_score:
            best, best_score = entry, score
    return best if best_score >= min_score else None
