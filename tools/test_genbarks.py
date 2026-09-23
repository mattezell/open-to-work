"""Unit tests for the bark bank filters. Run: python3 -m unittest discover tools"""

from __future__ import annotations

import unittest

from genbarks import build_messages, normalize, parse_reply, rejection, select


class Normalize(unittest.TestCase):
    def test_typographic_characters_become_ascii(self) -> None:
        self.assertEqual(normalize("\u201cIt\u2019s fine\u2026\u201d"), "It's fine...")

    def test_wrapping_quotes_and_extra_spaces_go(self) -> None:
        self.assertEqual(normalize('  "Per   my last email."  '), "Per my last email.")


class Rejection(unittest.TestCase):
    def test_a_short_plain_line_passes(self) -> None:
        self.assertIsNone(rejection("404: enemy not found", 40))

    def test_too_long(self) -> None:
        self.assertEqual(rejection("x" * 41, 40), "longer than 40")

    def test_non_ascii(self) -> None:
        self.assertEqual(rejection("Nice \U0001F916", 40), "not plain ASCII")

    def test_real_companies_and_the_old_employer_are_out(self) -> None:
        self.assertEqual(rejection("Rejected by LinkedIn again", 40), "banned word: linkedin")
        self.assertEqual(rejection("Say hi to Workday", 40), "banned word: workday")

    def test_banned_words_match_whole_words_only(self) -> None:
        self.assertIsNone(rejection("Metadata says hello", 40))
        self.assertIsNone(rejection("Assessment passed", 40))

    def test_hashtags_and_assistant_voice(self) -> None:
        self.assertEqual(rejection("#OpenToWork", 40), "hashtag or handle")
        self.assertEqual(rejection("As an AI, I cannot", 40), "banned phrase: as an ai")


class Select(unittest.TestCase):
    def test_seeds_lead_and_near_duplicates_are_dropped(self) -> None:
        kept, dropped = select(["Rejected."], ["rejected!", "Per my last email."], 8, 40)
        self.assertEqual(kept, ["Rejected.", "Per my last email."])
        self.assertEqual(dropped, [("rejected!", "duplicate")])

    def test_the_bank_stops_at_keep(self) -> None:
        kept, dropped = select(["A."], ["B.", "C.", "D."], 2, 40)
        self.assertEqual(kept, ["A.", "B."])
        self.assertEqual([reason for _, reason in dropped], ["bank full", "bank full"])

    def test_vetoed_lines_give_their_slot_to_the_next_candidate(self) -> None:
        kept, dropped = select(["A."], ["Weak line.", "B."], 2, 40, frozenset({"weak line"}))
        self.assertEqual(kept, ["A.", "B."])
        self.assertEqual(dropped, [("Weak line.", "vetoed")])

    def test_a_seed_that_breaks_the_rules_is_an_error(self) -> None:
        with self.assertRaises(ValueError):
            select(["x" * 50], [], 8, 40)


class ParseReply(unittest.TestCase):
    def test_json_array_inside_chatter(self) -> None:
        self.assertEqual(parse_reply('Sure!\n["a", "b", 3]\nEnjoy.'), ["a", "b"])

    def test_falls_back_to_one_line_each(self) -> None:
        self.assertEqual(parse_reply("1. First\n- Second\n\n"), ["First", "Second"])


class BuildMessages(unittest.TestCase):
    def test_prompt_carries_the_moment_the_limit_and_the_seeds(self) -> None:
        spec = {"persona": "P", "rules": ["R"], "candidates": 5, "ask_chars": 30}
        category = {"when": "TOKEN whiffs", "seeds": ["Confidently wrong."]}
        system, user = build_messages(spec, category)
        self.assertIn("- R", system["content"])
        self.assertIn("5 different lines TOKEN says when TOKEN whiffs", user["content"])
        self.assertIn("at most 30 characters", user["content"])
        self.assertIn("- Confidently wrong.", user["content"])


if __name__ == "__main__":
    unittest.main()
