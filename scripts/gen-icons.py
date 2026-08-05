#!/usr/bin/env python3
"""
Generate Bitecodes brand favicons / icons as real binary files with no external
image tooling (no PIL/rsvg/ImageMagick available). Produces:
  public/favicon.ico           (16/32/48 PNG-in-ICO)
  public/apple-touch-icon.png  (180x180)
  public/icon-192.png           (192x192, PWA)
  public/icon-512.png           (512x512, PWA)

Mark: the bitten "B" with a "</>" cutout — geometry mirrors src/lib/brand.ts
(viewBox 0 0 100 100); keep the two in step. Icons put the near-black mark on
a white rounded-square plate so they stay legible on dark browser chrome,
where a transparent-background mark would vanish. Deterministic.
"""
import struct, zlib, os

INK = (17, 17, 17, 255)        # #111111, matching the site's foreground
PLATE = (255, 255, 255, 255)   # white rounded square behind the mark

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUB = os.path.join(ROOT, "public")

# --- geometry, in the 0..100 space of src/lib/brand.ts ----------------------
B_POLY_CORNERS = [(18, 96), (18, 8), (54, 8)]
TOP_LOBE = [(54, 8), (78, 8), (90, 18), (90, 31)]
TOP_LOBE2 = [(90, 31), (90, 43), (77, 50), (60, 50.5)]
WAIST_IN = (53, 51)
BOT_LOBE = [(53, 51), (81, 52), (96, 61), (96, 75)]
BOT_LOBE2 = [(96, 75), (96, 89), (81, 96), (58, 96)]
BITE_CIRCLES = [((19, 16), 15), ((34, 9), 8)]
CRUMB = ((9.5, 36), 3.8)
GLYPH_W = 5.5
LEFT_CHEV = [(41, 48), (30.5, 56.5), (41, 65)]
RIGHT_CHEV = [(55, 48), (65.5, 56.5), (55, 65)]
SLASH = [(50.5, 44.5), (42.5, 68.5)]

# Mark occupies this fraction of the tile, centred.
MARK_SCALE = 0.74
PLATE_RADIUS = 0.22  # corner radius as a fraction of the tile


def bezier(p0, p1, p2, p3, n=24):
    pts = []
    for i in range(1, n + 1):
        t = i / n
        mt = 1 - t
        x = mt**3 * p0[0] + 3 * mt * mt * t * p1[0] + 3 * mt * t * t * p2[0] + t**3 * p3[0]
        y = mt**3 * p0[1] + 3 * mt * mt * t * p1[1] + 3 * mt * t * t * p2[1] + t**3 * p3[1]
        pts.append((x, y))
    return pts


def outline():
    pts = list(B_POLY_CORNERS)
    pts += bezier(*TOP_LOBE)
    pts += bezier(*TOP_LOBE2)
    pts.append(WAIST_IN)
    pts += bezier(*BOT_LOBE)
    pts += bezier(*BOT_LOBE2)
    return pts


POLY = outline()


def in_poly(x, y):
    inside = False
    j = len(POLY) - 1
    for i in range(len(POLY)):
        xi, yi = POLY[i]
        xj, yj = POLY[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
            inside = not inside
        j = i
    return inside


def seg_dist(px, py, a, b):
    """Distance to a segment with butt caps: infinite beyond the ends."""
    ax, ay = a
    bx, by = b
    dx, dy = bx - ax, by - ay
    t = ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)
    if t < 0.0 or t > 1.0:
        return 1e9
    return ((px - ax - t * dx) ** 2 + (py - ay - t * dy) ** 2) ** 0.5


def in_mark(x, y):
    """Point test in the 0..100 mark space."""
    cx, cy = CRUMB[0]
    if ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5 < CRUMB[1]:
        return True
    if not in_poly(x, y):
        return False
    for (bx, by), r in BITE_CIRCLES:
        if ((x - bx) ** 2 + (y - by) ** 2) ** 0.5 < r:
            return False
    half = GLYPH_W / 2
    for chev in (LEFT_CHEV, RIGHT_CHEV):
        if seg_dist(x, y, chev[0], chev[1]) < half:
            return False
        if seg_dist(x, y, chev[1], chev[2]) < half:
            return False
    if seg_dist(x, y, SLASH[0], SLASH[1]) < half:
        return False
    return True


def in_plate(x, y, size, radius):
    """Rounded-square test in pixel space."""
    r = radius
    if x < 0 or y < 0 or x > size or y > size:
        return False
    nearest_cx = min(max(x, r), size - r)
    nearest_cy = min(max(y, r), size - r)
    if (x < r or x > size - r) and (y < r or y > size - r):
        return ((x - nearest_cx) ** 2 + (y - nearest_cy) ** 2) ** 0.5 <= r
    return True


def render_png(size):
    """Return PNG bytes (RGBA) of the brand icon at the given square size."""
    ss = 3  # supersampling per axis
    radius = size * PLATE_RADIUS
    # The mark's ink box is x 6..96, y 8..96; centre that box on the plate.
    pad = (1 - MARK_SCALE) / 2
    rows = []
    for py in range(size):
        row = bytearray()
        for px in range(size):
            plate_hits = 0
            mark_hits = 0
            for sy in range(ss):
                for sx in range(ss):
                    x = px + (sx + 0.5) / ss
                    y = py + (sy + 0.5) / ss
                    if not in_plate(x, y, size, radius):
                        continue
                    plate_hits += 1
                    # map pixel space -> mark space
                    mx = (x / size - pad) / MARK_SCALE * 100
                    my = (y / size - pad) / MARK_SCALE * 100
                    if in_mark(mx, my):
                        mark_hits += 1
            total = ss * ss
            pa = plate_hits / total
            ma = mark_hits / total
            # composite: ink over plate over transparent
            r = INK[0] * ma + PLATE[0] * (pa - ma)
            g = INK[1] * ma + PLATE[1] * (pa - ma)
            b = INK[2] * ma + PLATE[2] * (pa - ma)
            a = round(255 * pa)
            if pa > 0:
                row += bytes((round(r / pa), round(g / pa), round(b / pa), a))
            else:
                row += bytes((0, 0, 0, 0))
        rows.append(bytes(row))

    raw = b"".join(b"\x00" + r for r in rows)

    def chunk(typ, data):
        c = typ + data
        return struct.pack(">I", len(data)) + c + struct.pack(">I", zlib.crc32(c))

    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(raw, 9))
        + chunk(b"IEND", b"")
    )


def write_png(path, size):
    with open(path, "wb") as f:
        f.write(render_png(size))
    print("wrote", path)


def write_ico(path, sizes):
    """ICO containing PNG entries for each size."""
    pngs = [render_png(s) for s in sizes]
    # ICONDIR: reserved(2)=0, type(2)=1, count(2)
    header = struct.pack("<HHH", 0, 1, len(sizes))
    entries = bytearray()
    images = bytearray()
    offset = 6 + 16 * len(sizes)
    for s, png in zip(sizes, pngs):
        dim = 0 if s >= 256 else s  # 0 means 256
        entries += struct.pack(
            "<BBBBHHII", dim, dim, 0, 0, 1, 32, len(png), offset
        )
        images += png
        offset += len(png)
    with open(path, "wb") as f:
        f.write(header + bytes(entries) + bytes(images))
    print("wrote", path, "ico sizes", sizes)


os.makedirs(PUB, exist_ok=True)
write_png(os.path.join(PUB, "apple-touch-icon.png"), 180)
write_png(os.path.join(PUB, "icon-192.png"), 192)
write_png(os.path.join(PUB, "icon-512.png"), 512)
write_ico(os.path.join(PUB, "favicon.ico"), [16, 32, 48])
print("done")
