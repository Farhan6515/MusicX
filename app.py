import os
from pathlib import Path

from dotenv import load_dotenv
from flask import Flask, jsonify, send_from_directory
from flask_cors import CORS

from backend.auth import auth_bp
from backend import db
from backend.mood import mood_bp
from backend.songs import songs_bp


ROOT = Path(__file__).resolve().parent
FRONTEND = ROOT / "frontend"

load_dotenv(ROOT / ".env")


def create_app():
    db.connect_db()

    app = Flask(__name__, static_folder=str(FRONTEND), static_url_path="")
    app.secret_key = os.getenv("SESSION_SECRET", "dev-only-change-me")
    app.config.update(
        SESSION_COOKIE_NAME="musicx.sid",
        SESSION_COOKIE_HTTPONLY=True,
        SESSION_COOKIE_SAMESITE="Lax",
        SESSION_COOKIE_SECURE=False,
        MAX_CONTENT_LENGTH=8 * 1024 * 1024,
    )

    CORS(app, origins=[os.getenv("APP_URL", "http://localhost:3000")], supports_credentials=True)

    app.register_blueprint(auth_bp)
    app.register_blueprint(mood_bp)
    app.register_blueprint(songs_bp)

    @app.get("/api/health")
    def health():
        live = False
        try:
            if db.client:
                db.client.admin.command("ping")
                live = True
        except Exception:
            pass
        return jsonify({"ok": True, "service": "musicx-backend", "db": live})

    @app.get("/")
    def index():
        return send_from_directory(FRONTEND, "index.html")

    @app.errorhandler(404)
    def spa_fallback(_error):
        return send_from_directory(FRONTEND, "index.html")

    return app


if __name__ == "__main__":
    port = int(os.getenv("PORT", "3000"))
    app = create_app()
    print(f"MusicX running at http://localhost:{port}")
    if not db.db_connected:
        print("Running without MongoDB - sessions will not persist.")
    app.run(host="0.0.0.0", port=port, debug=os.getenv("FLASK_DEBUG") == "1", use_reloader=False)
