const User = require('../models/User');
const express = require('express');

const router = express.Router();

const moodTerms = {
  Happy: 'happy bollywood upbeat',
  Sad: 'sad romantic bollywood',
  Chill: 'chill lofi hindi',
  Focus: 'focus instrumental study',
  Romance: 'romantic hindi love',
  Party: 'party bollywood dance',
  Angry: 'energetic rock workout',
  Sleepy: 'sleep calm lofi',
  Melancholic: 'melancholic hindi acoustic'
};

function formatDuration(ms) {
  if (!ms) return '3:30';
  const total = Math.round(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = String(total % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function emojiForMood(mood) {
  return {
    Happy: '😊', Sad: '💔', Chill: '🌙', Focus: '🎯', Romance: '💕',
    Party: '🎉', Angry: '🔥', Sleepy: '🌙', Melancholic: '📖'
  }[mood] || '🎵';
}

router.get('/search', async (req, res) => {
  const q = String(req.query.q || '').trim();
  const mood = String(req.query.mood || 'Happy').trim();
  const term = encodeURIComponent([q, moodTerms[mood] || moodTerms.Happy].filter(Boolean).join(' '));
  const url = `https://itunes.apple.com/search?term=${term}&media=music&entity=song&limit=20`;

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`iTunes responded ${response.status}`);
    const data = await response.json();
    const songs = (data.results || []).map((track) => ({
      name: track.trackName,
      artist: track.artistName,
      album: track.collectionName,
      dur: formatDuration(track.trackTimeMillis),
      emoji: emojiForMood(mood),
      previewUrl: track.previewUrl,
      artworkUrl: track.artworkUrl100,
      sourceUrl: track.trackViewUrl
    }));
    res.json({ mood, query: q, songs });
  } catch (error) {
    res.status(502).json({ error: 'Song API request failed', detail: error.message });
  }
});

router.get('/mood', async (req, res) => {
  const mood = String(req.query.mood || 'Happy').trim();
  const term = encodeURIComponent(moodTerms[mood] || moodTerms.Happy);
  const url = `https://itunes.apple.com/search?term=${term}&media=music&entity=song&limit=20`;

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`iTunes responded ${response.status}`);
    const data = await response.json();
    const songs = (data.results || []).map((track) => ({
      name: track.trackName,
      artist: track.artistName,
      album: track.collectionName,
      dur: formatDuration(track.trackTimeMillis),
      emoji: emojiForMood(mood),
      previewUrl: track.previewUrl,
      artworkUrl: track.artworkUrl100,
      sourceUrl: track.trackViewUrl
    }));
    res.json({ mood, songs });
  } catch (error) {
    res.status(502).json({ error: 'Mood suggestions failed', detail: error.message });
  }
});

// ── PLAYLIST ROUTES ──

router.get('/playlists', async (req, res) => {
  try {
    if (!req.user) return res.json({ playlists: [] });
    const user = await User.findById(req.user.id);
    res.json({ playlists: user.playlists });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/playlists', async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Not logged in' });
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Name required' });
    const user = await User.findById(req.user.id);
    user.playlists.push({ name: name.trim(), songs: [] });
    await user.save();
    const playlist = user.playlists[user.playlists.length - 1];
    res.json({ playlist });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/playlists/:id/add', async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Not logged in' });
    const { song } = req.body;
    const user = await User.findById(req.user.id);
    const playlist = user.playlists.id(req.params.id);
    if (!playlist) return res.status(404).json({ error: 'Playlist not found' });
    playlist.songs.push(song);
    await user.save();
    res.json({ playlist });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/playlists/:id/songs/:idx', async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Not logged in' });
    const user = await User.findById(req.user.id);
    const playlist = user.playlists.id(req.params.id);
    if (!playlist) return res.status(404).json({ error: 'Playlist not found' });
    playlist.songs.splice(Number(req.params.idx), 1);
    await user.save();
    res.json({ playlist });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/playlists/:id', async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Not logged in' });
    const user = await User.findById(req.user.id);
    user.playlists.pull({ _id: req.params.id });
    await user.save();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
