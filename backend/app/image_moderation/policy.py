import math

from .config import ImageModerationThresholds, get_image_moderation_thresholds

SAFE = "safe"
SENSITIVE = "sensitive"
PENDING_REVIEW = "pending_review"
REJECTED = "rejected"


def _valid_scores(scores):
    if not isinstance(scores, dict) or set(scores) != {"safe", "nsfw", "violence"}:
        return False
    values = list(scores.values())
    return all(isinstance(value, (int, float)) and math.isfinite(value) and value >= 0 for value in values) and abs(sum(values) - 1) <= 0.01


def decide_image_moderation(scores, thresholds=None, failed=False):
    thresholds = thresholds or get_image_moderation_thresholds()
    if failed or not _valid_scores(scores):
        decision = PENDING_REVIEW
    else:
        safe, nsfw, violence = scores["safe"], scores["nsfw"], scores["violence"]
        if violence >= thresholds.violence_reject:
            decision = REJECTED
        elif nsfw >= thresholds.nsfw_blur:
            decision = SENSITIVE
        elif violence >= thresholds.review_floor or nsfw >= thresholds.review_floor:
            decision = PENDING_REVIEW
        elif safe >= thresholds.safe_min:
            decision = SAFE
        else:
            decision = PENDING_REVIEW
    return {"decision": decision, "scores": scores, "thresholds": thresholds.snapshot()}


def decide_content_moderation(results, thresholds=None):
    thresholds = thresholds or get_image_moderation_thresholds()
    if not results:
        return {"decision": SAFE, "images": [], "thresholds": thresholds.snapshot()}
    priority = {SAFE: 0, SENSITIVE: 1, PENDING_REVIEW: 2, REJECTED: 3}
    decisions = [decide_image_moderation(item.get("scores"), thresholds, item.get("failed", False)) for item in results]
    winner = max(decisions, key=lambda item: priority[item["decision"]])
    return {"decision": winner["decision"], "images": decisions, "thresholds": thresholds.snapshot()}


def image_preview_payload(result):
    decision = result["decision"]
    category = {SAFE: "SAFE", SENSITIVE: "SENSITIVE", REJECTED: "VIOLATION", PENDING_REVIEW: "PENDING_REVIEW"}[decision]
    scores = result["scores"]
    confidence_label = {
        SAFE: "safe",
        SENSITIVE: "nsfw",
        REJECTED: "violence",
    }.get(decision)
    if decision == PENDING_REVIEW and scores:
        confidence_label = max(("nsfw", "violence"), key=scores.get)
    confidence_labels = {"safe": "An toàn", "nsfw": "Nội dung nhạy cảm", "violence": "Bạo lực"}
    return {
        "category": category,
        "decision": decision,
        "confidence": scores.get(confidence_label) if scores and confidence_label else None,
        "confidenceLabel": confidence_labels.get(confidence_label),
        "source": "efficientnet-b1" if scores else "unavailable",
    }
