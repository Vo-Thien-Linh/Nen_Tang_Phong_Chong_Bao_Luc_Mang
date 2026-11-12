import os
import unittest

from app.image_moderation.config import DEFAULT_THRESHOLDS, get_image_moderation_thresholds
from app.image_moderation.policy import PENDING_REVIEW, REJECTED, SAFE, SENSITIVE, decide_content_moderation, decide_image_moderation, image_preview_payload


class ImageModerationPolicyTests(unittest.TestCase):
    def test_default_thresholds_when_env_missing(self):
        for name in ("IMAGE_MOD_VIOLENCE_REJECT", "IMAGE_MOD_NSFW_BLUR", "IMAGE_MOD_REVIEW_FLOOR", "IMAGE_MOD_SAFE_MIN"):
            os.environ.pop(name, None)
        self.assertEqual(get_image_moderation_thresholds(), DEFAULT_THRESHOLDS)

    def test_invalid_thresholds_fall_back(self):
        os.environ["IMAGE_MOD_REVIEW_FLOOR"] = "0.9"
        os.environ["IMAGE_MOD_NSFW_BLUR"] = "0.7"
        try:
            self.assertEqual(get_image_moderation_thresholds(), DEFAULT_THRESHOLDS)
        finally:
            os.environ.pop("IMAGE_MOD_REVIEW_FLOOR", None)
            os.environ.pop("IMAGE_MOD_NSFW_BLUR", None)

    def test_ordered_decisions(self):
        self.assertEqual(decide_image_moderation({"safe": .9, "nsfw": .05, "violence": .05})["decision"], SAFE)
        self.assertEqual(decide_image_moderation({"safe": .1, "nsfw": .1, "violence": .8})["decision"], REJECTED)
        self.assertEqual(decide_image_moderation({"safe": .1, "nsfw": .8, "violence": .1})["decision"], SENSITIVE)
        self.assertEqual(decide_image_moderation({"safe": .5, "nsfw": .1, "violence": .4})["decision"], PENDING_REVIEW)
        self.assertEqual(decide_image_moderation(None, failed=True)["decision"], PENDING_REVIEW)
        self.assertEqual(decide_content_moderation([{"scores": {"safe": .99, "nsfw": .005, "violence": .005}}, {"scores": {"safe": .1, "nsfw": .1, "violence": .8}}])["decision"], REJECTED)

    def test_preview_payload_preserves_confidence_for_selected_image_label(self):
        result = decide_image_moderation({"safe": .05, "nsfw": .08, "violence": .87})
        payload = image_preview_payload(result)
        self.assertEqual(payload["category"], "VIOLATION")
        self.assertEqual(payload["confidence"], .87)
        self.assertEqual(payload["confidenceLabel"], "Bạo lực")
        self.assertEqual(payload["source"], "efficientnet-b1")

    def test_failed_preview_does_not_invent_confidence(self):
        payload = image_preview_payload(decide_image_moderation(None, failed=True))
        self.assertEqual(payload["category"], "PENDING_REVIEW")
        self.assertIsNone(payload["confidence"])
        self.assertEqual(payload["source"], "unavailable")


if __name__ == "__main__":
    unittest.main()
