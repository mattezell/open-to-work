"""Unit tests for pixelize's strip splitting. Run: python3 -m unittest discover tools"""

from __future__ import annotations

import unittest

from PIL import Image, ImageDraw

from pixelize import crop_rows, seamless, split_frames_by_blob


def strip(boxes: list[tuple[int, int, int, int]], size: tuple[int, int] = (400, 100)) -> Image.Image:
    im = Image.new("RGBA", size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(im)
    for box in boxes:
        draw.rectangle(box, fill=(200, 40, 40, 255))
    return im


class SplitFramesByBlob(unittest.TestCase):
    def test_wide_pose_crossing_a_slot_boundary_is_kept_whole(self) -> None:
        # Slot width would be 100; the second figure spans x 90..230.
        im = strip([(10, 10, 60, 90), (90, 70, 230, 90), (250, 10, 300, 90), (320, 10, 370, 90)])
        crops = split_frames_by_blob(im, 4)
        assert crops is not None
        self.assertEqual(crops[1].size, (141, 21))

    def test_figures_overlapping_in_x_are_separated_and_ordered(self) -> None:
        # Second figure starts left of where the first ends, but lower down.
        im = strip([(10, 10, 120, 40), (100, 60, 200, 90)], size=(220, 100))
        crops = split_frames_by_blob(im, 2)
        assert crops is not None
        self.assertEqual([c.size for c in crops], [(111, 31), (101, 31)])

    def test_specks_are_dropped(self) -> None:
        im = strip([(10, 10, 60, 90), (70, 5, 72, 7), (150, 10, 200, 90)], size=(220, 100))
        crops = split_frames_by_blob(im, 2)
        assert crops is not None
        self.assertEqual([c.size for c in crops], [(51, 81), (51, 81)])

    def test_falls_back_when_a_frame_is_really_a_detached_limb(self) -> None:
        # Three figures asked for, but the third blob is a small fist.
        im = strip([(10, 10, 60, 90), (100, 10, 150, 90), (160, 40, 166, 46)], size=(220, 100))
        self.assertIsNone(split_frames_by_blob(im, 3))

    def test_falls_back_when_there_are_too_few_blobs(self) -> None:
        im = strip([(10, 10, 60, 90)], size=(220, 100))
        self.assertIsNone(split_frames_by_blob(im, 2))


if __name__ == "__main__":
    unittest.main()


def ramp(width: int) -> Image.Image:
    """A plate whose red channel climbs left to right: its raw seam is one big jump."""
    im = Image.new("RGBA", (width, 2))
    im.putdata([(round(x * 255 / (width - 1)), 0, 0, 255) for _ in range(2) for x in range(width)])
    return im


def red(im: Image.Image, x: int) -> int:
    return im.getpixel((x, 0))[0]


class Seamless(unittest.TestCase):
    def test_drops_the_overlap_from_the_width(self) -> None:
        self.assertEqual(seamless(ramp(200), 0.1).size, (180, 2))

    def test_the_wrap_is_no_harsher_than_the_plate_itself(self) -> None:
        tiled = seamless(ramp(200), 0.1)
        w = tiled.size[0]
        steps = [abs(red(tiled, (x + 1) % w) - red(tiled, x)) for x in range(w)]
        # Raw, wrapping from the last column to the first jumps by 255.
        self.assertLess(abs(red(tiled, 0) - red(tiled, w - 1)), 12)
        self.assertLess(max(steps), 20)

    def test_leaves_the_middle_of_the_plate_alone(self) -> None:
        plate = ramp(200)
        tiled = seamless(plate, 0.1)
        for x in (20, 100, 179):
            self.assertEqual(tiled.getpixel((x, 1)), plate.getpixel((x, 1)))

    def test_zero_overlap_is_a_no_op(self) -> None:
        plate = ramp(50)
        self.assertIs(seamless(plate, 0), plate)

    def test_refuses_an_overlap_that_eats_the_plate(self) -> None:
        with self.assertRaises(ValueError):
            seamless(ramp(50), 0.5)


class CropRows(unittest.TestCase):
    def test_keeps_the_band_between_the_fractions(self) -> None:
        plate = Image.new("RGBA", (40, 100))
        self.assertEqual(crop_rows(plate, 0, 0.7).size, (40, 70))
        self.assertEqual(crop_rows(plate, 0.25, 1).size, (40, 75))

    def test_refuses_a_band_outside_the_image_or_upside_down(self) -> None:
        plate = Image.new("RGBA", (40, 100))
        for top, bottom in ((0.5, 0.5), (0.8, 0.2), (-0.1, 1), (0, 1.2)):
            with self.assertRaises(ValueError):
                crop_rows(plate, top, bottom)
