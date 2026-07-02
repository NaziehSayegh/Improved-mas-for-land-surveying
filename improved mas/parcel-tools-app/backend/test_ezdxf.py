import sys
sys.path.insert(0, "C:/programing projects/python/improved mas/parcel-tools-app/backend/python-embed/Lib/site-packages")
import ezdxf

doc = ezdxf.new()
msp = doc.modelspace()
txt = msp.add_text("TEST")
txt.dxf.insert = (10, 20)
txt.set_placement((10, 20), (30, 40), 1)

print("insert:", txt.dxf.insert)
if txt.has_dxf_attrib('align_point'):
    print("align_point:", txt.dxf.align_point)

