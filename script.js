let SONGS = [
  { name: 'Kaise Hua', artist: 'Vishal Mishra', album: 'Kabir Singh', dur: '3:45', emoji: '💔' },
  { name: 'Tum Hi Ho', artist: 'Arijit Singh', album: 'Aashiqui 2', dur: '4:22', emoji: '❤️' },
  { name: 'Raataan Lambiyan', artist: 'Jubin Nautiyal', album: 'Shershaah', dur: '3:58', emoji: '🌙' },
  { name: 'Hawayein', artist: 'Arijit Singh', album: 'Jab Harry Met Sejal', dur: '4:46', emoji: '🌸' },
  { name: 'Ae Dil Hai Mushkil', artist: 'Arijit Singh', album: 'ADHM', dur: '4:31', emoji: '💕' },
  { name: 'Tera Ban Jaunga', artist: 'Akhil Sachdeva', album: 'Kabir Singh', dur: '3:30', emoji: '🌹' },
  { name: 'Shayad', artist: 'Arijit Singh', album: 'Love Aaj Kal', dur: '4:03', emoji: '✨' },
  { name: 'Phir Bhi Tumko Chahunka', artist: 'Darshan Raval', album: 'Single', dur: '3:52', emoji: '🫶' },
  { name: 'Hamari Adhuri Kahani', artist: 'Arijit Singh', album: 'HAK', dur: '5:03', emoji: '📖' },
  { name: '1 AM Feels', artist: 'Lofi Mix', album: 'Playlist', dur: '3:20', emoji: '🌃' },
];

const FALLBACK_SONGS = SONGS.map(song => ({ ...song }));
const moodEmoji = { Happy: '😊', Sad: '😢', Chill: '😌', Focus: '🎯', Romance: '💕', Party: '🎉', Angry: '😤', Sleepy: '🌙', Melancholic: '🌙' };

let showAllSongs = false;
const DEFAULT_VISIBLE = 12;
let currentIdx = 0;
let playing = false;
let progress = 35;
let progressTimer = null;
let selectedModalMood = null;
let searchTerm = '';
let searchTimer = null;
let profileUser = null;
let cameraStream = null;
let playlists = [];
let pickerTargetIdx = null;
let addedSongNames = new Set();

// ── RENDER SONGS ──

function renderSongs() {
  const list = document.getElementById('songList');
  const filtered = SONGS
    .map((song, index) => ({ song, index }))
    .filter(({ song }) => {
      const haystack = `${song.name} ${song.artist} ${song.album}`.toLowerCase();
      return haystack.includes(searchTerm);
    });

  const toShow = showAllSongs ? filtered : filtered.slice(0, DEFAULT_VISIBLE);

  const metaEl = document.getElementById('sectionMeta');
  if (metaEl) metaEl.textContent = `Based on your mood · ${filtered.length} tracks`;

  const seeAllBtn = document.getElementById('seeAllBtn');
  if (seeAllBtn) {
    if (filtered.length <= DEFAULT_VISIBLE) {
      seeAllBtn.style.display = 'none';
    } else {
      seeAllBtn.style.display = '';
      seeAllBtn.textContent = showAllSongs ? 'Show less' : 'See all →';
    }
  }

  if (!toShow.length) {
    list.innerHTML = '<div class="song-empty">No songs found</div>';
    return;
  }

  list.innerHTML = toShow.map(({ song: s, index: i }, visibleIndex) => `
    <div class="song-item ${i === currentIdx ? 'active' : ''}" id="song-${i}" onclick="playSong(${i})">
      <div class="song-num">${visibleIndex + 1}</div>
      <div class="song-eq"><div class="seq-b" style="height:4px"></div><div class="seq-b" style="height:7px"></div><div class="seq-b" style="height:5px"></div></div>
      <div class="song-thumb">${s.artworkUrl ? `<img src="${s.artworkUrl}" alt="" onload="this.classList.add('img-loaded')">` : (s.emoji || '🎵')}</div>
      <div class="song-info"><div class="song-name">${s.name}</div><div class="song-artist">${s.artist} · ${s.album}</div></div>
      <div class="song-right">
        <span class="song-dur">${s.dur}</span>
        <button class="add-pl-btn ${addedSongNames.has(s.name) ? 'added' : ''}" onclick="showPlaylistPicker(event,${i})" title="${addedSongNames.has(s.name) ? 'Added to playlist' : 'Add to playlist'}">
          ${addedSongNames.has(s.name)
            ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`
            : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`}
        </button>
      </div>
    </div>
  `).join('');
}

function toggleSeeAll() {
  showAllSongs = !showAllSongs;
  renderSongs();
}

// ── PLAYBACK ──

function playSong(idx) {
  if (!SONGS[idx]) return;
  currentIdx = idx;
  const s = SONGS[idx];

  // Animate song info out then in
  const npName = document.getElementById('npSongName');
  const npArtist = document.getElementById('npArtist');
  npName.classList.remove('np-anim'); npArtist.classList.remove('np-anim');
  void npName.offsetWidth;
  npName.textContent = s.name;
  npArtist.textContent = `${s.artist} · ${s.album}`;
  npName.classList.add('np-anim');
  npArtist.classList.add('np-anim');

  const artImg = document.getElementById('albumArtImg');
  const emojiEl = document.getElementById('albumEmoji');
  if (s.artworkUrl) {
    artImg.classList.remove('loaded');
    artImg.src = s.artworkUrl.replace('/100x100bb.', '/300x300bb.');
    artImg.style.display = 'block';
    artImg.onload = () => artImg.classList.add('loaded');
    emojiEl.style.display = 'none';
  } else {
    artImg.style.display = 'none';
    emojiEl.style.display = '';
    emojiEl.textContent = s.emoji || '🎵';
  }
  trackRecentlyPlayed(s);
  const plays = parseInt(localStorage.getItem('musix-plays') || '0');
  localStorage.setItem('musix-plays', plays + 1);
  playing = true;
  updatePlayIcon();
  progress = 0;
  document.getElementById('progressFill').style.width = '0%';
  document.getElementById('nowPlayingCard').classList.add('playing');
  renderSongs();
  startProgress();
  updateDashboardIfOpen();
}

function togglePlay() {
  playing = !playing;
  updatePlayIcon();
  if (playing) {
    document.getElementById('albumArt').classList.add('spinning');
    document.getElementById('nowPlayingCard').classList.add('playing');
    startProgress();
  } else {
    document.getElementById('albumArt').classList.remove('spinning');
    document.getElementById('nowPlayingCard').classList.remove('playing');
    clearInterval(progressTimer);
  }
}

function updatePlayIcon() {
  document.getElementById('playIcon').innerHTML = playing
    ? '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>'
    : '<path d="M8 5v14l11-7z"/>';
}

function durationToSeconds(duration) {
  const [min, sec] = String(duration || '3:30').split(':').map(Number);
  return (min || 3) * 60 + (sec || 30);
}

function startProgress() {
  clearInterval(progressTimer);
  progressTimer = setInterval(() => {
    progress = Math.min(100, progress + 0.12);
    document.getElementById('progressFill').style.width = progress + '%';
    const totalSec = durationToSeconds(SONGS[currentIdx]?.dur);
    const elapsed = Math.floor(progress / 100 * totalSec);
    const m = Math.floor(elapsed / 60);
    const s = elapsed % 60;
    document.getElementById('timeNow').textContent = m + ':' + String(s).padStart(2, '0');
    if (progress >= 100) nextSong();
  }, 300);
}

function seekTo(e) {
  const rect = e.currentTarget.getBoundingClientRect();
  progress = Math.max(0, Math.min(100, (e.clientX - rect.left) / rect.width * 100));
  document.getElementById('progressFill').style.width = progress + '%';
}

function prevSong() { playSong((currentIdx - 1 + SONGS.length) % SONGS.length); }
function nextSong() { playSong((currentIdx + 1) % SONGS.length); }

function addToQueue() {}

function setVolume(e) {
  const rect = e.currentTarget.getBoundingClientRect();
  const pct = Math.max(0, Math.min(100, (e.clientX - rect.left) / rect.width * 100));
  document.getElementById('volFill').style.width = pct + '%';
}

// ── MOOD ──

function pickTag(el, mood) {
  document.querySelectorAll('.mood-tag').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  localStorage.setItem('musix-mood', mood);
  fetchSuggestedSongs(mood);
}

function activeMoodName() {
  const active = document.querySelector('.mood-tag.active');
  return active ? active.textContent.trim().replace(/^\S+\s*/, '') : 'Happy';
}

function showSkeletonSongs(count = 8) {
  const list = document.getElementById('songList');
  if (!list) return;
  list.innerHTML = Array.from({ length: count }, (_, i) => `
    <div class="skeleton-row" style="animation-delay:${i * 0.06}s">
      <div class="skeleton skel-thumb"></div>
      <div class="skel-info">
        <div class="skeleton skel-title" style="width:${50 + Math.random() * 30}%"></div>
        <div class="skeleton skel-sub" style="width:${30 + Math.random() * 20}%"></div>
      </div>
      <div class="skeleton skel-dur"></div>
    </div>`).join('');
}

async function fetchSuggestedSongs(mood = activeMoodName()) {
  showSkeletonSongs();
  try {
    const params = new URLSearchParams({ mood });
    const response = await fetch(`/api/songs/mood?${params}`);
    if (!response.ok) throw new Error('Song API unavailable');
    const data = await response.json();
    if (!Array.isArray(data.songs) || !data.songs.length) return;
    SONGS = data.songs.map(song => ({ ...song }));
    currentIdx = 0;
    searchTerm = '';
    showAllSongs = false;
    renderSongs();
    playSong(0);
  } catch (error) {
    if (!SONGS.length) SONGS = FALLBACK_SONGS.map(song => ({ ...song }));
    renderSongs();
  }
}

async function fetchSongsFromApi(query, mood = activeMoodName()) {
  if (!query.trim()) return fetchSuggestedSongs(mood);
  showSkeletonSongs();
  try {
    const params = new URLSearchParams({ q: query, mood });
    const response = await fetch(`/api/songs/search?${params}`);
    if (!response.ok) throw new Error('Search unavailable');
    const data = await response.json();
    if (!Array.isArray(data.songs) || !data.songs.length) return;
    SONGS = data.songs.map(song => ({ ...song }));
    currentIdx = 0;
    searchTerm = '';
    showAllSongs = false;
    renderSongs();
    playSong(0);
  } catch (error) {
    if (!SONGS.length) SONGS = FALLBACK_SONGS.map(song => ({ ...song }));
    renderSongs();
  }
}

// ── PLAYLIST API ──

async function fetchPlaylists() {
  try {
    const res = await fetch('/api/songs/playlists');
    if (res.ok) {
      const data = await res.json();
      playlists = data.playlists || [];
      addedSongNames = new Set(playlists.flatMap(pl => pl.songs.map(s => s.name)));
      renderSongs();
      renderDashboardActivity();
    }
  } catch (e) {}
}

async function createPlaylist() {
  const input = document.getElementById('plNameInput');
  const name = input.value.trim();
  if (!name) return;
  try {
    const res = await fetch('/api/songs/playlists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name })
    });
    if (res.ok) {
      const data = await res.json();
      playlists.push(data.playlist);
      input.value = '';
      document.getElementById('plCreateForm').classList.add('hidden');
      renderPlaylists();
      renderDashboardActivity();
    } else {
      const data = await res.json().catch(() => ({}));
      alert(data.error || `Failed to create playlist (${res.status})`);
    }
  } catch (e) {
    console.error('createPlaylist error:', e);
    alert('Could not reach the server. Are you logged in?');
  }
}

async function addSongToPlaylist(playlistId) {
  const songIdx = pickerTargetIdx;
  const song = songIdx !== null ? SONGS[songIdx] : SONGS[currentIdx];
  if (!song) return;
  hidePlaylistPicker();
  try {
    const res = await fetch(`/api/songs/playlists/${playlistId}/add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ song: { name: song.name, artist: song.artist, album: song.album, dur: song.dur, emoji: song.emoji } })
    });
    if (res.ok) {
      const data = await res.json();
      const idx = playlists.findIndex(p => p._id === playlistId);
      if (idx !== -1) playlists[idx] = data.playlist;
      addedSongNames.add(song.name);
      if (songIdx !== null) {
        const btn = document.querySelector(`#song-${songIdx} .add-pl-btn`);
        if (btn) setAddPlBtnAdded(btn);
      }
      renderPlaylists();
      renderDashboardActivity();
    }
  } catch (e) {}
}

function setAddPlBtnAdded(btn) {
  btn.classList.add('added');
  btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`;
  btn.classList.add('pop');
  btn.addEventListener('animationend', () => btn.classList.remove('pop'), { once: true });
}

async function removeSongFromPlaylist(playlistId, songIdx) {
  try {
    const res = await fetch(`/api/songs/playlists/${playlistId}/songs/${songIdx}`, { method: 'DELETE' });
    if (res.ok) {
      const data = await res.json();
      const idx = playlists.findIndex(p => p._id === playlistId);
      if (idx !== -1) playlists[idx] = data.playlist;
      renderPlaylists();
    }
  } catch (e) {}
}

async function deletePlaylist(id) {
  try {
    const res = await fetch(`/api/songs/playlists/${id}`, { method: 'DELETE' });
    if (res.ok) {
      playlists = playlists.filter(p => p._id !== id);
      renderPlaylists();
      renderDashboardActivity();
    }
  } catch (e) {}
}

// ── PLAYLIST RENDER ──

function renderPlaylists() {
  const container = document.getElementById('playlistsContainer');
  if (!container) return;
  if (!playlists.length) {
    container.innerHTML = '<div class="pl-empty">No playlists yet</div>';
    return;
  }
  container.innerHTML = playlists.map(pl => `
    <div class="pl-item" id="pl-${pl._id}">
      <div class="pl-item-hd" onclick="togglePlaylistExpand('${pl._id}')">
        <div class="pl-item-info">
          <span class="pl-item-name">${escHtml(pl.name)}</span>
          <span class="pl-item-count">${pl.songs.length} song${pl.songs.length !== 1 ? 's' : ''}</span>
        </div>
        <div class="pl-item-actions">
          <button class="pl-delete-btn" onclick="event.stopPropagation();deletePlaylist('${pl._id}')" title="Delete playlist">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>
          </button>
          <svg class="pl-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
      </div>
      <div class="pl-songs hidden" id="pl-songs-${pl._id}">
        ${pl.songs.length ? pl.songs.map((s, i) => `
          <div class="pl-song-row">
            <span class="pl-song-emoji">${s.emoji || '🎵'}</span>
            <div class="pl-song-info">
              <div class="pl-song-name">${escHtml(s.name)}</div>
              <div class="pl-song-artist">${escHtml(s.artist)}</div>
            </div>
            <button class="pl-song-remove" onclick="removeSongFromPlaylist('${pl._id}',${i})" title="Remove">×</button>
          </div>
        `).join('') : '<div class="pl-empty-songs">No songs yet — use + to add</div>'}
      </div>
    </div>
  `).join('');
}

function togglePlaylistExpand(id) {
  const songsEl = document.getElementById(`pl-songs-${id}`);
  const item = document.getElementById(`pl-${id}`);
  if (!songsEl) return;
  songsEl.classList.toggle('hidden');
  item.classList.toggle('expanded');
}

function toggleNewPlaylistForm() {
  const form = document.getElementById('plCreateForm');
  form.classList.toggle('hidden');
  if (!form.classList.contains('hidden')) document.getElementById('plNameInput').focus();
}

function escHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── PLAYLIST PICKER DROPDOWN ──

function showPlaylistPicker(e, idx) {
  e.stopPropagation();
  pickerTargetIdx = idx;
  renderPickerAt(e.currentTarget);
}

function showNpPlaylistPicker(e) {
  e.stopPropagation();
  pickerTargetIdx = null;
  renderPickerAt(e.currentTarget);
}

function renderPickerAt(btn) {
  let picker = document.getElementById('playlistPicker');
  if (!picker) {
    picker = document.createElement('div');
    picker.id = 'playlistPicker';
    picker.className = 'pl-picker';
    document.body.appendChild(picker);
  }

  if (!playlists.length) {
    picker.innerHTML = `<div class="pl-picker-empty">No playlists yet.<br>Open your profile to create one.</div>`;
  } else {
    picker.innerHTML = playlists.map(pl => `
      <div class="pl-picker-item" onclick="addSongToPlaylist('${pl._id}')">
        <span>${escHtml(pl.name)}</span>
        <span class="pl-picker-count">${pl.songs.length}</span>
      </div>
    `).join('');
  }

  const rect = btn.getBoundingClientRect();
  picker.style.display = 'block';
  picker.style.top = (rect.bottom + 6) + 'px';
  picker.style.left = Math.min(rect.left, window.innerWidth - 210) + 'px';

  setTimeout(() => document.addEventListener('click', hidePlaylistPicker, { once: true }), 0);
}

function hidePlaylistPicker() {
  const picker = document.getElementById('playlistPicker');
  if (picker) picker.style.display = 'none';
  pickerTargetIdx = null;
}

// ── MOOD MODAL ──

function openModal() {
  document.getElementById('modalOverlay').classList.add('open');
  setMoodCameraMessage('Allow camera access so AI can read your expression');
  startMoodCamera();
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('open');
  stopMoodCamera();
}

function closeModalOutside(e) {
  if (e.target === document.getElementById('modalOverlay')) closeModal();
}

function setMoodCameraMessage(message) {
  const sub = document.querySelector('#modalOverlay .modal-sub');
  if (sub) sub.textContent = message;
}

function cameraErrorMessage(error) {
  if (!navigator.mediaDevices?.getUserMedia) {
    return 'Camera is not available here. Open the app on http://localhost:3000';
  }
  if (!window.isSecureContext) {
    return 'Camera needs a secure page. Open the app on http://localhost:3000';
  }
  if (error?.name === 'NotAllowedError') return 'Camera permission was blocked. Allow camera access in your browser.';
  if (error?.name === 'NotFoundError') return 'No camera was found on this device.';
  if (error?.name === 'NotReadableError') return 'Camera is busy in another app. Close it and try again.';
  return 'Could not open the camera. Check browser permissions and try again.';
}

async function startMoodCamera() {
  const video = document.getElementById('moodCamera');
  if (!video || cameraStream) return;
  if (!navigator.mediaDevices?.getUserMedia || !window.isSecureContext) {
    const message = cameraErrorMessage();
    setMoodCameraMessage(message);
    showToast(message);
    return;
  }
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
    video.srcObject = cameraStream;
    await video.play().catch(() => {});
    document.getElementById('modalScanArea')?.classList.add('camera-ready');
    setMoodCameraMessage('Camera ready. Look at the frame and start mood scan.');
  } catch (error) {
    cameraStream = null;
    const message = cameraErrorMessage(error);
    document.getElementById('modalScanArea')?.classList.remove('camera-ready');
    setMoodCameraMessage(message);
    showToast(message);
  }
}

function stopMoodCamera() {
  if (!cameraStream) return;
  cameraStream.getTracks().forEach(track => track.stop());
  cameraStream = null;
  const video = document.getElementById('moodCamera');
  if (video) video.srcObject = null;
  document.getElementById('modalScanArea')?.classList.remove('camera-ready');
}

function captureMoodFrame() {
  const video = document.getElementById('moodCamera');
  const canvas = document.getElementById('moodCanvas');
  if (!video || !canvas || !video.videoWidth) return null;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.82);
}

function pickModalMood(btn, emoji, name) {
  document.querySelectorAll('.modal-mood-btn').forEach(b => b.classList.remove('picked'));
  btn.classList.add('picked');
  selectedModalMood = { emoji, name };
  document.getElementById('mface').textContent = emoji;
}

async function runScan() {
  const btn = document.querySelector('.modal-scan-btn');
  btn.textContent = '⏳ Scanning…';
  btn.style.opacity = '0.7';

  let detectedMood = selectedModalMood;
  const image = captureMoodFrame();
  if (!image) setMoodCameraMessage('No camera frame yet. Allow access, wait for preview, then scan again.');

  if (image) {
    try {
      const response = await fetch('/api/mood/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image })
      });
      if (response.ok) {
        const data = await response.json();
        detectedMood = { name: data.mood || 'Chill', emoji: moodEmoji[data.mood] || '😌' };
      }
    } catch (error) {}
  }

  if (!detectedMood) {
    const moods = [
      { emoji: '😊', name: 'Happy' }, { emoji: '😢', name: 'Sad' },
      { emoji: '😌', name: 'Chill' }, { emoji: '🌙', name: 'Melancholic' }
    ];
    detectedMood = moods[Math.floor(Math.random() * moods.length)];
  }

  selectedModalMood = detectedMood;
  closeModal();
  btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg> Start Mood Scan`;
  btn.style.opacity = '1';

  document.getElementById('moodResultName').textContent = detectedMood.name;
  document.getElementById('moodResult').classList.add('show');
  document.querySelector('.scan-face span').textContent = detectedMood.emoji;
  document.getElementById('mface').textContent = detectedMood.emoji;

  document.querySelectorAll('.mood-tag').forEach(t => {
    t.classList.remove('active');
    if (t.textContent.includes(detectedMood.name)) t.classList.add('active');
  });

  localStorage.setItem('musix-mood', detectedMood.name);
  await fetchSuggestedSongs(detectedMood.name);
  updateDashboardIfOpen();
}

// ── PROFILE / AUTH ──

async function getSessionUser() {
  try {
    const response = await fetch('/auth/me', { credentials: 'include' });
    if (!response.ok) return null;
    const data = await response.json();
    return data.user || null;
  } catch (error) {
    return null;
  }
}

function loginWithGoogle() {
  window.location.href = '/auth/google';
}

async function openProfileModal() {
  profileUser = await getSessionUser();
  if (profileUser) showDashboard();
  else showAuth();
  document.getElementById('profileOverlay').classList.add('open');
}

function closeProfileModal() {
  document.getElementById('profileOverlay').classList.remove('open');
}

function closeProfileOutside(e) {
  if (e.target === document.getElementById('profileOverlay')) closeProfileModal();
}

function showAuth() {
  document.getElementById('authView').classList.remove('hidden');
  document.getElementById('dashboardView').classList.add('hidden');
  document.getElementById('authTitle').textContent = 'Login or Sign Up';
  document.getElementById('authSub').textContent = 'Use Google to continue to your MusicX dashboard';
}

function showDashboard() {
  if (!profileUser) { showAuth(); return; }
  document.getElementById('authView').classList.add('hidden');
  document.getElementById('dashboardView').classList.remove('hidden');
  document.getElementById('profileName').textContent = profileUser.name || 'Listener';
  document.getElementById('profileEmail').textContent = profileUser.email || 'listener@musicx.app';
  updateAvatarDisplay();
  renderPlaylists();
  renderRecentlyPlayed();
  renderDashboardActivity();
  updateDashboardIfOpen();
  updateModeUI(document.documentElement.classList.contains('light'));
}

function updateAvatarDisplay() {
  const avatarEl = document.getElementById('profileAvatar');
  const triggerEl = document.getElementById('profileTrigger');
  const initial = (profileUser?.name || profileUser?.email || 'S').charAt(0).toUpperCase();
  if (profileUser?.avatar) {
    avatarEl.innerHTML = `<img src="${profileUser.avatar}" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;display:block;">`;
    triggerEl.innerHTML = `<img src="${profileUser.avatar}" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;display:block;">`;
  } else {
    avatarEl.textContent = initial;
    triggerEl.textContent = initial;
  }
}

function openAvatarPicker() {
  document.getElementById('avatarInput').click();
}

function handleAvatarChange(input) {
  const file = input.files[0];
  if (!file) return;
  input.value = '';
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const SIZE = 200;
      canvas.width = SIZE;
      canvas.height = SIZE;
      const ctx = canvas.getContext('2d');
      const min = Math.min(img.width, img.height);
      const sx = (img.width - min) / 2;
      const sy = (img.height - min) / 2;
      ctx.drawImage(img, sx, sy, min, min, 0, 0, SIZE, SIZE);
      uploadAvatar(canvas.toDataURL('image/jpeg', 0.82));
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

async function uploadAvatar(base64) {
  try {
    const res = await fetch('/auth/avatar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ avatar: base64 })
    });
    if (res.ok) {
      profileUser.avatar = base64;
      updateAvatarDisplay();
      showToast('Profile photo updated!');
    } else {
      showToast('Failed to save photo');
    }
  } catch (e) {
    showToast('Could not upload photo');
  }
}

function updateDashboardIfOpen() {
  if (!document.getElementById('profileOverlay')?.classList.contains('open')) return;
  if (document.getElementById('dashboardView')?.classList.contains('hidden')) return;
  const nowPlayingEl = document.getElementById('profileNowPlaying');
  const nowArtistEl = document.getElementById('profileNowArtist');
  const moodEl = document.getElementById('currentMoodStat');
  if (nowPlayingEl) nowPlayingEl.textContent = SONGS[currentIdx]?.name || 'No song';
  if (nowArtistEl) nowArtistEl.textContent = SONGS[currentIdx]?.artist || '';
  if (moodEl) moodEl.textContent = activeMoodName();
  renderDashboardActivity();
  renderRecentlyPlayed();
}

function trackRecentlyPlayed(song) {
  const MAX = 10;
  let recent = JSON.parse(localStorage.getItem('musix-recent') || '[]');
  recent = recent.filter(s => s.name !== song.name);
  recent.unshift({ name: song.name, artist: song.artist, artworkUrl: song.artworkUrl, emoji: song.emoji });
  if (recent.length > MAX) recent = recent.slice(0, MAX);
  localStorage.setItem('musix-recent', JSON.stringify(recent));
}

function renderRecentlyPlayed() {
  const container = document.getElementById('rpContainer');
  if (!container) return;
  const recent = JSON.parse(localStorage.getItem('musix-recent') || '[]');
  if (!recent.length) {
    container.innerHTML = '<div class="rp-empty">Play some songs to see them here</div>';
    return;
  }
  container.innerHTML = recent.slice(0, 6).map(s => `
    <div class="rp-item">
      <div class="rp-thumb">${s.artworkUrl ? `<img src="${s.artworkUrl}" alt="" onerror="this.style.display='none'">` : (s.emoji || '🎵')}</div>
      <div class="rp-info">
        <div class="rp-name">${escHtml(s.name)}</div>
        <div class="rp-artist">${escHtml(s.artist)}</div>
      </div>
    </div>
  `).join('');
}

function clearRecentlyPlayed() {
  localStorage.removeItem('musix-recent');
  renderRecentlyPlayed();
}

function renderDashboardActivity() {
  const plays = parseInt(localStorage.getItem('musix-plays') || '0');
  const playsEl = document.getElementById('statPlaysCount');
  const plEl = document.getElementById('statPlaylistsCount');
  const savedEl = document.getElementById('statSavedTracks');
  if (playsEl) playsEl.textContent = plays;
  if (plEl) plEl.textContent = playlists.length;
  if (savedEl) savedEl.textContent = addedSongNames.size;
}

async function logoutProfile() {
  try { await fetch('/auth/logout', { method: 'POST', credentials: 'include' }); }
  catch (error) {}
  profileUser = null;
  playlists = [];
  addedSongNames = new Set();
  renderSongs();
  document.getElementById('profileTrigger').textContent = 'S';
  showAuth();
}

function submitAuth(e) {
  e.preventDefault();
  loginWithGoogle();
}

function toggleAuthMode() {
  loginWithGoogle();
}

async function initProfile() {
  profileUser = await getSessionUser();
  if (profileUser) {
    updateAvatarDisplay();
    await fetchPlaylists();
  }
}

// ── SETTINGS ──

function toggleSettings() {
  document.getElementById('settingsPanel').classList.toggle('open');
  document.getElementById('settingsStat').classList.toggle('active');
}

function toggleSub(id, itemEl) {
  document.getElementById(id).classList.toggle('open');
  itemEl.classList.toggle('open');
}

function toggleDarkMode() {
  const isLight = document.documentElement.classList.toggle('light');
  localStorage.setItem('musix-theme', isLight ? 'light' : 'dark');
  updateModeUI(isLight);
}

function updateModeUI(isLight) {
  const toggle = document.getElementById('modeToggle');
  const label = document.getElementById('modeLabel');
  const icon = document.getElementById('modeIcon');
  if (toggle) toggle.classList.toggle('active', isLight);
  if (label) label.textContent = isLight ? 'Dark Mode' : 'Light Mode';
  if (icon) {
    icon.innerHTML = isLight
      ? '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>'
      : '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>';
  }
}

// Apply saved theme immediately to avoid flash
(function () {
  if (localStorage.getItem('musix-theme') === 'light') {
    document.documentElement.classList.add('light');
    // updateModeUI runs after DOM is ready via initProfile → showDashboard
  }
})();

// ── SHARE ──

function shareSong() {
  const song = SONGS[currentIdx];
  if (!song) return;
  const url = song.sourceUrl || song.previewUrl;
  const title = `${song.name} — ${song.artist}`;

  if (navigator.share && url) {
    navigator.share({ title, text: `Listen to ${title}`, url }).catch(() => {});
  } else if (url) {
    navigator.clipboard.writeText(url)
      .then(() => showToast('Link copied to clipboard!'))
      .catch(() => showToast('Could not copy link'));
  } else {
    showToast('No link available for this song');
  }
}

function showToast(msg) {
  let toast = document.getElementById('shareToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'shareToast';
    toast.className = 'share-toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('show'), 2500);
}

// ── SEARCH ──

const searchInput = document.getElementById('searchInput');
searchInput.addEventListener('input', (e) => {
  searchTerm = e.target.value.trim().toLowerCase();
  renderSongs();
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    if (e.target.value.trim()) fetchSongsFromApi(e.target.value.trim(), activeMoodName());
  }, 500);
});

// Restore last selected mood
const savedMood = localStorage.getItem('musix-mood');
if (savedMood) {
  document.querySelectorAll('.mood-tag').forEach(t => {
    const name = t.textContent.trim().replace(/^\S+\s*/, '');
    t.classList.toggle('active', name === savedMood);
  });
}

renderSongs();
playSong(0);
fetchSuggestedSongs(savedMood || activeMoodName());
initProfile();

// ══════════════════════════════════════
//  PREMIUM UI ENHANCEMENTS
// ══════════════════════════════════════

// ── Ripple effect ──
function spawnRipple(e) {
  const btn = e.currentTarget;
  const rect = btn.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height) * 2;
  const r = document.createElement('span');
  r.className = 'ripple';
  r.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - rect.left - size / 2}px;top:${e.clientY - rect.top - size / 2}px`;
  btn.appendChild(r);
  r.addEventListener('animationend', () => r.remove());
}
document.querySelectorAll(
  '.ctrl-play,.ctrl-btn,.scan-btn,.modal-scan-btn,.np-action-btn,.header-btn,.see-all,.mood-tag,.pl-new-btn,.pl-create-submit,.google-auth-btn,.auth-submit'
).forEach(el => {
  el.style.position = 'relative';
  el.style.overflow = 'hidden';
  el.addEventListener('click', spawnRipple);
});

// ── Sticky header shadow on scroll ──
const _header = document.querySelector('.header');
window.addEventListener('scroll', () => {
  _header && _header.classList.toggle('scrolled', window.scrollY > 10);
}, { passive: true });

// ── Intersection Observer — fade-in sections ──
const _io = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('io-visible'); _io.unobserve(e.target); }
  });
}, { threshold: 0.1 });
document.querySelectorAll('.mood-scan-card, .anim').forEach(el => {
  el.classList.add('io-watch');
  _io.observe(el);
});

// ── Progress bar hover expand ──
const _pbWrap = document.querySelector('.progress-bar-wrap');
if (_pbWrap) {
  _pbWrap.addEventListener('mouseenter', () => _pbWrap.classList.add('expanded'));
  _pbWrap.addEventListener('mouseleave', () => _pbWrap.classList.remove('expanded'));
}

// ── Volume bar hover expand ──
const _volWrap = document.querySelector('.vol-bar-wrap');
if (_volWrap) {
  _volWrap.addEventListener('mouseenter', () => _volWrap.classList.add('expanded'));
  _volWrap.addEventListener('mouseleave', () => _volWrap.classList.remove('expanded'));
}

// ── Song item hover: show artwork border glow ──
document.getElementById('songList').addEventListener('mouseover', e => {
  const item = e.target.closest('.song-item');
  if (item) item.classList.add('hovered');
});
document.getElementById('songList').addEventListener('mouseout', e => {
  const item = e.target.closest('.song-item');
  if (item) item.classList.remove('hovered');
});
