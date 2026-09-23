"""Unit tests for the share card and favicon builder. Run: python3 -m unittest discover tools"""

from __future__ import annotations

import unittest

from PIL import Image, ImageChops

from gencard import (
    CARD_SIZE,
    CELL_H,
    CELL_W,
    FONT_SOURCE,
    HEAD_COLOR,
    INK,
    PUBLIC,
    load_glyphs,
    render_text,
    share_card,
    tab_icon,
    text_width,
    token_face,
    touch_icon,
)

GLYPHS = load_glyphs(FONT_SOURCE.read_text())


def hired() -> Image.Image:
    return Image.open(PUBLIC / "sprites/ending/hired.png")


def same_pixels(a: Image.Image, b: Image.Image) -> bool:
    return a.size == b.size and ImageChops.difference(a.convert("RGB"), b.convert("RGB")).getbbox() is None


class LoadGlyphs(unittest.TestCase):
    def test_reads_every_printable_character_from_the_game_font(self) -> None:
        self.assertEqual(sorted(GLYPHS), [chr(c) for c in range(32, 127)])

    def test_every_glyph_is_eight_rows_of_five(self) -> None:
        for char, rows in GLYPHS.items():
            self.assertEqual([len(r) for r in rows], [5] * 8, repr(char))

    def test_unescapes_quoted_keys(self) -> None:
        self.assertEqual(GLYPHS["'"][0], "..#..")
        self.assertEqual(GLYPHS["\\"][0], "#....")
        self.assertEqual(GLYPHS[" "], ["....."] * 8)


class RenderText(unittest.TestCase):
    def test_measures_like_the_game(self) -> None:
        self.assertEqual(text_width(""), 0)
        self.assertEqual(text_width("OPEN TO WORK"), 12 * CELL_W - 1)

    def test_draws_the_glyph_with_an_ink_shadow_down_and_right(self) -> None:
        im = render_text(GLYPHS, "!", HEAD_COLOR)
        self.assertEqual(im.size, (CELL_W, CELL_H))
        self.assertEqual(im.getpixel((2, 0)), HEAD_COLOR)
        self.assertEqual(im.getpixel((3, 1)), INK)
        self.assertEqual(im.getpixel((0, 0))[3], 0)


class Outputs(unittest.TestCase):
    def test_the_card_is_the_large_preview_size_in_whole_game_pixels(self) -> None:
        card = share_card(hired(), GLYPHS)
        self.assertEqual(card.size, CARD_SIZE)
        block = card.crop((400, 400, 404, 404))
        self.assertEqual(len(set(block.get_flattened_data())), 1)

    def test_the_card_carries_the_gold_logo(self) -> None:
        card = share_card(hired(), GLYPHS)
        self.assertIn(HEAD_COLOR[:3], set(card.crop((600, 0, 1200, 120)).get_flattened_data()))

    def test_icons_are_the_sizes_the_page_declares(self) -> None:
        face = token_face(hired())
        self.assertEqual(touch_icon(face).size, (180, 180))
        self.assertEqual(tab_icon(face, 32).size, (32, 32))

    def test_committed_images_match_the_builder(self) -> None:
        face = token_face(hired())
        self.assertTrue(same_pixels(Image.open(PUBLIC / "og.png"), share_card(hired(), GLYPHS)), "rerun gencard.py")
        self.assertTrue(same_pixels(Image.open(PUBLIC / "favicon.png"), tab_icon(face, 32)), "rerun gencard.py")
        self.assertTrue(same_pixels(Image.open(PUBLIC / "apple-touch-icon.png"), touch_icon(face)), "rerun gencard.py")
        with Image.open(PUBLIC / "favicon.ico") as ico:
            self.assertEqual(ico.info["sizes"], {(16, 16), (32, 32)})


if __name__ == "__main__":
    unittest.main()
