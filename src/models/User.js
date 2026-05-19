const mongoose = require('mongoose');

const playlistSongSchema = new mongoose.Schema({
  name: String,
  artist: String,
  album: String,
  dur: String,
  emoji: String
}, { _id: false });

const playlistSchema = new mongoose.Schema({
  name: { type: String, required: true },
  songs: [playlistSongSchema]
});

const userSchema = new mongoose.Schema({
  googleId: { type: String, index: true, unique: true, sparse: true },
  displayName: { type: String, required: true },
  email: { type: String, index: true },
  avatar: String,
  provider: { type: String, default: 'google' },
  favoriteMood: String,
  playlists: [playlistSchema],
  lastLoginAt: Date
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
