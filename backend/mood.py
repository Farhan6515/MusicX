import base64
import json
import os
import random
import subprocess
from pathlib import Path

import requests
from flask import Blueprint, jsonify, request


mood_bp = Blueprint("mood", __name__, url_prefix="/api/mood")

MOOD_MAP = {
    "happy": "Happy",
    "joy": "Happy",
    "surprise": "Happy",
    "neutral": "Chill",
    "sad": "Sad",
    "sadness": "Sad",
    "angry": "Angry",
    "anger": "Angry",
    "fear": "Melancholic",
    "disgust": "Angry",
    "focus": "Focus",
    "no_face": "Chill",
}


def normalize_mood(label):
    key = str(label or "").lower()
    if key in MOOD_MAP:
        return MOOD_MAP[key]
    return key[:1].upper() + key[1:] if key else "Chill"


def fallback_mood():
    return random.choice(["Happy", "Chill", "Romance", "Focus", "Melancholic"])


def call_python_mood_scanner(image_bytes, mime_type):
    python_path = os.getenv("PYTHON_PATH", "python")
    script_path = Path(__file__).resolve().parents[1] / "scripts" / "mood_scan.py"
    payload = json.dumps({
        "image": base64.b64encode(image_bytes).decode("ascii"),
        "mimeType": mime_type or "image/jpeg",
    })
    result = subprocess.run(
        [python_path, str(script_path)],
        input=payload,
        capture_output=True,
        text=True,
        timeout=15,
        check=False,
    )
    data = json.loads(result.stdout or "{}")
    if result.returncode != 0 or data.get("error"):
        raise RuntimeError(data.get("detail") or data.get("error") or result.stderr or f"Python scanner exited with code {result.returncode}")
    return {
        "mood": normalize_mood(data.get("mood")),
        "confidence": float(data.get("confidence") or 0),
        "rawLabel": data.get("rawLabel"),
        "provider": data.get("provider") or "python",
    }


def call_huggingface(image_bytes, mime_type):
    token = os.getenv("HUGGINGFACE_API_KEY")
    model = os.getenv("HUGGINGFACE_FACE_MODEL", "dima806/facial_emotions_image_detection")
    if not token:
        return None
    response = requests.post(
        f"https://api-inference.huggingface.co/models/{model}",
        headers={"Authorization": f"Bearer {token}", "Content-Type": mime_type or "image/jpeg"},
        data=image_bytes,
        timeout=30,
    )
    response.raise_for_status()
    result = response.json()
    predictions = result[0] if result and isinstance(result[0], list) else result
    best = max(predictions, key=lambda item: item.get("score", 0)) if isinstance(predictions, list) and predictions else None
    if not best:
        return None
    return {
        "mood": normalize_mood(best.get("label")),
        "confidence": float(best.get("score") or 0),
        "provider": "huggingface",
        "rawLabel": best.get("label"),
    }


@mood_bp.post("/analyze")
def analyze():
    try:
        image_bytes = None
        mime_type = None

        uploaded = request.files.get("face")
        if uploaded:
            image_bytes = uploaded.read()
            mime_type = uploaded.mimetype
        else:
            image_data = (request.get_json(silent=True) or {}).get("image")
            if image_data and ";base64," in image_data:
                header, encoded = image_data.split(";base64,", 1)
                mime_type = header.replace("data:", "", 1)
                image_bytes = base64.b64decode(encoded)

        if not image_bytes:
            return jsonify({"error": 'Upload a face image as multipart field "face" or JSON "image" data URL.'}), 400

        warning = None
        try:
            detected = call_python_mood_scanner(image_bytes, mime_type)
        except Exception as python_error:
            warning = str(python_error)
            try:
                detected = call_huggingface(image_bytes, mime_type)
            except Exception:
                detected = None
            if not detected:
                detected = {
                    "mood": fallback_mood(),
                    "confidence": 0,
                    "provider": "fallback",
                    "rawLabel": None,
                }

        return jsonify({
            "mood": detected.get("mood"),
            "confidence": detected.get("confidence") or 0,
            "provider": detected.get("provider") or "fallback",
            "rawLabel": detected.get("rawLabel"),
            "warning": warning if detected.get("provider") == "fallback" else None,
        })
    except Exception as error:
        return jsonify({"error": "Mood scan failed", "detail": str(error)}), 500
