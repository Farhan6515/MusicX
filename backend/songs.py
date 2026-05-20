from bson import ObjectId
import requests
from flask import Blueprint, jsonify, request

from . import db
from .auth import current_user


songs_bp = Blueprint("songs", __name__, url_prefix="/api/songs")

MOOD_TERMS = {
    "Happy": "happy bollywood upbeat",
    "Sad": "sad romantic bollywood",
    "Chill": "chill lofi hindi",
    "Focus": "focus instrumental study",
    "Romance": "romantic hindi love",
    "Party": "party bollywood dance",
    "Angry": "energetic rock workout",
    "Sleepy": "sleep calm lofi",
    "Melancholic": "melancholic hindi acoustic",
}


def format_duration(ms):
    if not ms:
        return "3:30"
    total = round(ms / 1000)
    return f"{total // 60}:{total % 60:02d}"


def emoji_for_mood(mood):
    return {
        "Happy": "😊",
        "Sad": "💔",
        "Chill": "🌙",
        "Focus": "🎯",
        "Romance": "💕",
        "Party": "🎉",
        "Angry": "🔥",
        "Sleepy": "🌙",
        "Melancholic": "📖",
    }.get(mood, "🎵")


def fetch_songs(term, mood):
    response = requests.get(
        "https://itunes.apple.com/search",
        params={"term": term, "media": "music", "entity": "song", "limit": 20},
        timeout=20,
    )
    response.raise_for_status()
    return [
        {
            "name": track.get("trackName"),
            "artist": track.get("artistName"),
            "album": track.get("collectionName"),
            "dur": format_duration(track.get("trackTimeMillis")),
            "emoji": emoji_for_mood(mood),
            "previewUrl": track.get("previewUrl"),
            "artworkUrl": track.get("artworkUrl100"),
            "sourceUrl": track.get("trackViewUrl"),
        }
        for track in response.json().get("results", [])
    ]


@songs_bp.get("/search")
def search():
    query = request.args.get("q", "").strip()
    mood = request.args.get("mood", "Happy").strip()
    term = " ".join(part for part in [query, MOOD_TERMS.get(mood, MOOD_TERMS["Happy"])] if part)
    try:
        return jsonify({"mood": mood, "query": query, "songs": fetch_songs(term, mood)})
    except Exception as error:
        return jsonify({"error": "Song API request failed", "detail": str(error)}), 502


@songs_bp.get("/mood")
def mood():
    mood_name = request.args.get("mood", "Happy").strip()
    term = MOOD_TERMS.get(mood_name, MOOD_TERMS["Happy"])
    try:
        return jsonify({"mood": mood_name, "songs": fetch_songs(term, mood_name)})
    except Exception as error:
        return jsonify({"error": "Mood suggestions failed", "detail": str(error)}), 502


@songs_bp.get("/playlists")
def playlists():
    user = current_user()
    if not user:
        return jsonify({"playlists": []})
    return jsonify({"playlists": [db.playlist_out(item) for item in user.get("playlists", [])]})


@songs_bp.post("/playlists")
def create_playlist():
    user = current_user()
    if not user:
        return jsonify({"error": "Not logged in"}), 401
    name = (request.get_json(silent=True) or {}).get("name", "").strip()
    if not name:
        return jsonify({"error": "Name required"}), 400
    playlist = {"_id": ObjectId(), "name": name, "songs": []}
    db.users.update_one({"_id": user["_id"]}, {"$push": {"playlists": playlist}})
    return jsonify({"playlist": db.playlist_out(playlist)})


@songs_bp.post("/playlists/<playlist_id>/add")
def add_song(playlist_id):
    user = current_user()
    if not user:
        return jsonify({"error": "Not logged in"}), 401
    song = (request.get_json(silent=True) or {}).get("song")
    playlist_object_id = db.oid(playlist_id)
    if playlist_object_id is None:
        return jsonify({"error": "Playlist not found"}), 404
    result = db.users.update_one(
        {"_id": user["_id"], "playlists._id": playlist_object_id},
        {"$push": {"playlists.$.songs": song}},
    )
    if not result.matched_count:
        return jsonify({"error": "Playlist not found"}), 404
    user = db.find_user(user["_id"])
    playlist = next(item for item in user.get("playlists", []) if item.get("_id") == playlist_object_id)
    return jsonify({"playlist": db.playlist_out(playlist)})


@songs_bp.delete("/playlists/<playlist_id>/songs/<int:index>")
def delete_song(playlist_id, index):
    user = current_user()
    if not user:
        return jsonify({"error": "Not logged in"}), 401
    playlist_object_id = db.oid(playlist_id)
    playlist = next((item for item in user.get("playlists", []) if item.get("_id") == playlist_object_id), None)
    if not playlist:
        return jsonify({"error": "Playlist not found"}), 404
    songs = playlist.get("songs", [])
    if 0 <= index < len(songs):
        songs.pop(index)
    db.users.update_one(
        {"_id": user["_id"], "playlists._id": playlist_object_id},
        {"$set": {"playlists.$.songs": songs}},
    )
    playlist["songs"] = songs
    return jsonify({"playlist": db.playlist_out(playlist)})


@songs_bp.delete("/playlists/<playlist_id>")
def delete_playlist(playlist_id):
    user = current_user()
    if not user:
        return jsonify({"error": "Not logged in"}), 401
    playlist_object_id = db.oid(playlist_id)
    db.users.update_one({"_id": user["_id"]}, {"$pull": {"playlists": {"_id": playlist_object_id}}})
    return jsonify({"success": True})
