"""Unit tests for genassets' post-process arguments. Run: python3 -m unittest discover tools"""

from __future__ import annotations

import unittest
from pathlib import Path

from genassets import build_prompt, layer_args

STYLE = {"world": "WORLD.", "sprite": "SPRITE.", "painted": "PAINTED.", "chroma": "FLAT."}
SRC = Path("raw.png")
OUT = Path("out.png")


def flag(args: list[str], name: str) -> str | None:
    return args[args.index(name) + 1] if name in args else None


class LayerArgs(unittest.TestCase):
    def test_an_opaque_plate_keeps_its_frame_and_tiles(self) -> None:
        args = layer_args({"height": 150}, SRC, OUT)
        self.assertEqual(flag(args, "--height"), "150")
        self.assertIn("--no-trim", args)
        self.assertEqual(flag(args, "--seamless"), "0.1")
        self.assertEqual(flag(args, "--alpha-threshold"), "0")

    def test_a_cutout_is_trimmed_to_its_buildings_and_not_crossfaded(self) -> None:
        args = layer_args({"height": 110, "cutout": True}, SRC, OUT)
        self.assertNotIn("--no-trim", args)
        self.assertNotIn("--seamless", args)

    def test_every_layer_is_snapped_to_the_genesis_grid(self) -> None:
        for asset in ({"height": 150}, {"height": 90, "cutout": True, "colors": 12}):
            args = layer_args(asset, SRC, OUT)
            self.assertNotIn("--no-palette", args)
            self.assertEqual(flag(args, "--genesis-colors"), str(asset.get("colors", 16)))

    def test_a_crop_is_passed_as_a_band(self) -> None:
        args = layer_args({"height": 112, "cutout": True, "crop": [0, 0.78]}, SRC, OUT)
        self.assertEqual(flag(args, "--crop"), "0,0.78")
        self.assertIsNone(flag(layer_args({"height": 150}, SRC, OUT), "--crop"))


class Prompt(unittest.TestCase):
    def test_a_layer_is_painted_not_a_sprite(self) -> None:
        prompt = build_prompt(STYLE, {"kind": "layer", "prompt": "A skyline. {chroma}"})
        self.assertIn("PAINTED.", prompt)
        self.assertNotIn("SPRITE.", prompt)
        self.assertIn("A skyline. FLAT.", prompt)


if __name__ == "__main__":
    unittest.main()
