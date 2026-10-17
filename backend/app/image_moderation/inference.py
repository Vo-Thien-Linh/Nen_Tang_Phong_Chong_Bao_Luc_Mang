import io
import json
import math
import socket
import urllib.parse
import urllib.request
from functools import lru_cache
from pathlib import Path

import torch
from PIL import Image, ImageOps
from torchvision import models, transforms

MODEL_DIR = Path(__file__).resolve().parents[2] / "ml_models" / "image_moderation"
CONFIG_PATH = MODEL_DIR / "config.json"


class ImageModerationFailure(Exception):
    pass


def _load_config():
    with CONFIG_PATH.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def _allowed_host(host):
    return bool(host) and (host == "cloudinary.com" or host.endswith(".cloudinary.com"))


def _fetch_image(url, timeout=5, max_bytes=10 * 1024 * 1024):
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme != "https" or not _allowed_host(parsed.hostname):
        raise ImageModerationFailure("image host is not allowed")
    try:
        socket.getaddrinfo(parsed.hostname, 443)
    except OSError as exc:
        raise ImageModerationFailure("image host cannot be resolved") from exc
    request = urllib.request.Request(url, headers={"User-Agent": "NexusSocial-image-moderation"})
    with urllib.request.urlopen(request, timeout=timeout) as response:
        data = response.read(max_bytes + 1)
    if len(data) > max_bytes:
        raise ImageModerationFailure("image is too large")
    try:
        image = Image.open(io.BytesIO(data))
        image.load()
        return image
    except Exception as exc:
        raise ImageModerationFailure("image cannot be decoded") from exc


@lru_cache(maxsize=1)
def _runtime():
    config = _load_config()
    labels = config.get("labels")
    if not isinstance(labels, list) or len(labels) != 3 or set(labels) != {"safe", "nsfw", "violence"}:
        raise ImageModerationFailure("unexpected model labels")
    model = models.efficientnet_b1(weights=None)
    model.classifier[1] = torch.nn.Linear(model.classifier[1].in_features, len(labels))
    checkpoint = torch.load(MODEL_DIR / config["weights_file"], map_location="cpu", weights_only=True)
    state_dict = checkpoint.get("state_dict", checkpoint) if isinstance(checkpoint, dict) else checkpoint
    model.load_state_dict(state_dict)
    model.eval()
    preprocess = transforms.Compose([
        transforms.Resize(config["preprocess"]["resize_shorter_side"]),
        transforms.CenterCrop(config["preprocess"]["center_crop"]),
        transforms.ToTensor(),
        transforms.Normalize(mean=config["mean"], std=config["std"]),
    ])
    return model, preprocess, labels


def _infer_pil(image):
    model, preprocess, labels = _runtime()
    image = ImageOps.exif_transpose(image).convert("RGB")
    with torch.no_grad():
        probabilities = torch.softmax(model(preprocess(image).unsqueeze(0)), dim=1)[0].tolist()
    scores = dict(zip(labels, probabilities))
    if set(scores) != {"safe", "nsfw", "violence"} or not all(math.isfinite(value) for value in scores.values()) or abs(sum(scores.values()) - 1) > 0.01:
        raise ImageModerationFailure("invalid model probabilities")
    return {"scores": scores}


def infer_image_bytes(data):
    try:
        image = Image.open(io.BytesIO(data))
        image.load()
        return _infer_pil(image)
    except ImageModerationFailure:
        raise
    except Exception as exc:
        raise ImageModerationFailure("image cannot be decoded") from exc


def infer_image(url):
    try:
        return _infer_pil(_fetch_image(url))
    except ImageModerationFailure:
        raise
    except Exception as exc:
        raise ImageModerationFailure("image moderation failed") from exc
