import base64
import json
import sys


EXPRESSION_TO_MOOD = {
    "happy": "Happy",
    "surprise": "Happy",
    "neutral": "Chill",
    "sad": "Sad",
    "angry": "Angry",
    "fear": "Melancholic",
    "disgust": "Angry",
}


def respond(payload, status=0):
    sys.stdout.write(json.dumps(payload))
    raise SystemExit(status)


def decode_image_bytes(payload):
    raw_image = payload.get("image") or ""
    if "," in raw_image and raw_image.startswith("data:"):
        raw_image = raw_image.split(",", 1)[1]
    if not raw_image:
        respond({"error": "Missing base64 image"}, 2)
    try:
        return base64.b64decode(raw_image)
    except Exception as exc:
        respond({"error": f"Invalid base64 image: {exc}"}, 2)


def mood_from_expression(expression):
    key = str(expression or "").strip().lower()
    return EXPRESSION_TO_MOOD.get(key, "Chill")


def analyze_with_deepface(image_bytes):
    try:
        import cv2
        import numpy as np
        from deepface import DeepFace
    except Exception as exc:
        return None, f"DeepFace unavailable: {exc}"

    image_array = np.frombuffer(image_bytes, dtype=np.uint8)
    image = cv2.imdecode(image_array, cv2.IMREAD_COLOR)
    if image is None:
        return None, "Could not decode image"

    try:
        result = DeepFace.analyze(
            img_path=image,
            actions=["emotion"],
            enforce_detection=False,
            detector_backend="opencv",
            silent=True,
        )
    except Exception as exc:
        return None, f"DeepFace analysis failed: {exc}"

    if isinstance(result, list):
        result = result[0] if result else {}

    expression = result.get("dominant_emotion") or "neutral"
    emotion_scores = result.get("emotion") or {}
    confidence = float(emotion_scores.get(expression, 0)) / 100 if emotion_scores else 0

    return {
        "mood": mood_from_expression(expression),
        "confidence": round(confidence, 4),
        "rawLabel": expression,
        "provider": "python-deepface",
    }, None


def analyze_with_opencv_heuristic(image_bytes):
    try:
        import cv2
        import numpy as np
    except Exception as exc:
        return None, f"OpenCV unavailable: {exc}"

    image_array = np.frombuffer(image_bytes, dtype=np.uint8)
    image = cv2.imdecode(image_array, cv2.IMREAD_COLOR)
    if image is None:
        return None, "Could not decode image"

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    face_model = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
    smile_model = cv2.data.haarcascades + "haarcascade_smile.xml"
    face_cascade = cv2.CascadeClassifier(face_model)
    smile_cascade = cv2.CascadeClassifier(smile_model)
    faces = face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(48, 48))

    if len(faces) == 0:
        return {
            "mood": "Chill",
            "confidence": 0,
            "rawLabel": "no_face",
            "provider": "python-opencv-heuristic",
        }, None

    x, y, w, h = max(faces, key=lambda rect: rect[2] * rect[3])
    face_gray = gray[y:y + h, x:x + w]
    smiles = smile_cascade.detectMultiScale(face_gray, scaleFactor=1.7, minNeighbors=20, minSize=(20, 20))

    if len(smiles) > 0:
        raw_label = "happy"
        mood = "Happy"
        confidence = 0.62
    else:
        brightness = float(face_gray.mean())
        contrast = float(face_gray.std())
        if brightness < 75:
            raw_label = "sad"
            mood = "Sad"
            confidence = 0.38
        elif contrast > 58:
            raw_label = "focus"
            mood = "Focus"
            confidence = 0.34
        else:
            raw_label = "neutral"
            mood = "Chill"
            confidence = 0.42

    return {
        "mood": mood,
        "confidence": confidence,
        "rawLabel": raw_label,
        "provider": "python-opencv-heuristic",
    }, None


def main():
    try:
        payload = json.loads(sys.stdin.read() or "{}")
    except Exception as exc:
        respond({"error": f"Invalid JSON input: {exc}"}, 2)

    image_bytes = decode_image_bytes(payload)

    result, deepface_error = analyze_with_deepface(image_bytes)
    if result:
        respond(result)

    result, opencv_error = analyze_with_opencv_heuristic(image_bytes)
    if result:
        result["warning"] = deepface_error
        respond(result)

    respond({
        "error": "No Python face expression backend is available",
        "detail": opencv_error or deepface_error,
    }, 3)


if __name__ == "__main__":
    main()
