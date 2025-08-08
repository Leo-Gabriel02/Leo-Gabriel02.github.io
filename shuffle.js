// ===== CONFIG =====
const clientId = '1IhKWSnFKpEn5FZgEnk5uO';
const redirectUri = window.location.origin + window.location.pathname; // must match Spotify App redirect URI
const scopes = ['playlist-read-public'];

// ===== PKCE Helpers =====
async function generateCodeVerifier(length) {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < length; i++) text += possible.charAt(Math.floor(Math.random() * possible.length));
  return text;
}

async function generateCodeChallenge(codeVerifier) {
  const data = new TextEncoder().encode(codeVerifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// ===== Auth Flow =====
document.getElementById('login-btn').addEventListener('click', async () => {
  const codeVerifier = await generateCodeVerifier(128);
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  localStorage.setItem('code_verifier', codeVerifier);

  const authUrl = `https://accounts.spotify.com/authorize?` +
    `client_id=${clientId}` +
    `&response_type=code` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&scope=${encodeURIComponent(scopes.join(' '))}` +
    `&code_challenge_method=S256` +
    `&code_challenge=${codeChallenge}`;

  window.location = authUrl;
});

// ===== Exchange Code for Token =====
async function getAccessToken(code) {
  const codeVerifier = localStorage.getItem('code_verifier');
  const body = new URLSearchParams({
    client_id: clientId,
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier
  });

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });

  return res.json();
}

// ===== Playlist Fetch & Shuffle =====
async function fetchAllTracks(playlistId, token) {
  let allTracks = [];
  let url = `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=100`;
  let total = null;
  let fetched = 0;

  while (url) {
    const res = await fetch(url, { headers: { 'Authorization': 'Bearer ' + token } });
    const data = await res.json();
    if (total === null) total = data.total;

    allTracks = allTracks.concat(data.items);
    fetched += data.items.length;
    updateProgress(fetched / total * 100);

    url = data.next;
  }

  return allTracks;
}

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function updateProgress(percent) {
  document.getElementById('progress-bar').style.width = percent + '%';
}

// ===== Show Results =====
function displayTracks(tracks) {
  const output = document.getElementById('output');
  output.innerHTML = '<h2>Shuffled Tracks</h2><ol>' +
    tracks.map(t => `<li>${t.track.name} — ${t.track.artists.map(a => a.name).join(', ')}</li>`).join('') +
    '</ol>';
}

// ===== On Load =====
window.onload = async () => {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  if (code) {
    const tokenData = await getAccessToken(code);
    localStorage.setItem('access_token', tokenData.access_token);
    window.history.replaceState({}, document.title, redirectUri);
    document.getElementById('shuffle-btn').disabled = false;
  }
};

document.getElementById('shuffle-btn').addEventListener('click', async () => {
  const playlistId = document.getElementById('playlist-id').value.trim();
  const token = localStorage.getItem('access_token');
  if (!playlistId || !token) return alert('Please enter a playlist ID and log in.');

  const tracks = await fetchAllTracks(playlistId, token);
  const shuffled = shuffleArray(tracks);
  displayTracks(shuffled);
});
