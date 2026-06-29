#!/usr/bin/env python3
"""
Generate Bitecodes brand favicons / icons as real binary files with no external
image tooling (no PIL/rsvg/ImageMagick available). Produces:
  public/favicon.ico           (16/32/48 PNG-in-ICO)
  public/apple-touch-icon.png  (180x180)
  public/icon-192.png           (192x192, PWA)
  public/icon-512.png           (512x512, PWA)

Mark: white "</>"-style double chevron + center dot on a solid indigo (#4f46e5)
square, matching the SVG logo. Deterministic (no randomness).
"""
import struct, zlib, os

INDIGO = (79, 70, 229, 255)   # #4f46e5  (oklch ~0.45 0.2 282)
WHITE = (255, 255, 255, 255)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUB = os.path.join(ROOT, "public")


def point_seg_dist(px, py, ax, ay, bx, by):
    dx, dy = bx - ax, by - ay
    if dx == 0 and dy == 0:
        return ((px - ax) ** 2 + (py - ay) ** 2) ** 0.5
    t = ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)
    t = max(0.0, min(1.0, t))
    cx, cy = ax + t * dx, ay + t * dy
    return ((px - cx) ** 2 + (py - cy) ** 2) ** 0.5


def is_mark(nx, ny, s):
    """nx,ny in 0..1 (origin top-left). s = pixel size for thickness scaling."""
    thick = 0.11 * s
    dot_r = 0.075 * s
    # Left chevron "<": points left, opens right
    d = min(
        point_seg_dist(nx, ny, 0.42, 0.26, 0.26, 0.50),
        point_seg_dist(nx, ny, 0.26, 0.50, 0.42, 0.74),
    )
    if d <= thick:
        return True
    # Right chevron ">": points right, opens left
    d = min(
        point_seg_dist(nx, ny, 0.58, 0.26, 0.74, 0.50),
        point_seg_dist(nx, ny, 0.74, 0.50, 0.58, 0.74),
    )
    if d <= thick:
        return True
    # Center dot
    if ((nx - 0.50) ** 2 + (ny - 0.50) ** 2) ** 0.5 <= dot_r:
        return True
    return False


def render_png(size):
    """Return PNG bytes (RGBA) of the brand icon at the given square size."""
    w = h = size
    # Build raw RGBA scanlines with per-row filter byte 0 (None)
    raw = bytearray()
    for y in range(h):
        raw.append(0)  # filter type None
        for x in range(w):
            nx = (x + 0.5) / w
            ny = (y + 0.5) / h
            c = WHITE if is_mark(nx, ny, size) else INDIGO
            raw += bytes(c)
    comp = zlib.compress(bytes(raw), 9)

    def chunk(typ, data):
        c = struct.pack(">I", len(data)) + typ + data
        crc = zlib.crc32(typ + data) & 0xFFFFFFFF
        return c + struct.pack(">I", crc)

    sig = b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0)  # 8-bit RGBA
    return sig + chunk(b"IHDR", ihdr) + chunk(b"IDAT", comp) + chunk(b"IEND", b"")


def write_png(path, size):
    with open(path, "wb") as f:
        f.write(render_png(size))
    print("wrote", path, size, "x", size)


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
