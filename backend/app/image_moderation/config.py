import os
from dataclasses import asdict, dataclass


@dataclass(frozen=True)
class ImageModerationThresholds:
    violence_reject: float = 0.80
    nsfw_blur: float = 0.70
    review_floor: float = 0.40
    safe_min: float = 0.80
    appeal_window_minutes: int = 10

    def snapshot(self):
        return asdict(self)


DEFAULT_THRESHOLDS = ImageModerationThresholds()


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
    try:
        window = int(os.getenv("IMAGE_MOD_APPEAL_WINDOW_MINUTES", "10"))
    except (TypeError, ValueError):
        window = 10
    if window <= 0:
        window = 10
    candidate = ImageModerationThresholds(candidate.violence_reject, candidate.nsfw_blur, candidate.review_floor, candidate.safe_min, window)
    return candidate if valid else ImageModerationThresholds(appeal_window_minutes=window)
