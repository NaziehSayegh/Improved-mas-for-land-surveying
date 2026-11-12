"""Manual check of ezdxf text placement. Run directly: python test_ezdxf.py (not part of the pytest suite)."""
import ezdxf


def main():
    doc = ezdxf.new()
    msp = doc.modelspace()
    txt = msp.add_text("TEST")
    txt.dxf.insert = (10, 20)
    txt.set_placement((10, 20), (30, 40), 1)

    print("insert:", txt.dxf.insert)
    if txt.has_dxf_attrib('align_point'):
        print("align_point:", txt.dxf.align_point)


if __name__ == "__main__":
    main()
