"""Build the link-preview card and the favicons from the game's own art.

Deterministic and offline: no image generation, just the HIRED ending art and
the game's pixel font (read from src/view/pixel-font.ts so there is one glyph
table). Rerun after changing either; test_gencard fails until you do:

    python3 tools/gencard.py
"""

from __future__ import annotations

import re
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "public"
FONT_SOURCE = ROOT / "src" / "view" / "pixel-font.ts"

GLYPH_W = 5
GLYPH_H = 8
CELL_W = GLYPH_W + 1
CELL_H = GLYPH_H + 1

INK = (16, 16, 16, 255)
HEAD_COLOR = (240, 192, 64, 255)
TEXT_COLOR = (240, 240, 224, 255)

# The size Facebook, LinkedIn, Slack, Discord and X all take for a large card.
CARD_SIZE = (1200, 630)
# Every game pixel becomes a 4x4 block, so the card stays crisp pixel art.
CARD_SCALE = 4
# The part of the 320x213 ending art the card shows: Matt, TOKEN, the letter and the sun.
CARD_CROP = (20, 22, 320, 180)

# TOKEN's face in the ending art, antenna to chin, on the sunset: a square 45
# pixels a side so the home-screen icon is exactly 4x and the tab icons scale down.
TOKEN_FACE = (134, 85, 179, 130)
TOUCH_ICON_SCALE = 4
TAB_ICON_SIZES = (16, 32)

_GLYPH_ENTRY = re.compile(r"^\s*(?:'((?:\\.|[^'\\])+)'|\"(.)\"|(\$|\w)):\s*(?:'([.# ]+)'|(BLANK)),$")


def load_glyphs(source: str) -> dict[str, list[str]]:
    """The GLYPH_ROWS table from pixel-font.ts: each character's eight rows of five."""
    blank = " ".join(["." * GLYPH_W] * GLYPH_H)
    glyphs: dict[str, list[str]] = {}
    for line in source.splitlines():
        match = _GLYPH_ENTRY.match(line)
        if not match:
            continue
        quoted, double_quoted, bare, rows, is_blank = match.groups()
        char = (quoted.encode().decode("unicode_escape") if quoted else None) or double_quoted or bare
        glyphs[char] = (blank if is_blank else rows).split(" ")
    return glyphs


def text_width(text: str) -> int:
    """Width in game pixels, as textWidth in pixel-font.ts reckons it."""
    return 0 if not text else len(text) * CELL_W - 1


def render_text(glyphs: dict[str, list[str]], text: str, color: tuple[int, int, int, int]) -> Image.Image:
    """One line at game scale, with the game's one-pixel ink shadow down and right."""
    im = Image.new("RGBA", (len(text) * CELL_W, CELL_H), (0, 0, 0, 0))
    for fill, offset in ((INK, 1), (color, 0)):
        for i, char in enumerate(text):
            for y, row in enumerate(glyphs[char]):
                for x, pixel in enumerate(row):
                    if pixel == "#":
                        im.putpixel((i * CELL_W + x + offset, y + offset), fill)
    return im


def paste_text(
    canvas: Image.Image,
    glyphs: dict[str, list[str]],
    text: str,
    color: tuple[int, int, int, int],
    right: int,
    top: int,
    scale: int = 1,
) -> None:
    line = render_text(glyphs, text, color)
    line = line.resize((line.width * scale, line.height * scale), Image.Resampling.NEAREST)
    canvas.alpha_composite(line, (right - text_width(text) * scale, top))


def share_card(hired: Image.Image, glyphs: dict[str, list[str]]) -> Image.Image:
    """The rooftop ending with the title logo and the pitch in the sunset sky."""
    base = hired.convert("RGBA").crop(CARD_CROP)
    right = base.width - 8
    paste_text(base, glyphs, "OPEN TO WORK", HEAD_COLOR, right, 7, scale=2)
    paste_text(base, glyphs, "a co-op beat 'em up", TEXT_COLOR, right, 29)
    paste_text(base, glyphs, "about the job hunt", TEXT_COLOR, right, 39)
    big = base.resize((base.width * CARD_SCALE, base.height * CARD_SCALE), Image.Resampling.NEAREST)
    return big.crop((0, 0, *CARD_SIZE)).convert("RGB")


def token_face(hired: Image.Image) -> Image.Image:
    """TOKEN grinning at the camera, the one front view of him in the game."""
    return hired.convert("RGB").crop(TOKEN_FACE)


def touch_icon(face: Image.Image) -> Image.Image:
    """The 180x180 home-screen icon, whole pixels, opaque (iOS paints transparency black)."""
    return face.resize((face.width * TOUCH_ICON_SCALE, face.height * TOUCH_ICON_SCALE), Image.Resampling.NEAREST)


def tab_icon(face: Image.Image, size: int) -> Image.Image:
    """Too small for whole pixels, so filtered: a smooth 32 reads better than a chopped one."""
    return face.resize((size, size), Image.Resampling.LANCZOS)


def main() -> None:
    glyphs = load_glyphs(FONT_SOURCE.read_text())
    hired = Image.open(PUBLIC / "sprites/ending/hired.png")
    share_card(hired, glyphs).save(PUBLIC / "og.png", optimize=True)
    face = token_face(hired)
    tab_icon(face, 32).save(PUBLIC / "favicon.png", optimize=True)
    # Some crawlers and old browsers ask for /favicon.ico whatever the page says.
    face.save(PUBLIC / "favicon.ico", sizes=[(n, n) for n in TAB_ICON_SIZES])
    touch_icon(face).save(PUBLIC / "apple-touch-icon.png", optimize=True)
    for name in ("og.png", "favicon.png", "favicon.ico", "apple-touch-icon.png"):
        print(f"wrote public/{name}")


if __name__ == "__main__":
    main()
