#!/usr/bin/env python3
"""Turn generated art into Genesis-legal pixel assets.

Subcommands:

  image   one picture in, one pixel asset out
  strip   a wide multi-frame sheet in, a normalised sprite strip out
  cutout  remove a flat background via border flood

Adapted from an earlier game's tools/pixelize.py. The cohesion lever here is the
Mega Drive's own hardware limit instead of a hand-made ramp: every channel is
snapped to the console's 9-bit colour space (8 levels per channel), and each
sprite is reduced to at most 15 colours plus transparency, the size of one
palette line. Sprites generated in separate calls end up speaking the same
colour language because the console forces it.
"""

from __future__ import annotations

import argparse
from array import array
import sys
from pathlib import Path

try:
    from PIL import Image, ImageChops, ImageEnhance, ImageFilter
except ImportError:
    sys.exit("pixelize: Pillow is required (pip install --user Pillow)")


# --------------------------------------------------------------------------
# palette
# --------------------------------------------------------------------------

def load_palette(path: Path, slots: str = "") -> list[tuple[int, int, int]]:
    im = Image.open(path).convert("RGB")
    full = [im.getpixel((x, 0)) for x in range(im.size[0])]
    if not slots:
        return full
    # Per-asset palette subsets are the difference between clean art and art
    # peppered with stray reds and greens: if an actor has no amber in its
    # design, letting the quantiser reach for amber only ever produces noise.
    keep: list[int] = []
    for part in slots.split(","):
        part = part.strip()
        if not part:
            continue
        if "-" in part:
            a, b = part.split("-", 1)
            keep.extend(range(int(a), int(b) + 1))
        else:
            keep.append(int(part))
    picked = [full[i] for i in keep if 0 <= i < len(full)]
    return picked or full


def build_lut(palette: list[tuple[int, int, int]]) -> Image.Image:
    """A P-mode image carrying the ramp, for Image.quantize(palette=...)."""
    flat: list[int] = []
    for r, g, b in palette:
        flat.extend((r, g, b))
    flat.extend([0] * (768 - len(flat)))
    lut = Image.new("P", (1, 1))
    lut.putpalette(flat)
    return lut


GENESIS_LEVELS = [round(i * 255 / 7) for i in range(8)]


def snap_genesis(rgb: Image.Image, colors: int) -> Image.Image:
    """Reduce to `colors` adaptive colours, then snap each to the 9-bit space.

    Quantising first keeps the palette-line limit honest; snapping afterwards
    can merge two entries, which only ever lowers the count.
    """
    reduced = rgb.quantize(colors=colors, method=Image.Quantize.MEDIANCUT,
                           dither=Image.Dither.NONE).convert("RGB")
    lut = [GENESIS_LEVELS[min(7, round(v * 7 / 255))] for v in range(256)]
    return reduced.point(lut * 3)


def snap_to_palette(
    rgb: Image.Image,
    palette: list[tuple[int, int, int]],
    dither: bool,
) -> Image.Image:
    lut = build_lut(palette)
    mode = Image.Dither.FLOYDSTEINBERG if dither else Image.Dither.NONE
    return rgb.quantize(palette=lut, dither=mode).convert("RGB")


# --------------------------------------------------------------------------
# background cutout
# --------------------------------------------------------------------------

def _sample_background(im: Image.Image) -> tuple[int, int, int]:
    """Most common colour along the border, which is what the model painted
    the background as. It is usually the requested chroma key and occasionally
    plain white, so never assume."""
    w, h = im.size
    px = im.load()
    tally: dict[tuple[int, int, int], int] = {}
    step = max(1, min(w, h) // 128)
    for x in range(0, w, step):
        for y in (0, h - 1):
            c = px[x, y][:3]
            tally[c] = tally.get(c, 0) + 1
    for y in range(0, h, step):
        for x in (0, w - 1):
            c = px[x, y][:3]
            tally[c] = tally.get(c, 0) + 1
    return max(tally.items(), key=lambda kv: kv[1])[0]


def _dist_mask(im: Image.Image, key: tuple[int, int, int], tol: int) -> bytearray:
    """1 where the pixel is within tol of the key colour."""
    w, h = im.size
    r, g, b = im.split()[:3]
    kr, kg, kb = key
    dr = r.point(lambda v, k=kr: abs(v - k))
    dg = g.point(lambda v, k=kg: abs(v - k))
    db = b.point(lambda v, k=kb: abs(v - k))
    # Chebyshev distance: cheap and behaves well for flat synthetic backgrounds.
    d = ImageChops.lighter(ImageChops.lighter(dr, dg), db)
    thresholded = d.point(lambda v, t=tol: 1 if v <= t else 0)
    return bytearray(thresholded.tobytes())


def _flood_from_border(mask: bytearray, w: int, h: int) -> bytearray:
    """Scanline flood of the background mask, seeded from every border pixel.

    This is the whole reason the cutout is safe: a white highlight in the
    middle of a sprite is never connected to the border, so it survives. A
    plain global colour key deletes it, which is exactly how the first Rote
    ended up as confetti.
    """
    out = bytearray(w * h)
    stack: list[tuple[int, int]] = []
    for x in range(w):
        for y in (0, h - 1):
            if mask[y * w + x]:
                stack.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            if mask[y * w + x]:
                stack.append((x, y))

    while stack:
        x, y = stack.pop()
        row = y * w
        if not mask[row + x] or out[row + x]:
            continue
        left = x
        while left > 0 and mask[row + left - 1] and not out[row + left - 1]:
            left -= 1
        right = x
        while right < w - 1 and mask[row + right + 1] and not out[row + right + 1]:
            right += 1
        for i in range(left, right + 1):
            out[row + i] = 1
        for ny in (y - 1, y + 1):
            if 0 <= ny < h:
                nrow = ny * w
                i = left
                while i <= right:
                    if mask[nrow + i] and not out[nrow + i]:
                        stack.append((i, ny))
                        while i <= right and mask[nrow + i]:
                            i += 1
                    i += 1
    return out


def already_cut(im: Image.Image, min_transparent: float = 0.05) -> bool:
    """True if the generator already returned a real alpha channel.

    image_gen sometimes honours the chroma-key instruction and sometimes just
    returns a transparent PNG. Keying a transparent image samples its
    zeroed-out RGB as the background colour, decides the key is black, and
    deletes every dark pixel in the sprite. Detecting this first is not an
    optimisation, it is the difference between a Rote and confetti.
    """
    if im.mode not in ("RGBA", "LA"):
        return False
    alpha = im.convert("RGBA").getchannel("A")
    lo, hi = alpha.getextrema()
    if lo != 0 or hi < 200:
        return False
    total = im.size[0] * im.size[1]
    transparent = alpha.point(lambda v: 255 if v < 8 else 0).convert("L")
    count = sum(transparent.histogram()[255:])
    return count / float(total) >= min_transparent


def cutout(
    im: Image.Image,
    tol: int = 46,
    feather: int = 1,
    despill: bool = True,
) -> tuple[Image.Image, float]:
    """Return (rgba with the background removed, kept-pixel fraction)."""
    im = im.convert("RGBA")
    if already_cut(im):
        alpha = im.getchannel("A")
        kept = sum(alpha.point(lambda v: 255 if v >= 8 else 0).histogram()[255:])
        return im, kept / float(im.size[0] * im.size[1])
    w, h = im.size
    key = _sample_background(im)
    mask = _dist_mask(im, key, tol)
    bg = _flood_from_border(mask, w, h)

    alpha = Image.frombytes("L", (w, h), bytes(255 if not v else 0 for v in bg))
    if feather > 0:
        # Pull the edge in by one pixel first so the key colour's antialiased
        # fringe goes with it, then soften what is left.
        alpha = alpha.filter(ImageFilter.MinFilter(3))
        alpha = alpha.filter(ImageFilter.GaussianBlur(feather * 0.5))
        alpha = alpha.point(lambda v: 0 if v < 90 else (255 if v > 165 else v))

    out = im.copy()
    if despill and key[1] > key[0] + 30 and key[1] > key[2] + 30:
        # Green key: clamp green to the average of the other two so no pixel
        # keeps a chroma fringe.
        r, g, b, _ = out.split()
        avg = ImageChops.add(r, b, scale=2.0)
        g = ImageChops.darker(g, avg)
        out = Image.merge("RGBA", (r, g, b, out.getchannel("A")))
    out.putalpha(alpha)

    kept = sum(1 for v in bg if not v) / float(w * h)
    return out, kept


# --------------------------------------------------------------------------
# core operations
# --------------------------------------------------------------------------

def split_alpha(im: Image.Image) -> tuple[Image.Image, Image.Image]:
    im = im.convert("RGBA")
    return im.convert("RGB"), im.getchannel("A")


def content_bbox(alpha: Image.Image, threshold: int = 24) -> tuple[int, int, int, int] | None:
    mask = alpha.point(lambda v: 255 if v >= threshold else 0)
    return mask.getbbox()


def downscale(
    im: Image.Image,
    target_h: int,
    target_w: int | None = None,
) -> Image.Image:
    w, h = im.size
    if target_w is None:
        target_w = max(1, round(w * target_h / h))
    # BOX averages the source block, which reads far better than LANCZOS when
    # the reduction is this aggressive: no ringing halos around bright neon.
    return im.resize((target_w, max(1, target_h)), Image.Resampling.BOX)


def crop_rows(im: Image.Image, top: float, bottom: float) -> Image.Image:
    """Keep the band of rows between two fractions of the height.

    Generated scenery often comes with extra ground (a pavement, a harbour)
    under the thing that should stand on the stage's floor line.
    """
    if not 0 <= top < bottom <= 1:
        raise ValueError(f"crop {top},{bottom} is not a band inside 0..1")
    w, h = im.size
    return im.crop((0, round(h * top), w, round(h * bottom)))


def seamless(im: Image.Image, overlap: float) -> Image.Image:
    """Make a painted plate tile horizontally without a visible seam.

    The rightmost `overlap` fraction of the width is crossfaded into the
    leftmost and then dropped, so the last remaining column sits next to the
    first exactly as it did in the source. The result is narrower by the
    overlap.
    """
    if overlap <= 0:
        return im
    im = im.convert("RGBA")
    w, h = im.size
    n = max(1, round(w * overlap))
    if n * 2 >= w:
        raise ValueError(f"seamless overlap {overlap} is too wide for {w}px")
    tail = im.crop((w - n, 0, w, h))
    head = im.crop((0, 0, n, h))
    # Mask weight is the head's share: near zero in the first column, where
    # the tail must continue from the plate's last column, near full in the
    # last, where the head must meet the untouched column after it.
    ramp = Image.new("L", (n, h))
    ramp.putdata([round(255 * (x + 0.5) / n) for _ in range(h) for x in range(n)])
    out = im.crop((0, 0, w - n, h))
    out.paste(Image.composite(head, tail, ramp), (0, 0))
    return out


def add_outline(rgba: Image.Image, color: tuple[int, int, int], threshold: int = 96) -> Image.Image:
    """One pixel dark keyline so actors stay legible over painted parallax."""
    alpha = rgba.getchannel("A").point(lambda v: 255 if v >= threshold else 0)
    grown = alpha.filter(ImageFilter.MaxFilter(3))
    ring = ImageChops.subtract(grown, alpha)
    out = rgba.copy()
    line = Image.new("RGBA", rgba.size, color + (255,))
    out = Image.composite(line, out, ring)
    # Restore the grown alpha so the keyline is actually opaque.
    merged = out.getchannel("A").point(lambda v: v)
    merged = ImageChops.lighter(merged, ring)
    out.putalpha(merged)
    return out


def process(
    im: Image.Image,
    *,
    height: int,
    width: int | None,
    palette: list[tuple[int, int, int]] | None,
    dither: bool,
    saturation: float,
    contrast: float,
    brightness: float,
    alpha_threshold: int,
    outline: tuple[int, int, int] | None,
    trim: bool,
    genesis_colors: int = 0,
    seam: float = 0.0,
    rows: tuple[float, float] = (0.0, 1.0),
) -> Image.Image:
    im = crop_rows(im.convert("RGBA"), *rows)

    if trim:
        box = content_bbox(im.getchannel("A"))
        if box:
            im = im.crop(box)

    im = seamless(im, seam)

    im = downscale(im, height, width)
    rgb, alpha = split_alpha(im)

    if saturation != 1.0:
        rgb = ImageEnhance.Color(rgb).enhance(saturation)
    if contrast != 1.0:
        rgb = ImageEnhance.Contrast(rgb).enhance(contrast)
    if brightness != 1.0:
        rgb = ImageEnhance.Brightness(rgb).enhance(brightness)

    if palette:
        rgb = snap_to_palette(rgb, palette, dither)
    elif genesis_colors:
        rgb = snap_genesis(rgb, genesis_colors)

    if alpha_threshold > 0:
        alpha = alpha.point(lambda v: 255 if v >= alpha_threshold else 0)

    out = rgb.convert("RGBA")
    out.putalpha(alpha)

    if outline:
        out = add_outline(out, outline)
    return out


def label_blobs(
    im: Image.Image, threshold: int = 24, max_blobs: int = 250
) -> tuple[array, dict[int, int]] | None:
    """4-connected labelling of the opaque pixels: (label per pixel, size per label).

    Returns None past `max_blobs` components, which means pathological input.
    """
    w, h = im.size
    alpha = im.getchannel("A").point(lambda v, t=threshold: 1 if v >= t else 0)
    solid = bytearray(alpha.tobytes())
    label = array("I", bytes(4 * w * h))
    sizes: dict[int, int] = {}
    current = 0

    for start in range(w * h):
        if not solid[start] or label[start]:
            continue
        current += 1
        if current > max_blobs:
            return None
        size = 0
        stack = [start]
        label[start] = current
        while stack:
            idx = stack.pop()
            size += 1
            x = idx % w
            y = idx // w
            for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                if 0 <= nx < w and 0 <= ny < h:
                    n = ny * w + nx
                    if solid[n] and not label[n]:
                        label[n] = current
                        stack.append(n)
        sizes[current] = size
    return label, sizes


def _keep_labels(im: Image.Image, label, keep_ids: set[int]) -> Image.Image:
    w, h = im.size
    keep = Image.frombytes("L", (w, h), bytes(255 if v in keep_ids else 0 for v in label))
    out = im.copy()
    out.putalpha(ImageChops.multiply(im.getchannel("A"), keep))
    return out


def largest_blob(im: Image.Image, threshold: int = 24) -> Image.Image:
    """Keep only the biggest connected opaque region.

    Generated strips routinely carry a few detached specks in a slot: a bit of
    stray muzzle flash, a chip of armour that wandered out of the silhouette.
    Left in, they inflate the frame's bounding box, which throws off the shared
    scale for the WHOLE strip and makes the finished animation breathe. Dropping
    everything but the main blob fixes the drift at the source.
    """
    im = im.convert("RGBA")
    labelled = label_blobs(im, threshold)
    if labelled is None or not labelled[1]:
        # Pathological or empty input; keep everything rather than guess.
        return im
    label, sizes = labelled
    best_id = max(sizes, key=sizes.__getitem__)
    return _keep_labels(im, label, {best_id})


def split_frames_by_blob(
    im: Image.Image, frames: int, threshold: int = 24, min_share: float = 0.25
) -> list[Image.Image] | None:
    """Find each frame as one of the `frames` largest blobs, ordered left to right.

    The image model does not space poses evenly: a wide pose (lying flat, a
    flying kick) crosses the equal-slot boundary and gets clipped by slot
    slicing, and poses often overlap in x so column gaps cannot separate them
    either. Whole-strip blobs can. Returns None, meaning "fall back to slots",
    when the strip does not look like `frames` separate figures: too few blobs,
    or the smallest kept blob is under `min_share` of the median kept blob
    (a detached limb, not a frame).
    """
    im = im.convert("RGBA")
    labelled = label_blobs(im, threshold, max_blobs=20000)
    if labelled is None:
        return None
    label, sizes = labelled
    ranked = sorted(sizes, key=sizes.__getitem__, reverse=True)[:frames]
    if len(ranked) < frames:
        return None
    kept = sorted(sizes[i] for i in ranked)
    if kept[0] < min_share * kept[len(kept) // 2]:
        return None

    w = im.size[0]
    sum_x = {i: 0 for i in ranked}
    for idx, v in enumerate(label):
        if v in sum_x:
            sum_x[v] += idx % w
    order = sorted(ranked, key=lambda i: sum_x[i] / sizes[i])

    crops: list[Image.Image] = []
    for blob_id in order:
        cell = _keep_labels(im, label, {blob_id})
        box = content_bbox(cell.getchannel("A"))
        crops.append(cell.crop(box) if box else cell)
    return crops


# --------------------------------------------------------------------------
# strip normalisation
# --------------------------------------------------------------------------

def slot_crops(im: Image.Image, frames: int, clean: bool) -> list[Image.Image]:
    """Equal-width slot slicing: the fallback when frames cannot be found as blobs."""
    W, H = im.size
    slot_w = W / frames
    crops: list[Image.Image] = []
    for i in range(frames):
        left = int(round(i * slot_w))
        right = int(round((i + 1) * slot_w))
        cell = im.crop((left, 0, right, H))
        if clean:
            cell = largest_blob(cell)
        box = content_bbox(cell.getchannel("A"))
        crops.append(cell.crop(box) if box else cell)
    return crops


def normalise_strip(
    im: Image.Image,
    frames: int,
    frame_w: int,
    frame_h: int,
    *,
    palette,
    dither: bool,
    saturation: float,
    contrast: float,
    brightness: float,
    alpha_threshold: int,
    outline,
    anchor: str,
    clean: bool = True,
    genesis_colors: int = 0,
    target_height: int = 0,
    x_anchor: str = "bbox",
    base_x: int = 0,
) -> Image.Image:
    """Cut a generated sheet into frames and put them on one shared anchor.

    Generated strips drift: the character wanders inside its slot and changes
    size frame to frame. Scaling every frame by ONE shared factor (derived from
    the tallest frame) and aligning them all to one anchor is what stops the
    finished animation from breathing.

    `target_height` pins the tallest frame to that many pixels so every sheet
    of one character shares a body size; without it each sheet fills its own
    frame and the character changes size between animations. `x_anchor="mass"`
    centres each frame on its alpha centroid rather than its bounding box, so
    an outstretched punch does not shove the body backwards. `x_anchor="base"`
    pins the rightmost pixel of each frame's bottom quarter to column `base_x`,
    for figures drawn with a prop in front of them (a panelist's desk): the
    prop stays put while the figure behind it moves.
    """
    im = im.convert("RGBA")
    crops = split_frames_by_blob(im, frames) if clean else None
    if crops is None:
        if clean:
            print(f"pixelize: strip is not {frames} separate figures; slicing equal slots",
                  file=sys.stderr)
        crops = slot_crops(im, frames, clean)

    tallest = max(c.size[1] for c in crops)
    widest = max(c.size[0] for c in crops)
    # Leave a little headroom so an outline never clips the frame edge.
    fit = min((frame_h - 2) / tallest, (frame_w - 2) / widest)
    scale = target_height / tallest if target_height else fit
    if scale > fit + 1e-9:
        sys.exit(f"pixelize: target height {target_height} does not fit a "
                 f"{frame_w}x{frame_h} frame (widest crop {widest}px); widen the frame")

    sheet = Image.new("RGBA", (frame_w * frames, frame_h), (0, 0, 0, 0))
    for i, cell in enumerate(crops):
        w = max(1, int(round(cell.size[0] * scale)))
        h = max(1, int(round(cell.size[1] * scale)))
        small = cell.resize((w, h), Image.Resampling.BOX)
        small = process(
            small,
            height=h,
            width=w,
            palette=palette,
            dither=dither,
            saturation=saturation,
            contrast=contrast,
            brightness=brightness,
            alpha_threshold=alpha_threshold,
            outline=outline,
            trim=False,
        )
        if x_anchor == "mass":
            offset = int(round(frame_w / 2 - alpha_centroid_x(small)))
            offset = min(frame_w - w, max(0, offset))
        elif x_anchor == "base":
            offset = base_x - base_right_x(small)
            if offset < 0 or offset + w > frame_w:
                sys.exit(f"pixelize: frame {i + 1} does not fit a {frame_w} px frame "
                         f"with its base at x={base_x}; move --base-x or widen the frame")
        else:
            offset = (frame_w - w) // 2
        x = i * frame_w + offset
        y = frame_h - h if anchor == "bottom" else (frame_h - h) // 2
        sheet.alpha_composite(small, (x, y))
    if genesis_colors:
        sheet = snap_sheet_genesis(sheet, genesis_colors)
    return sheet


def base_right_x(im: Image.Image, band: float = 0.25) -> int:
    """Rightmost opaque column in the bottom `band` of the image."""
    alpha = im.getchannel("A")
    w, h = alpha.size
    top = min(h - 1, int(h * (1 - band)))
    box = alpha.crop((0, top, w, h)).point(lambda a: 255 if a >= 128 else 0).getbbox()
    if box is None:
        sys.exit("pixelize: frame has nothing in its bottom band to anchor on")
    return box[2] - 1


def alpha_centroid_x(im: Image.Image) -> float:
    alpha = im.getchannel("A")
    w, h = alpha.size
    data = alpha.load()
    total = 0
    moment = 0.0
    for x in range(w):
        column = sum(1 for y in range(h) if data[x, y] >= 128)
        total += column
        moment += column * x
    return moment / total if total else w / 2


def snap_sheet_genesis(sheet: Image.Image, colors: int) -> Image.Image:
    """One palette line for the whole sheet, not one per frame.

    Quantising frames separately lets the same hoodie come out in two shades
    on consecutive frames, which flickers. Transparent pixels are filled with
    an opaque colour first so they do not spend a palette slot on black.
    """
    alpha = sheet.getchannel("A")
    rgb = sheet.convert("RGB")
    opaque = alpha.point(lambda v: 255 if v >= 128 else 0)
    box = opaque.getbbox()
    if not box:
        return sheet
    fill = rgb.resize((1, 1), Image.Resampling.BOX, box=box).getpixel((0, 0))
    base = Image.new("RGB", sheet.size, fill)
    base.paste(rgb, mask=opaque)
    out = snap_genesis(base, colors).convert("RGBA")
    out.putalpha(alpha)
    return out


# --------------------------------------------------------------------------
# cli
# --------------------------------------------------------------------------

def add_common(ap: argparse.ArgumentParser) -> None:
    ap.add_argument("--input", required=True, type=Path)
    ap.add_argument("--out", required=True, type=Path)
    ap.add_argument("--palette", type=Path, default=None,
                    help="fixed ramp image; default is the Genesis snap")
    ap.add_argument("--no-palette", action="store_true",
                    help="keep painted colour (backdrops and cutscene stills)")
    ap.add_argument("--genesis-colors", type=int, default=15,
                    help="colours per sprite when snapping to the 9-bit space")
    ap.add_argument("--dither", action="store_true")
    ap.add_argument("--saturation", type=float, default=1.12)
    ap.add_argument("--contrast", type=float, default=1.06)
    ap.add_argument("--brightness", type=float, default=1.0)
    ap.add_argument("--palette-slots", default="",
                    help='restrict the ramp, e.g. "0-8,9-12,29-31"')
    ap.add_argument("--alpha-threshold", type=int, default=128)
    ap.add_argument("--outline", default="",
                    help='hex like "0a0814", or empty for none')
    ap.add_argument("--no-trim", action="store_true")


def resolve_palette(args) -> list[tuple[int, int, int]] | None:
    if args.no_palette or args.palette is None:
        return None
    if not args.palette.exists():
        sys.exit(f"pixelize: palette not found: {args.palette}")
    return load_palette(args.palette, args.palette_slots)


def parse_band(value: str) -> tuple[float, float]:
    top, bottom = (float(v) for v in value.split(","))
    return top, bottom


def parse_hex(value: str):
    if not value:
        return None
    v = value.lstrip("#")
    return (int(v[0:2], 16), int(v[2:4], 16), int(v[4:6], 16))


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)

    one = sub.add_parser("image", help="single image")
    add_common(one)
    one.add_argument("--height", type=int, required=True)
    one.add_argument("--width", type=int, default=None)
    one.add_argument("--seamless", type=float, default=0.0,
                     help="crossfade this fraction of the width so the image tiles sideways")
    one.add_argument("--crop", default="0,1",
                     help="TOP,BOTTOM: keep only this band of rows, as fractions of the height")

    cut = sub.add_parser("cutout", help="remove a flat background via border flood")
    cut.add_argument("--input", required=True, type=Path)
    cut.add_argument("--out", required=True, type=Path)
    cut.add_argument("--tolerance", type=int, default=46)
    cut.add_argument("--feather", type=int, default=1)
    cut.add_argument("--min-coverage", type=float, default=0.02)
    cut.add_argument("--max-coverage", type=float, default=0.85)

    strip = sub.add_parser("strip", help="multi-frame sheet")
    add_common(strip)
    strip.add_argument("--frames", type=int, required=True)
    strip.add_argument("--frame-width", type=int, required=True)
    strip.add_argument("--frame-height", type=int, required=True)
    strip.add_argument("--anchor", choices=["bottom", "center"], default="bottom")
    strip.add_argument("--target-height", type=int, default=0,
                       help="pin the tallest frame to this height (one body size per character)")
    strip.add_argument("--x-anchor", choices=["bbox", "mass", "base"], default="bbox",
                       help="centre frames on the bounding box or the alpha centroid, "
                            "or pin the right edge of the bottom quarter at --base-x")
    strip.add_argument("--base-x", type=int, default=0,
                       help="column for the base's right edge with --x-anchor base")
    strip.add_argument("--keep-specks", action="store_true",
                       help="do not drop detached fragments inside a frame")

    args = ap.parse_args()
    if not args.input.exists():
        sys.exit(f"pixelize: missing input {args.input}")

    if args.cmd == "cutout":
        src = Image.open(args.input)
        result, kept = cutout(src, args.tolerance, args.feather)
        args.out.parent.mkdir(parents=True, exist_ok=True)
        result.save(args.out)
        print(f"pixelize: cutout {args.input} -> {args.out} kept {kept * 100:.1f}%")
        if kept < args.min_coverage or kept > args.max_coverage:
            sys.exit(
                f"pixelize: implausible coverage {kept * 100:.1f}% "
                f"(want {args.min_coverage * 100:.0f}-{args.max_coverage * 100:.0f}%); "
                f"the background probably was not flat")
        return

    palette = resolve_palette(args)
    genesis_colors = 0 if (palette or args.no_palette) else args.genesis_colors
    outline = parse_hex(args.outline)
    src = Image.open(args.input)
    args.out.parent.mkdir(parents=True, exist_ok=True)

    if args.cmd == "image":
        out = process(
            src,
            height=args.height,
            width=args.width,
            palette=palette,
            dither=args.dither,
            saturation=args.saturation,
            contrast=args.contrast,
            brightness=args.brightness,
            alpha_threshold=args.alpha_threshold,
            outline=outline,
            trim=not args.no_trim,
            genesis_colors=genesis_colors,
            seam=args.seamless,
            rows=parse_band(args.crop),
        )
    else:
        out = normalise_strip(
            src,
            args.frames,
            args.frame_width,
            args.frame_height,
            palette=palette,
            dither=args.dither,
            saturation=args.saturation,
            contrast=args.contrast,
            brightness=args.brightness,
            alpha_threshold=args.alpha_threshold,
            outline=outline,
            anchor=args.anchor,
            clean=not args.keep_specks,
            genesis_colors=genesis_colors,
            target_height=args.target_height,
            x_anchor=args.x_anchor,
            base_x=args.base_x,
        )

    out.save(args.out)
    print(f"pixelize: {args.input} -> {args.out} {out.size}")


if __name__ == "__main__":
    main()
