import os
from datetime import datetime, timezone
from urllib.parse import urlencode

import requests
from flask import Blueprint, jsonify, redirect, request, session
from werkzeug.security import check_password_hash, generate_password_hash

from . import db


auth_bp = Blueprint("auth", __name__, url_prefix="/auth")


GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"


def _frontend_url(path: str) -> str:
    """Return an absolute URL on the frontend (Vercel) for redirects.
    Falls back to a relative path so local dev still works."""
    base = os.getenv("APP_URL", "").rstrip("/")
    return f"{base}{path}" if base else path


def current_user():
    user = db.find_user(session.get("user_id"))
    if not user:
        # MongoDB unavailable — fall back to profile stored in session cookie
        return session.get("user_profile")
    return user


@auth_bp.get("/google")
def google_login():
    client_id = os.getenv("GOOGLE_CLIENT_ID", "missing-client-id")
    callback_url = os.getenv("GOOGLE_CALLBACK_URL") or request.url_root.rstrip("/") + "/auth/google/callback"
    params = {
        "client_id": client_id,
        "redirect_uri": callback_url,
        "response_type": "code",
        "scope": "openid profile email",
        "prompt": "select_account",
        "access_type": "offline",
    }
    return redirect(f"{GOOGLE_AUTH_URL}?{urlencode(params)}")


@auth_bp.get("/google/callback")
def google_callback():
    if request.args.get("error"):
        return redirect(_frontend_url("/?auth=failed"))

    code = request.args.get("code")
    if not code:
        return redirect(_frontend_url("/?auth=failed"))

    try:
        callback_url = os.getenv("GOOGLE_CALLBACK_URL") or request.url_root.rstrip("/") + "/auth/google/callback"
        token_response = requests.post(
            GOOGLE_TOKEN_URL,
            data={
                "code": code,
                "client_id": os.getenv("GOOGLE_CLIENT_ID", "missing-client-id"),
                "client_secret": os.getenv("GOOGLE_CLIENT_SECRET", "missing-client-secret"),
                "redirect_uri": callback_url,
                "grant_type": "authorization_code",
            },
            timeout=15,
        )
        token_response.raise_for_status()
        access_token = token_response.json().get("access_token")
        profile_response = requests.get(
            GOOGLE_USERINFO_URL,
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=15,
        )
        profile_response.raise_for_status()
        profile_data = profile_response.json()
        user = db.upsert_google_user(profile_data)
        if user:
            session["user_id"] = str(user["_id"])
            session.pop("user_profile", None)
        else:
            # MongoDB unavailable — store profile in session cookie as fallback
            email = profile_data.get("email", "")
            fallback = {
                "_id": f"session:{profile_data.get('sub', email)}",
                "googleId": profile_data.get("sub"),
                "displayName": profile_data.get("name") or email.split("@")[0],
                "email": email,
                "avatar": profile_data.get("picture", ""),
                "provider": "google",
                "playlists": [],
            }
            session["user_id"] = fallback["_id"]
            session["user_profile"] = fallback
        return redirect(_frontend_url("/?auth=success"))
    except Exception as error:
        print(f"Google auth failed: {error}")
        return redirect(_frontend_url("/?auth=failed"))


@auth_bp.get("/me")
def me():
    user = current_user()
    if not user:
        return jsonify({"user": None}), 401
    return jsonify({"user": db.public_user(user)})


@auth_bp.post("/avatar")
def avatar():
    user = current_user()
    if not user:
        return jsonify({"error": "Not logged in"}), 401

    avatar_data = (request.get_json(silent=True) or {}).get("avatar")
    if not avatar_data or not str(avatar_data).startswith("data:image/"):
        return jsonify({"error": "Invalid image data"}), 400

    db.users.update_one({"_id": user["_id"]}, {"$set": {"avatar": avatar_data}})
    return jsonify({"avatar": avatar_data})


@auth_bp.post("/signup")
def signup():
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not name or not email or not password:
        return jsonify({"error": "Name, email and password are required"}), 400
    if len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters"}), 400
    if db.find_user_by_email(email):
        return jsonify({"error": "An account with this email already exists"}), 409

    user = db.create_email_user(name, email, generate_password_hash(password))
    if not user:
        return jsonify({"error": "Could not create account — database unavailable"}), 503

    session["user_id"] = str(user["_id"])
    session.pop("user_profile", None)
    return jsonify({"user": db.public_user(user)})


@auth_bp.post("/login")
def login():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400

    user = db.find_user_by_email(email)
    if not user or not user.get("passwordHash"):
        return jsonify({"error": "Invalid email or password"}), 401
    if not check_password_hash(user["passwordHash"], password):
        return jsonify({"error": "Invalid email or password"}), 401

    session["user_id"] = str(user["_id"])
    session.pop("user_profile", None)
    db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {"lastLoginAt": datetime.now(timezone.utc)}}
    )
    return jsonify({"user": db.public_user(user)})


@auth_bp.post("/logout")
def logout():
    session.clear()
    response = jsonify({"ok": True})
    response.delete_cookie("musicx.sid")
    return response
