/* VENTUREGATE PRODUCTIONS — CINEMA PLAYER
   Custom cinematic player with Mux HLS support.
*/

const starterFilms = [
  {id:'vg-001',title:'The Last Light',category:'Short Film',year:'2026',runtime:'14 min',description:'A quiet, atmospheric story about the choices that stay with us long after the moment has passed.',poster:'',video:'',featured:true},
  {id:'vg-002',title:'Behind the Noise',category:'Documentary',year:'2026',runtime:'32 min',description:'An independent documentary exploring the people, places and stories that rarely make the headlines.',poster:'',video:'',featured:false},
  {id:'vg-003',title:'Craicademia',category:'Series',year:'2026',runtime:'6 episodes',description:'A Belfast-set comedy series following a house-share where every plan goes spectacularly sideways.',poster:'',video:'',featured:false},
  {id:'vg-004',title:'No Victim No Crime',category:'Comedy',year:'2026',runtime:'Coming soon',description:'A darkly comic independent production.',poster:'',video:'',featured:false},
  {id:'vg-005',title:'The Making Of',category:'Documentary',year:'2026',runtime:'18 min',description:'Step behind the scenes and meet the people bringing independent productions to life.',poster:'',video:'',featured:false},
  {id:'vg-006',title:'First Frame',category:'Short Film',year:'2026',runtime:'9 min',description:'A showcase slot for emerging filmmakers and original short-form storytelling.',poster:'',video:'',featured:false},
  {id:'vg-007',title:'After Hours',category:'Drama',year:'2026',runtime:'Coming soon',description:'A new independent drama.',poster:'',video:'',featured:false},
  {id:'vg-008',title:'Open Call',category:'Short Film',year:'2026',runtime:'Coming soon',description:'A home for new voices, fresh ideas and independent stories.',poster:'',video:'',featured:false}
];

let films = loadFilms();
let activeFilter = 'All';
let currentHls = null;
let hideControlsTimer = null;

const $ = s => document.querySelector(s);

function loadFilms() {
  try {
    const saved = localStorage.getItem('venturegate_films');
    return saved ? JSON.parse(saved) : starterFilms;
  } catch {
    return starterFilms;
  }
}

function saveFilms() {
  localStorage.setItem('venturegate_films', JSON.stringify(films));
}

function esc(v = '') {
  return String(v).replace(/[&<>"']/g, c => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
  }[c]));
}

function toast(msg) {
  const el = $('#toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(window.vgToastTimer);
  window.vgToastTimer = setTimeout(() => el.classList.remove('show'), 3000);
}

function renderFilms() {
  const query = ($('#searchInput')?.value || '').trim().toLowerCase();

  const list = films.filter(f =>
    (activeFilter === 'All' || f.category === activeFilter) &&
    (`${f.title} ${f.category} ${f.description}`).toLowerCase().includes(query)
  );

  $('#filmGrid').innerHTML = list.map(f => `
    <article class="film-card" data-id="${esc(f.id)}">
      <div class="poster">
        ${f.poster
          ? `<img src="${esc(f.poster)}" alt="${esc(f.title)} poster" onerror="this.remove()">`
          : `<div class="poster-fallback">${esc((f.title || 'V').slice(0,1))}</div>`}
        <span class="poster-tag">${esc((f.category || 'FILM').toUpperCase())}</span>
        <div class="play-overlay"><span>▶</span></div>
      </div>
      <div class="film-info">
        <h3>${esc(f.title)}</h3>
        <p>${esc(f.year || '2026')} <span>•</span> ${esc(f.runtime || 'Independent film')}</p>
      </div>
    </article>
  `).join('');

  $('#emptyState')?.classList.toggle('hidden', list.length > 0);

  document.querySelectorAll('.film-card').forEach(card => {
    card.addEventListener('click', () => openFilm(card.dataset.id));
  });
}

/* CINEMATIC PLAYER STYLING */

(function addCinemaStyles() {
  if (document.getElementById('vgCinemaStyles')) return;

  const style = document.createElement('style');
  style.id = 'vgCinemaStyles';

  style.textContent = `
    .player-card {
      width:min(1120px,96vw)!important;
      background:#080706!important;
      border:1px solid rgba(229,138,53,.35)!important;
      overflow:hidden;
    }

    .player-area {
      display:block!important;
      position:relative;
      width:100%;
      aspect-ratio:16/9;
      background:#000;
      overflow:hidden;
    }

    .vg-player {
      position:absolute;
      inset:0;
      background:#000;
      color:#fff;
      font-family:Arial,sans-serif;
      overflow:hidden;
      isolation:isolate;
    }

    .vg-player video {
      display:block;
      width:100%;
      height:100%;
      object-fit:contain;
      background:#000;
      outline:none;
    }

    .vg-player .vg-shade {
      position:absolute;
      inset:0;
      z-index:2;
      display:flex;
      flex-direction:column;
      justify-content:space-between;
      padding:22px 25px 18px;
      background:linear-gradient(
        180deg,
        rgba(0,0,0,.62),
        transparent 24%,
        transparent 60%,
        rgba(0,0,0,.78)
      );
      opacity:1;
      transition:opacity .35s;
      pointer-events:none;
    }

    .vg-player.vg-idle .vg-shade {
      opacity:0;
    }

    .vg-player .vg-topline {
      display:flex;
      justify-content:space-between;
      align-items:center;
      gap:12px;
    }

    .vg-player .vg-brand {
      font-size:10px;
      letter-spacing:3px;
      color:#ffbd70;
      font-weight:700;
      text-transform:uppercase;
    }

    .vg-player .vg-title {
      font-size:13px;
      color:#fff;
      text-shadow:0 1px 5px #000;
    }

    .vg-player .vg-bottom {
      pointer-events:auto;
    }

    .vg-player .vg-seek {
      width:100%;
      height:5px;
      display:block;
      appearance:none;
      border-radius:8px;
      outline:none;
      cursor:pointer;
      background:linear-gradient(
        to right,
        #e58a35 0%,
        #e58a35 var(--vg-progress,0%),
        rgba(255,255,255,.38) var(--vg-progress,0%),
        rgba(255,255,255,.38) 100%
      );
      margin:0 0 15px;
    }

    .vg-player .vg-seek::-webkit-slider-thumb {
      appearance:none;
      width:12px;
      height:12px;
      border-radius:50%;
      background:#ffbd70;
      box-shadow:0 0 10px #e58a35;
      opacity:0;
      transition:opacity .2s;
    }

    .vg-player:hover .vg-seek::-webkit-slider-thumb {
      opacity:1;
    }

    .vg-player .vg-controls {
      display:flex;
      align-items:center;
      gap:13px;
    }

    .vg-player button,
    .vg-player select {
      border:0;
      background:transparent;
      color:#fff;
      cursor:pointer;
    }

    .vg-player button {
      font-size:19px;
      padding:5px 7px;
      text-shadow:0 1px 5px #000;
    }

    .vg-player button:hover {
      color:#ffbd70;
    }

    .vg-player .vg-mainplay {
      width:38px;
      height:38px;
      border:1px solid #e58a35;
      border-radius:50%;
      color:#ffbd70;
      font-size:17px;
    }

    .vg-player .vg-time {
      font-size:11px;
      color:#eee;
      white-space:nowrap;
      font-variant-numeric:tabular-nums;
    }

    .vg-player .vg-spacer {
      flex:1;
    }

    .vg-player .vg-volume {
      width:78px;
      accent-color:#e58a35;
    }

    .vg-player .vg-speed {
      font-size:11px;
      background:#17100d;
      border:1px solid #9b5b31;
      border-radius:3px;
      padding:6px;
    }

    .vg-player .vg-centerplay {
      position:absolute;
      z-index:3;
      left:50%;
      top:50%;
      transform:translate(-50%,-50%);
      width:68px;
      height:68px;
      border:1px solid rgba(255,189,112,.8);
      border-radius:50%;
      background:rgba(10,7,5,.55);
      color:#ffbd70;
      font-size:25px;
      opacity:0;
      transition:opacity .2s;
      pointer-events:none;
    }

    .vg-player.vg-paused .vg-centerplay {
      opacity:1;
    }

    .vg-player .vg-loading {
      position:absolute;
      z-index:4;
      left:50%;
      top:50%;
      transform:translate(-50%,-50%);
      width:42px;
      height:42px;
      border:3px solid #ffffff30;
      border-top-color:#e58a35;
      border-radius:50%;
      animation:vgspin .8s linear infinite;
      display:none;
    }

    .vg-player.vg-waiting .vg-loading {
      display:block;
    }

    @keyframes vgspin {
      to {
        transform:translate(-50%,-50%) rotate(360deg);
      }
    }

    .vg-player .vg-error {
      position:absolute;
      z-index:5;
      inset:0;
      display:none;
      place-items:center;
      padding:25px;
      text-align:center;
      background:#080706;
      color:#ffbd70;
      font-size:13px;
    }

    .vg-player.vg-failed .vg-error {
      display:grid;
    }

    @media(max-width:650px) {
      .vg-player .vg-shade {padding:12px}
      .vg-player .vg-title {font-size:11px}
      .vg-player .vg-controls {gap:5px}
      .vg-player button {font-size:16px;padding:4px}
      .vg-player .vg-volume {width:48px}
      .vg-player .vg-time {font-size:9px}
      .vg-player .vg-mainplay {width:32px;height:32px}
    }
  `;

  document.head.appendChild(style);
})();

/* PLAYER MANAGEMENT */

function clearPlayer() {
  clearTimeout(hideControlsTimer);

  if (currentHls) {
    try {
      currentHls.destroy();
    } catch {}
    currentHls = null;
  }

  const oldVideo = $('#playerArea video');

  if (oldVideo) {
    try {
      oldVideo.pause();
      oldVideo.removeAttribute('src');
      oldVideo.load();
    } catch {}
  }
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';

  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60).toString().padStart(2,'0');

  return h
    ? `${h}:${String(m).padStart(2,'0')}:${s}`
    : `${m}:${s}`;
}

function loadHlsLibrary(callback) {
  if (window.Hls) {
    callback();
    return;
  }

  if (window.vgHlsLoading) {
    window.vgHlsLoading.push(callback);
    return;
  }

  window.vgHlsLoading = [callback];

  const script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/hls.js@1.5.18/dist/hls.min.js';

  script.onload = () => {
    const queue = window.vgHlsLoading || [];
    window.vgHlsLoading = null;
    queue.forEach(fn => fn());
  };

  script.onerror = () => {
    window.vgHlsLoading = null;
    toast('The streaming player could not load. Please refresh and try again.');
  };

  document.head.appendChild(script);
}

function buildCinemaPlayer(title, source) {
  clearPlayer();

  const area = $('#playerArea');

  area.innerHTML = `
    <div class="vg-player vg-paused" tabindex="0" aria-label="VentureGate cinema player">

      <video playsinline preload="metadata"></video>

      <button class="vg-centerplay" type="button" aria-label="Play">▶</button>

      <div class="vg-loading"></div>

      <div class="vg-error">
        This video could not be played. Please check the video link and try again.
      </div>

      <div class="vg-shade">

        <div class="vg-topline">
          <span class="vg-brand">VENTUREGATE CINEMA</span>
          <span class="vg-title">${esc(title)}</span>
        </div>

        <div class="vg-bottom">

          <input class="vg-seek" type="range" min="0" max="1000" value="0" aria-label="Seek video">

          <div class="vg-controls">

            <button class="vg-mainplay" type="button" aria-label="Play">▶</button>

            <button class="vg-back" type="button" aria-label="Back 10 seconds">↶10</button>

            <button class="vg-forward" type="button" aria-label="Forward 10 seconds">10↷</button>

            <span class="vg-time">0:00 / 0:00</span>

            <span class="vg-spacer"></span>

            <button class="vg-mute" type="button" aria-label="Mute">🔊</button>

            <input class="vg-volume" type="range" min="0" max="1" step="0.05" value="1" aria-label="Volume">

            <select class="vg-speed" aria-label="Playback speed">
              <option value="1">1×</option>
              <option value="1.25">1.25×</option>
              <option value="1.5">1.5×</option>
              <option value="1.75">1.75×</option>
              <option value="2">2×</option>
            </select>

            <button class="vg-full" type="button" aria-label="Fullscreen">⛶</button>

          </div>
        </div>
      </div>
    </div>
  `;

  const player = area.querySelector('.vg-player');
  const video = player.querySelector('video');
  const playBtn = player.querySelector('.vg-mainplay');
  const centerBtn = player.querySelector('.vg-centerplay');
  const seek = player.querySelector('.vg-seek');
  const time = player.querySelector('.vg-time');
  const volume = player.querySelector('.vg-volume');
  const mute = player.querySelector('.vg-mute');

  function updatePlay() {
    const paused = video.paused;

    player.classList.toggle('vg-paused', paused);

    playBtn.textContent = paused ? '▶' : 'Ⅱ';
    playBtn.setAttribute('aria-label', paused ? 'Play' : 'Pause');
  }

  function togglePlay() {
    if (video.paused) {
      video.play().catch(() => toast('Press play again to start the video.'));
    } else {
      video.pause();
    }
  }

  function showControls() {
    player.classList.remove('vg-idle');
    clearTimeout(hideControlsTimer);

    if (!video.paused) {
      hideControlsTimer = setTimeout(() => {
        player.classList.add('vg-idle');
      }, 2400);
    }
  }

  function updateProgress() {
    const duration = video.duration || 0;
    const current = video.currentTime || 0;
    const pct = duration ? (current / duration) * 100 : 0;

    seek.value = duration
      ? Math.round((current / duration) * 1000)
      : 0;

    seek.style.setProperty('--vg-progress', `${pct}%`);

    time.textContent = `${formatTime(current)} / ${formatTime(duration)}`;
  }

  playBtn.addEventListener('click', togglePlay);
  centerBtn.addEventListener('click', togglePlay);
  video.addEventListener('click', togglePlay);

  player.querySelector('.vg-back').addEventListener('click', () => {
    video.currentTime = Math.max(0, video.currentTime - 10);
  });

  player.querySelector('.vg-forward').addEventListener('click', () => {
    video.currentTime = Math.min(video.duration || Infinity, video.currentTime + 10);
  });

  seek.addEventListener('input', () => {
    if (video.duration) {
      video.currentTime = (Number(seek.value) / 1000) * video.duration;
    }
  });

  volume.addEventListener('input', () => {
    video.volume = Number(volume.value);
    video.muted = video.volume === 0;
    mute.textContent = video.muted ? '🔇' : '🔊';
  });

  mute.addEventListener('click', () => {
    video.muted = !video.muted;
    mute.textContent = video.muted ? '🔇' : '🔊';
  });

  player.querySelector('.vg-speed').addEventListener('change', e => {
    video.playbackRate = Number(e.target.value);
  });

  player.querySelector('.vg-full').addEventListener('click', () => {
    if (document.fullscreenElement) {
      document.exitFullscreen?.();
    } else {
      player.requestFullscreen?.();
    }
  });

  player.addEventListener('mousemove', showControls);
  player.addEventListener('touchstart', showControls, {passive:true});

  player.addEventListener('mouseleave', () => {
    if (!video.paused) {
      player.classList.add('vg-idle');
    }
  });

  player.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

    if (e.code === 'Space') {
      e.preventDefault();
      togglePlay();
    }

    if (e.code === 'ArrowLeft') {
      video.currentTime = Math.max(0, video.currentTime - 10);
    }

    if (e.code === 'ArrowRight') {
      video.currentTime = Math.min(video.duration || Infinity, video.currentTime + 10);
    }

    showControls();
  });

  video.addEventListener('play', updatePlay);

  video.addEventListener('pause', () => {
    updatePlay();
    player.classList.remove('vg-idle');
  });

  video.addEventListener('timeupdate', updateProgress);
  video.addEventListener('loadedmetadata', updateProgress);

  video.addEventListener('waiting', () => {
    player.classList.add('vg-waiting');
  });

  video.addEventListener('playing', () => {
    player.classList.remove('vg-waiting');
  });

  video.addEventListener('canplay', () => {
    player.classList.remove('vg-waiting');
  });

  video.addEventListener('error', () => {
    player.classList.add('vg-failed');
  });

  const isHls = /\.m3u8($|\?)/i.test(source) || /stream\.mux\.com/i.test(source);

  if (isHls && video.canPlayType('application/vnd.apple.mpegurl')) {

    // Safari supports HLS natively.
    video.src = source;
    video.play().catch(() => {});

  } else if (isHls) {

    // Chrome and Edge use hls.js.
    loadHlsLibrary(() => {

      if (!window.Hls || !window.Hls.isSupported()) {
        player.classList.add('vg-failed');
        return;
      }

      currentHls = new window.Hls({
        enableWorker:true
      });

      currentHls.loadSource(source);
      currentHls.attachMedia(video);

      currentHls.on(window.Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(() => {});
      });

      currentHls.on(window.Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          if (data.type === window.Hls.ErrorTypes.NETWORK_ERROR) {
            currentHls.startLoad();
          } else if (data.type === window.Hls.ErrorTypes.MEDIA_ERROR) {
            currentHls.recoverMediaError();
          } else {
            player.classList.add('vg-failed');
          }
        }
      });

    });

  } else {

    video.src = source;
    video.play().catch(() => {});

  }

  showControls();
}

/* FILM DETAILS AND MODALS */

function openFilm(id) {
  const f = films.find(x => x.id === id);

  if (!f) return;

  $('#modalCategory').textContent = (f.category || 'FILM').toUpperCase();
  $('#modalTitle').textContent = f.title;
  $('#modalDescription').textContent = f.description;
  $('#modalMeta').textContent = `${f.year || ''} • ${f.runtime || 'Independent film'}`;

  const area = $('#playerArea');
  area.innerHTML = '';

  if (f.video) {

    if (/youtube\.com|youtu\.be|vimeo\.com/i.test(f.video)) {

      let url = f.video;

      if (url.includes('watch?v=')) {
        url = url.replace('watch?v=', 'embed/');
      } else if (url.includes('youtu.be/')) {
        url = url.replace('youtu.be/', 'www.youtube.com/embed/');
      }

      area.innerHTML = `
        <iframe
          src="${esc(url)}"
          allow="autoplay; fullscreen; picture-in-picture"
          allowfullscreen
          title="${esc(f.title)}">
        </iframe>
      `;

    } else {

      buildCinemaPlayer(f.title, f.video);

    }

  } else {

    area.innerHTML = `
      <div class="player-placeholder">
        Your film player will appear here once a video URL is added in Studio.
      </div>
    `;

  }

  showModal('filmModal');
}

function showModal(id) {
  $('#' + id).classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function hideModal(id) {
  $('#' + id).classList.add('hidden');
  document.body.style.overflow = '';

  if (id === 'filmModal') {
    clearPlayer();
    $('#playerArea').innerHTML = '';
  }
}

/* CLOSE BUTTONS */

document.querySelectorAll('[data-close]').forEach(b => {
  b.addEventListener('click', () => hideModal(b.dataset.close));
});

document.querySelectorAll('.modal').forEach(m => {
  m.addEventListener('click', e => {
    if (e.target === m) hideModal(m.id);
  });
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal:not(.hidden)').forEach(m => {
      hideModal(m.id);
    });
  }
});

/* FILTERS AND SEARCH */

$('#filters').addEventListener('click', e => {
  const b = e.target.closest('[data-filter]');
  if (!b) return;

  activeFilter = b.dataset.filter;

  document.querySelectorAll('.filter').forEach(x => {
    x.classList.toggle('active', x === b);
  });

  renderFilms();
});

document.querySelectorAll('[data-filter-link]').forEach(a => {
  a.addEventListener('click', () => {
    activeFilter = a.dataset.filterLink;

    document.querySelectorAll('.filter').forEach(x => {
      x.classList.toggle('active', x.dataset.filter === activeFilter);
    });

    renderFilms();
  });
});

$('#searchInput').addEventListener('input', renderFilms);

$('#searchToggle').addEventListener('click', () => {
  $('#searchInput').focus();
  $('#films').scrollIntoView({behavior:'smooth'});
});

$('#viewAll').addEventListener('click', () => {
  activeFilter = 'All';
  $('#searchInput').value = '';

  document.querySelectorAll('.filter').forEach(x => {
    x.classList.toggle('active', x.dataset.filter === 'All');
  });

  renderFilms();
});

$('#heroPlay').addEventListener('click', () => {
  $('#films').scrollIntoView({behavior:'smooth'});
});

/* MEMBERSHIP */

$('#memberOpen').addEventListener('click', () => showModal('memberModal'));
$('#memberOpen2').addEventListener('click', () => showModal('memberModal'));

$('#checkoutBtn').addEventListener('click', () => {
  toast('Payment checkout is not connected yet. The free catalogue remains open to everyone.');
});

/* ADMIN PANEL */

$('#adminOpen').addEventListener('click', () => {
  renderAdmin();
  showModal('adminModal');
});

$('#filmForm').addEventListener('submit', e => {
  e.preventDefault();

  const d = new FormData(e.currentTarget);

  const f = {
    id:'vg-' + Date.now(),
    title:d.get('title').trim(),
    category:d.get('category'),
    year:d.get('year') || '2026',
    runtime:d.get('runtime') || 'Independent film',
    poster:d.get('poster'),
    video:d.get('video'),
    description:d.get('description').trim(),
    featured:d.get('featured') === 'on'
  };

  films.unshift(f);
  saveFilms();

  e.currentTarget.reset();

  renderFilms();
  renderAdmin();

  toast('Film added to this browser’s library.');
});

function renderAdmin() {
  $('#adminFilmList').innerHTML = films.map(f => `
    <div class="admin-row">
      <span>
        ${esc(f.title)}
        <small>· ${esc(f.category)}</small>
      </span>
      <button class="delete-btn" data-delete="${esc(f.id)}">REMOVE</button>
    </div>
  `).join('');

  document.querySelectorAll('[data-delete]').forEach(b => {
    b.addEventListener('click', () => {
      films = films.filter(f => f.id !== b.dataset.delete);

      saveFilms();
      renderFilms();
      renderAdmin();

      toast('Film removed.');
    });
  });
}

/* START WEBSITE */

renderFilms();
