import os
from datetime import datetime, timezone

import certifi
from bson import ObjectId
from pymongo import MongoClient
from pymongo import ReturnDocument
from pymongo.errors import PyMongoError


client = None
db = None
users = None
db_connected = False


def connect_db():
    global client, db, users, db_connected

    uri = os.getenv("MONGODB_URI")
    if not uri:
        print("MONGODB_URI is missing. Auth sessions will not persist in MongoDB.")
        return False

    try:
        client = MongoClient(uri, tlsCAFile=certifi.where(), serverSelectionTimeoutMS=5000)
        client.admin.command("ping")
        db_name = os.getenv("MONGODB_DB") or "musicx"
        db = client.get_default_database(default=db_name)
        users = db.users
        users.create_index("googleId", unique=True, sparse=True)
        users.create_index("email")
        db_connected = True
        print("MongoDB connected")
        return True
    except PyMongoError as error:
        print(f"MongoDB connection failed: {error}")
        db_connected = False
        return False


def oid(value):
    try:
        return ObjectId(str(value))
    except Exception:
        return None


def public_user(user):
    if not user:
        return None

    return {
        "id": str(user.get("_id")),
        "name": user.get("displayName"),
        "email": user.get("email"),
        "avatar": user.get("avatar"),
        "provider": user.get("provider", "google"),
    }


def playlist_out(playlist):
    result = dict(playlist or {})
    if "_id" in result:
        result["_id"] = str(result["_id"])
    result["songs"] = result.get("songs") or []
    return result


def find_user_by_email(email):
    if users is None:
        return None
    return users.find_one({"email": email.strip().lower()})


def create_email_user(name, email, password_hash):
    if users is None:
        return None
    now = datetime.now(timezone.utc)
    doc = {
        "displayName": name,
        "email": email.strip().lower(),
        "passwordHash": password_hash,
        "provider": "email",
        "playlists": [],
        "createdAt": now,
        "updatedAt": now,
        "lastLoginAt": now,
    }
    result = users.insert_one(doc)
    doc["_id"] = result.inserted_id
    return doc


def find_user(user_id):
    if users is None:
        return None
    object_id = oid(user_id)
    if object_id is None:
        return None
    return users.find_one({"_id": object_id})


def upsert_google_user(profile):
    if users is None:
        return None

    email = (profile.get("email") or "").strip()
    name = profile.get("name") or (email.split("@")[0] if email else "MusicX Listener")
    now = datetime.now(timezone.utc)
    update = {
        "$set": {
            "googleId": profile.get("sub"),
            "displayName": name,
            "email": email,
            "avatar": profile.get("picture") or "",
            "provider": "google",
            "lastLoginAt": now,
            "updatedAt": now,
        },
        "$setOnInsert": {
            "playlists": [],
            "createdAt": now,
        },
    }
    return users.find_one_and_update(
        {"googleId": profile.get("sub")},
        update,
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )
