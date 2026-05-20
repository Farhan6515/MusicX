let profileUser = null;
let playlists = [];
let addedSongNames = new Set(JSON.parse(localStorage.getItem('musix-added') || '[]'));

function escHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[ch]));
}

async function getSessionUser() {
  try {
    const response = await fetch('/auth/me', { credentials: 'include' });
    if (!response.ok) return null;
    const data = await response.json();
    return data.user || null;
  } catch {
    return null;
  }
}

function loginWithGoogle() {
  window.location.href = 'login.html?redirect=profile.html';
}

function showAuth() {
  document.getElementById('authView').classList.remove('hidden');
  document.getElementById('dashboardView').classList.add('hidden');
}

function showDashboard() {
  document.getElementById('authView').classList.add('hidden');
  document.getElementById('dashboardView').classList.remove('hidden');
  document.getElementById('profileName').textContent = profileUser?.name || 'Listener';
  document.getElementById('profileEmail').textContent = profileUser?.email || 'listener@musicx.app';
  updateAvatarDisplay();
  renderDashboardActivity();
  renderRecentlyPlayed();
}

function updateAvatarDisplay() {
  const avatarEl = document.getElementById('profileAvatar');
  const initial = (profileUser?.name || profileUser?.email || 'S').charAt(0).toUpperCase();
  if (profileUser?.avatar) {
    avatarEl.innerHTML = `<img src="${profileUser.avatar}" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;display:block;">`;
  } else {
    avatarEl.textContent = initial;
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
  reader.onload = event => uploadAvatar(event.target.result);
  reader.readAsDataURL(file);
}

async function uploadAvatar(avatar) {
  try {
    const response = await fetch('/auth/avatar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ avatar })
    });
    if (response.ok) {
      profileUser.avatar = avatar;
      updateAvatarDisplay();
    }
  } catch {}
}

async function fetchPlaylists() {
  try {
    const response = await fetch('/api/songs/playlists', { credentials: 'include' });
    if (!response.ok) return;
    const data = await response.json();
    playlists = data.playlists || [];
  } catch {
    playlists = [];
  }
}

function renderRecentlyPlayed() {
  const container = document.getElementById('rpContainer');
  const recent = JSON.parse(localStorage.getItem('musix-recent') || '[]');
  if (!recent.length) {
    container.innerHTML = '<div class="rp-empty">Play some songs to see them here</div>';
    return;
  }
  container.innerHTML = recent.slice(0, 6).map(song => `
    <div class="rp-item">
      <div class="rp-thumb">${song.artworkUrl ? `<img src="${song.artworkUrl}" alt="">` : escHtml(song.emoji || '🎵')}</div>
      <div class="rp-info">
        <div class="rp-name">${escHtml(song.name)}</div>
        <div class="rp-artist">${escHtml(song.artist)}</div>
      </div>
    </div>
  `).join('');
}

function clearRecentlyPlayed() {
  localStorage.removeItem('musix-recent');
  renderRecentlyPlayed();
}

function renderDashboardActivity() {
  document.getElementById('statPlaysCount').textContent = localStorage.getItem('musix-plays') || '0';
  document.getElementById('statPlaylistsCount').textContent = playlists.length;
  document.getElementById('statSavedTracks').textContent = addedSongNames.size;
  document.getElementById('currentMoodStat').textContent = localStorage.getItem('musix-mood') || 'Happy';
}

async function logoutProfile() {
  try { await fetch('/auth/logout', { method: 'POST', credentials: 'include' }); } catch {}
  profileUser = null;
  playlists = [];
  showAuth();
}

function toggleSettings() {
  document.getElementById('settingsPanel').classList.toggle('open');
  document.getElementById('settingsStat').classList.toggle('active');
}

function toggleSub(id, item) {
  document.getElementById(id).classList.toggle('open');
  item.classList.toggle('open');
}

function updateModeUI(isLight) {
  document.getElementById('modeToggle')?.classList.toggle('active', isLight);
  const label = document.getElementById('modeLabel');
  if (label) label.textContent = isLight ? 'Dark Mode' : 'Light Mode';
}

function toggleDarkMode() {
  const isLight = document.documentElement.classList.toggle('light');
  localStorage.setItem('musix-theme', isLight ? 'light' : 'dark');
  updateModeUI(isLight);
}

async function initProfilePage() {
  if (localStorage.getItem('musix-theme') === 'light') document.documentElement.classList.add('light');
  updateModeUI(document.documentElement.classList.contains('light'));
  profileUser = await getSessionUser();
  if (!profileUser) {
    showAuth();
    return;
  }
  await fetchPlaylists();
  showDashboard();
}

initProfilePage();
