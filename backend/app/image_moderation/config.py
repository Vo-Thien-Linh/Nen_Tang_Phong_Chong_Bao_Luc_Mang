import os
import json
from dataclasses import asdict, dataclass
from pathlib import Path


@dataclass(frozen=True)
class ImageModerationThresholds:
    violence_reject: float = 0.80
    nsfw_blur: float = 0.70
    review_floor: float = 0.40
    safe_min: float = 0.60

    def snapshot(self):
        return asdict(self)


MODEL_CONFIG_PATH = Path(__file__).resolve().parents[2] / "ml_models" / "image_moderation" / "config.json"


def _model_auto_approve_safe():
    try:
        with MODEL_CONFIG_PATH.open("r", encoding="utf-8") as handle:
            value = float(json.load(handle)["thresholds"]["auto_approve_safe"])
        if value == value and value not in (float("inf"), float("-inf")) and 0 < value < 1:
            return value
    except (OSError, KeyError, TypeError, ValueError, json.JSONDecodeError):
        pass
    return 0.60


DEFAULT_THRESHOLDS = ImageModerationThresholds(safe_min=_model_auto_approve_safe())


def _number(name, default):
    try:
        value = float(os.getenv(name, str(default)))
        return value if value == value and value not in (float("inf"), float("-inf")) else default
    except (TypeError, ValueError):
        return default


def get_image_moderation_thresholds():
    candidate = ImageModerationThresholds(
        violence_reject=_number("IMAGE_MOD_VIOLENCE_REJECT", DEFAULT_THRESHOLDS.violence_reject),
        nsfw_blur=_number("IMAGE_MOD_NSFW_BLUR", DEFAULT_THRESHOLDS.nsfw_blur),
        review_floor=_number("IMAGE_MOD_REVIEW_FLOOR", DEFAULT_THRESHOLDS.review_floor),
        safe_min=_number("IMAGE_MOD_SAFE_MIN", DEFAULT_THRESHOLDS.safe_min),
    )
    valid = (
        0 < candidate.review_floor < candidate.nsfw_blur <= 1
        and 0 < candidate.review_floor < candidate.violence_reject <= 1
        and 0 < candidate.safe_min <= 1
    )
    return candidate if valid else DEFAULT_THRESHOLDS
