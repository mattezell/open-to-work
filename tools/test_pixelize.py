"""Unit tests for pixelize's strip splitting. Run: python3 -m unittest discover tools"""

from __future__ import annotations

import unittest

from PIL import Image, ImageDraw

from pixelize import split_frames_by_blob


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
