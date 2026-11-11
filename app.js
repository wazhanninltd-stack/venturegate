/* ============================================================
   VENTUREGATE PRODUCTIONS
   Centralised Supabase catalogue + secure admin + cinema player
   ============================================================ */

(() => {
  "use strict";

  const SUPABASE_CDN =
    "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js";

  const HLS_CDN =
    "https://cdn.jsdelivr.net/npm/hls.js@latest/dist/hls.min.js";

  let db = null;
  let currentUser = null;
  let isAdmin = false;
  let films = [];
  let categories = [];
  let hlsInstance = null;
  let currentVideo = null;

  const $ = (selector) => document.querySelector(selector);

  const wait = (ms) =>
    new Promise((resolve) => setTimeout(resolve, ms));

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const existing = [...document.scripts].find(
        (script) => script.src === src
      );

      if (existing) {
        if (existing.dataset.loaded === "true") {
          resolve();
          return;
        }

        existing.addEventListener("load", resolve, { once: true });
        existing.addEventListener("error", reject, { once: true });
        return;
      }

      const script = document.createElement("script");
      script.src = src;
      script.async = true;

      script.onload = () => {
        script.dataset.loaded = "true";
        resolve();
      };

      script.onerror = reject;

      document.head.appendChild(script);
    });
  }

  async function initialise() {
    try {
      await loadScript(
        "https://wazhanninltd-stack.github.io/venturegate/config.js"
      );

      if (
        !window.VENTUREGATE_SUPABASE_URL ||
        !window.VENTUREGATE_SUPABASE_KEY
      ) {
        throw new Error(
          "Supabase configuration could not be loaded."
        );
      }

      await loadScript(SUPABASE_CDN);

      if (!window.supabase?.createClient) {
        throw new Error("Supabase library failed to load.");
      }

      db = window.supabase.createClient(
        window.VENTUREGATE_SUPABASE_URL,
        window.VENTUREGATE_SUPABASE_KEY,
        {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true
          }
        }
      );

      await loadScript(HLS_CDN);

      installStyles();
      installAdminInterface();
      installPlayerInterface();

      const {
        data: { session }
      } = await db.auth.getSession();

      if (session?.user) {
        await checkAdmin(session.user);
      }

      db.auth.onAuthStateChange(async (event, session) => {
        if (event === "SIGNED_OUT" || !session?.user) {
          currentUser = null;
          isAdmin = false;
          updateAdminInterface();
        }

        if (event === "SIGNED_IN" && session?.user) {
          await checkAdmin(session.user);
        }
      });

      await loadCatalogue();

    } catch (error) {
      console.error("VentureGate initialisation:", error);

      showToast(
        "Website connection error. Please refresh the page."
      );
    }
  }

  /* ============================================================
     STYLES
     ============================================================ */

  function installStyles() {
    if ($("#vg-dynamic-styles")) return;

    const style = document.createElement("style");
    style.id = "vg-dynamic-styles";

    style.textContent = `
      .vg-login-box {
        padding: 20px;
        border: 1px solid rgba(255,255,255,.12);
        border-radius: 12px;
        margin-bottom: 20px;
        background: rgba(255,255,255,.025);
      }

      .vg-login-box input {
        width: 100%;
        box-sizing: border-box;
        padding: 13px;
        margin: 7px 0;
        background: #111;
        border: 1px solid #444;
        border-radius: 6px;
        color: white;
      }

      .vg-admin-status {
        padding: 12px;
        margin-bottom: 15px;
        border-radius: 7px;
        background: rgba(255,255,255,.06);
      }

      .vg-admin-status.success {
        border-left: 3px solid #e66b2e;
      }

      .vg-player {
        position: relative;
        width: 100%;
        background: #000;
        overflow: hidden;
        border-radius: 8px;
        aspect-ratio: 16 / 9;
      }

      .vg-player video {
        width: 100%;
        height: 100%;
        object-fit: contain;
        background: #000;
      }

      .vg-controls {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        padding: 18px;
        box-sizing: border-box;
        background: linear-gradient(
          to bottom,
          rgba(0,0,0,.55),
          transparent 25%,
          transparent 60%,
          rgba(0,0,0,.8)
        );
        opacity: 1;
        transition: opacity .35s ease;
        pointer-events: none;
      }

      .vg-player.vg-hidden-controls .vg-controls {
        opacity: 0;
      }

      .vg-controls button,
      .vg-controls input {
        pointer-events: auto;
      }

      .vg-control-top,
      .vg-control-bottom,
      .vg-control-centre {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }

      .vg-control-centre {
        justify-content: center;
      }

      .vg-controls button {
        background: rgba(20,20,20,.78);
        color: white;
        border: 1px solid rgba(255,255,255,.2);
        border-radius: 50%;
        width: 42px;
        height: 42px;
        cursor: pointer;
        font-size: 17px;
      }

      .vg-controls button:hover {
        background: #df682d;
      }

      .vg-play-main {
        width: 64px !important;
        height: 64px !important;
        font-size: 25px !important;
      }

      .vg-progress {
        width: 100%;
        accent-color: #ed7134;
        cursor: pointer;
      }

      .vg-time {
        color: white;
        font-size: 12px;
        white-space: nowrap;
      }

      .vg-volume {
        width: 75px;
        accent-color: #ed7134;
      }

      .vg-film-card {
        cursor: pointer;
        transition: transform .25s ease;
      }

      .vg-film-card:hover {
        transform: translateY(-5px);
      }

      .vg-film-poster {
        width: 100%;
        aspect-ratio: 2 / 3;
        object-fit: cover;
        background: #171717;
        display: block;
      }

      .vg-film-placeholder {
        aspect-ratio: 2 / 3;
        display: flex;
        align-items: center;
        justify-content: center;
        background: linear-gradient(145deg,#222,#090909);
        color: #df7138;
        font-size: 30px;
      }

      .vg-admin-actions {
        display: flex;
        gap: 8px;
        align-items: center;
      }

      .vg-delete-button {
        background: #842d2d;
        color: white;
        border: 0;
        border-radius: 5px;
        padding: 8px 12px;
        cursor: pointer;
      }

      .vg-muted {
        color: #aaa;
        font-size: 13px;
      }

      .vg-player-error {
        color: white;
        padding: 25px;
        text-align: center;
      }

      @media(max-width:600px) {
        .vg-controls {
          padding: 10px;
        }

        .vg-controls button {
          width: 36px;
          height: 36px;
        }

        .vg-volume {
          width: 50px;
        }
      }
    `;

    document.head.appendChild(style);
  }

  /* ============================================================
     NOTIFICATIONS
     ============================================================ */

  function showToast(message) {
    const toast = $("#toast");

    if (toast) {
      toast.textContent = message;
      toast.classList.add("show");

      clearTimeout(toast._vgTimer);

      toast._vgTimer = setTimeout(() => {
        toast.classList.remove("show");
      }, 3500);
    } else {
      console.log("VentureGate:", message);
    }
  }

  /* ============================================================
     CATALOGUE
     ============================================================ */

  async function loadCatalogue() {
    try {
      const [filmResult, categoryResult] = await Promise.all([
        db
          .from("films")
          .select("*")
          .eq("published", true)
          .order("created_at", { ascending: false }),

        db
          .from("categories")
          .select("*")
          .order("name")
      ]);

      if (filmResult.error) throw filmResult.error;
      if (categoryResult.error) throw categoryResult.error;

      films = filmResult.data || [];
      categories = categoryResult.data || [];

      renderFilms();
      renderFilters();
      renderAdminFilms();

      console.log(
        `VentureGate loaded ${films.length} published films.`
      );

    } catch (error) {
      console.error("Catalogue error:", error);

      showToast(
        "Could not load the film catalogue. Check your Supabase permissions."
      );
    }
  }

  function categoryName(categoryId) {
    const category = categories.find(
      (item) => String(item.id) === String(categoryId)
    );

    return category?.name || "Film";
  }

  function renderFilms() {
    const grid = $("#filmGrid");
    if (!grid) return;

    const search = ($("#searchInput")?.value || "")
      .trim()
      .toLowerCase();

    const activeFilter =
      document.querySelector("#filters .active")?.dataset.category ||
      document.querySelector("#filters [aria-pressed='true']")?.dataset.category ||
      "all";

    const filtered = films.filter((film) => {
      const matchesSearch =
        (film.title || "").toLowerCase().includes(search) ||
        (film.description || "").toLowerCase().includes(search);

      const matchesCategory =
        activeFilter === "all" ||
        categoryName(film.category_id).toLowerCase() ===
          activeFilter.toLowerCase();

      return matchesSearch && matchesCategory;
    });

    grid.innerHTML = "";

    filtered.forEach((film) => {
      const card = document.createElement("article");

      card.className = "vg-film-card film-card";

      const poster = film.poster_url
        ? `<img class="vg-film-poster" src="${escapeHTML(
            film.poster_url
          )}" alt="${escapeHTML(film.title)}" loading="lazy">`
        : `<div class="vg-film-placeholder">VG</div>`;

      card.innerHTML = `
        ${poster}
        <div class="film-card-info">
          <h3>${escapeHTML(film.title)}</h3>
          <p>${escapeHTML(categoryName(film.category_id))}</p>
          <span class="vg-muted">
            ${escapeHTML(film.release_year || "")}
            ${film.duration ? " • " + escapeHTML(film.duration) : ""}
          </span>
        </div>
      `;

      card.addEventListener("click", () => openFilm(film));

      grid.appendChild(card);
    });

    const empty = $("#emptyState");

    if (empty) {
      empty.style.display = filtered.length ? "none" : "block";
    }
  }

  function renderFilters() {
    const filters = $("#filters");
    if (!filters) return;

    filters.innerHTML = "";

    const all = document.createElement("button");
    all.textContent = "All";
    all.dataset.category = "all";
    all.className = "active";
    filters.appendChild(all);

    categories.forEach((category) => {
      const button = document.createElement("button");

      button.textContent = category.name;
      button.dataset.category = category.name;

      filters.appendChild(button);
    });

    filters.querySelectorAll("button").forEach((button) => {
      button.addEventListener("click", () => {
        filters.querySelectorAll("button").forEach((item) => {
          item.classList.remove("active");
        });

        button.classList.add("active");
        renderFilms();
      });
    });
  }

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    })[character]);
  }

  /* ============================================================
     FILM MODAL
     ============================================================ */

  function openFilm(film) {
    const modal = $("#filmModal");

    if (!modal) {
      console.error("Film modal not found.");
      return;
    }

    currentVideo = film;

    if ($("#modalTitle")) {
      $("#modalTitle").textContent = film.title || "";
    }

    if ($("#modalCategory")) {
      $("#modalCategory").textContent =
        categoryName(film.category_id);
    }

    if ($("#modalDescription")) {
      $("#modalDescription").textContent =
        film.description || "";
    }

    if ($("#modalMeta")) {
      $("#modalMeta").textContent = [
        film.release_year,
        film.duration
      ].filter(Boolean).join(" • ");
    }

    showModal(modal);

    createPlayer(film.video_url);
  }

  function showModal(modal) {
    modal.classList.add("active", "open");
    modal.style.display = "flex";
    document.body.style.overflow = "hidden";
  }

  function closeModal(modal) {
    if (!modal) return;

    modal.classList.remove("active", "open");
    modal.style.display = "none";

    if (!document.querySelector(".modal.active, .modal.open")) {
      document.body.style.overflow = "";
    }
  }

  /* ============================================================
     CINEMA PLAYER
     ============================================================ */

  function installPlayerInterface() {
    const modal = $("#filmModal");

    if (!modal) return;

    modal.querySelectorAll("[data-close], .modal-close").forEach(
      (button) => {
        button.addEventListener("click", () => {
          destroyPlayer();
          closeModal(modal);
        });
      }
    );

    modal.addEventListener("click", (event) => {
      if (event.target === modal) {
        destroyPlayer();
        closeModal(modal);
      }
    });
  }

  function destroyPlayer() {
    if (hlsInstance) {
      hlsInstance.destroy();
      hlsInstance = null;
    }

    const video = $("#vgVideo");

    if (video) {
      video.pause();
      video.removeAttribute("src");
      video.load();
    }

    currentVideo = null;
  }

  function normaliseVideoUrl(url) {
    if (!url) return "";

    const cleaned = url.trim();

    if (/^[A-Za-z0-9]+$/.test(cleaned)) {
      return `https://stream.mux.com/${cleaned}.m3u8`;
    }

    return cleaned;
  }

  function createPlayer(videoUrl) {
    const area = $("#playerArea");
    if (!area) return;

    destroyPlayer();

    const url = normaliseVideoUrl(videoUrl);

    if (!url) {
      area.innerHTML = `
        <div class="vg-player-error">
          <h3>Video unavailable</h3>
          <p>This film does not have a playback link yet.</p>
        </div>
      `;
      return;
    }

    area.innerHTML = `
      <div class="vg-player" id="vgPlayer">
        <video id="vgVideo" playsinline preload="metadata"></video>

        <div class="vg-controls" id="vgControls">

          <div class="vg-control-top">
            <span style="color:white;font-weight:600">
              VENTUREGATE
            </span>
            <button type="button" id="vgFullscreen" aria-label="Fullscreen">⛶</button>
          </div>

          <div class="vg-control-centre">
            <button type="button" id="vgBack" aria-label="Back 10 seconds">↶</button>
            <button type="button" id="vgPlay" class="vg-play-main" aria-label="Play">▶</button>
            <button type="button" id="vgForward" aria-label="Forward 10 seconds">↷</button>
          </div>

          <div>
            <input class="vg-progress" id="vgProgress"
              type="range" min="0" max="100" value="0" step="0.1">

            <div class="vg-control-bottom">
              <span class="vg-time" id="vgTime">00:00 / 00:00</span>

              <div style="display:flex;align-items:center;gap:8px">
                <button type="button" id="vgMute" aria-label="Mute">♫</button>
                <input class="vg-volume" id="vgVolume"
                  type="range" min="0" max="1" step="0.05" value="1">
                <button type="button" id="vgSpeed">1×</button>
              </div>
            </div>
          </div>

        </div>
      </div>
    `;

    const video = $("#vgVideo");
    const player = $("#vgPlayer");

    const playButton = $("#vgPlay");
    const progress = $("#vgProgress");
    const time = $("#vgTime");
    const volume = $("#vgVolume");
    const speed = $("#vgSpeed");

    let hideTimer;
    let speedIndex = 0;

    const speeds = [1, 1.25, 1.5, 1.75, 2];

    function formatTime(seconds) {
      if (!Number.isFinite(seconds)) return "00:00";

      const minutes = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);

      return `${String(minutes).padStart(2, "0")}:${String(
        secs
      ).padStart(2, "0")}`;
    }

    function updatePlayButton() {
      playButton.textContent = video.paused ? "▶" : "Ⅱ";
    }

    function updateProgress() {
      if (!video.duration) return;

      progress.value =
        (video.currentTime / video.duration) * 100;

      time.textContent =
        `${formatTime(video.currentTime)} / ${formatTime(video.duration)}`;
    }

    function revealControls() {
      player.classList.remove("vg-hidden-controls");

      clearTimeout(hideTimer);

      if (!video.paused) {
        hideTimer = setTimeout(() => {
          player.classList.add("vg-hidden-controls");
        }, 3000);
      }
    }

    playButton.addEventListener("click", () => {
      if (video.paused) {
        video.play().catch(() => {
          showToast("Unable to start video playback.");
        });
      } else {
        video.pause();
      }

      revealControls();
    });

    video.addEventListener("click", () => {
      if (video.paused) {
        video.play().catch(() => {});
      } else {
        video.pause();
      }

      revealControls();
    });

    video.addEventListener("play", updatePlayButton);
    video.addEventListener("pause", updatePlayButton);
    video.addEventListener("timeupdate", updateProgress);
    video.addEventListener("loadedmetadata", updateProgress);
    video.addEventListener("ended", () => {
      player.classList.remove("vg-hidden-controls");
      updatePlayButton();
    });

    $("#vgBack").addEventListener("click", () => {
      video.currentTime = Math.max(0, video.currentTime - 10);
      revealControls();
    });

    $("#vgForward").addEventListener("click", () => {
      video.currentTime = Math.min(
        video.duration || 0,
        video.currentTime + 10
      );
      revealControls();
    });

    progress.addEventListener("input", () => {
      if (video.duration) {
        video.currentTime =
          (Number(progress.value) / 100) * video.duration;
      }
    });

    volume.addEventListener("input", () => {
      video.volume = Number(volume.value);
      video.muted = video.volume === 0;
    });

    $("#vgMute").addEventListener("click", () => {
      video.muted = !video.muted;
      $("#vgMute").textContent = video.muted ? "×" : "♫";
    });

    speed.addEventListener("click", () => {
      speedIndex = (speedIndex + 1) % speeds.length;
      video.playbackRate = speeds[speedIndex];
      speed.textContent = `${speeds[speedIndex]}×`;
      revealControls();
    });

    $("#vgFullscreen").addEventListener("click", () => {
      if (player.requestFullscreen) {
        player.requestFullscreen();
      } else if (video.webkitEnterFullscreen) {
        video.webkitEnterFullscreen();
      }
    });

    player.addEventListener("mousemove", revealControls);
    player.addEventListener("touchstart", revealControls);

    player.addEventListener("mouseleave", () => {
      if (!video.paused) {
        player.classList.add("vg-hidden-controls");
      }
    });

    if (url.endsWith(".m3u8") && window.Hls?.isSupported()) {
      hlsInstance = new window.Hls();

      hlsInstance.loadSource(url);
      hlsInstance.attachMedia(video);

      hlsInstance.on(window.Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          console.error("HLS playback error:", data);
          showToast("Video playback failed. Please check the Mux link.");
        }
      });

    } else if (
      video.canPlayType("application/vnd.apple.mpegurl")
    ) {
      video.src = url;

    } else {
      video.src = url;
    }

    video.load();
  }

  /* ============================================================
     ADMIN AUTHENTICATION
     ============================================================ */

  function installAdminInterface() {
    const modal = $("#adminModal");
    if (!modal) return;

    const warning = modal.querySelector(".admin-warning");

    if (warning) {
      warning.style.display = "none";
    }

    let interfaceBox = $("#vgAdminInterface");

    if (!interfaceBox) {
      interfaceBox = document.createElement("div");
      interfaceBox.id = "vgAdminInterface";

      modal.prepend(interfaceBox);
    }

    const adminButton = $("#adminOpen");

    if (adminButton) {
      adminButton.addEventListener("click", () => {
        updateAdminInterface();
        showModal(modal);
      });
    }

    modal.querySelectorAll("[data-close], .modal-close").forEach(
      (button) => {
        button.addEventListener("click", () => {
          closeModal(modal);
        });
      }
    );

    modal.addEventListener("click", (event) => {
      if (event.target === modal) {
        closeModal(modal);
      }
    });

    const form = $("#filmForm");

    if (form) {
      form.addEventListener("submit", submitFilm);
    }

    const search = $("#searchInput");

    if (search) {
      search.addEventListener("input", renderFilms);
    }
  }

  async function checkAdmin(user) {
    currentUser = user;
    isAdmin = false;

    try {
      const { data, error } = await db
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (error) throw error;

      isAdmin = data?.role === "admin";

      if (isAdmin) {
        console.log("VentureGate administrator authenticated.");
      }

    } catch (error) {
      console.error("Admin verification error:", error);
      isAdmin = false;
    }

    updateAdminInterface();
  }

  function updateAdminInterface() {
    const box = $("#vgAdminInterface");
    if (!box) return;

    if (isAdmin && currentUser) {
      box.innerHTML = `
        <div class="vg-admin-status success">
          <strong>Administrator access verified</strong><br>
          <span class="vg-muted">
            Signed in as ${escapeHTML(currentUser.email)}
          </span>
        </div>

        <button type="button" id="vgLogout">
          Sign out
        </button>
      `;

      box.querySelector("#vgLogout").addEventListener(
        "click",
        logoutAdmin
      );

      const form = $("#filmForm");

      if (form) {
        form.style.display = "block";
      }

      renderAdminFilms();

    } else {
      box.innerHTML = `
        <div class="vg-login-box">
          <h3>Administrator login</h3>
          <p class="vg-muted">
            Sign in using your authorised VentureGate account.
          </p>

          <form id="vgLoginForm">
            <input
              type="email"
              id="vgAdminEmail"
              placeholder="Admin email address"
              autocomplete="username"
              required
            >

            <input
              type="password"
              id="vgAdminPassword"
              placeholder="Password"
              autocomplete="current-password"
              required
            >

            <button type="submit" id="vgLoginButton">
              Sign in
            </button>
          </form>

          <p id="vgLoginMessage" class="vg-muted"></p>
        </div>
      `;

      const form = $("#filmForm");

      if (form) {
        form.style.display = "none";
      }

      $("#vgLoginForm").addEventListener(
        "submit",
        loginAdmin
      );
    }
  }

  async function loginAdmin(event) {
    event.preventDefault();

    const email = $("#vgAdminEmail").value.trim();
    const password = $("#vgAdminPassword").value;
    const button = $("#vgLoginButton");
    const message = $("#vgLoginMessage");

    button.disabled = true;
    button.textContent = "Signing in...";
    message.textContent = "";

    try {
      const { data, error } = await db.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;

      await checkAdmin(data.user);

      if (!isAdmin) {
        await db.auth.signOut();

        throw new Error(
          "This account does not have administrator permissions."
        );
      }

      showToast("Administrator login successful.");

    } catch (error) {
      console.error("Login error:", error);
      message.textContent = error.message || "Login failed.";
    } finally {
      button.disabled = false;
      button.textContent = "Sign in";
    }
  }

  async function logoutAdmin() {
    const { error } = await db.auth.signOut();

    if (error) {
      showToast("Unable to sign out.");
      return;
    }

    currentUser = null;
    isAdmin = false;

    updateAdminInterface();
    showToast("Signed out successfully.");
  }

  /* ============================================================
     ADD FILMS
     ============================================================ */

  async function getOrCreateCategory(name) {
    const cleanName = name.trim();

    if (!cleanName) {
      throw new Error("Please enter a film category.");
    }

    const existing = categories.find(
      (category) =>
        category.name.toLowerCase() === cleanName.toLowerCase()
    );

    if (existing) return existing.id;

    const { data, error } = await db
      .from("categories")
      .insert({ name: cleanName })
      .select("id,name")
      .single();

    if (error) throw error;

    categories.push(data);

    return data.id;
  }

  async function submitFilm(event) {
    event.preventDefault();

    if (!isAdmin || !currentUser) {
      showToast("Administrator login required.");
      return;
    }

    const form = event.currentTarget;
    const button = form.querySelector('[type="submit"]');

    const formData = new FormData(form);

    const title = formData.get("title")?.toString().trim();
    const category = formData.get("category")?.toString().trim();
    const year = formData.get("year")?.toString().trim();
    const runtime = formData.get("runtime")?.toString().trim();
    const poster = formData.get("poster")?.toString().trim();
    const video = formData.get("video")?.toString().trim();
    const description = formData.get("description")?.toString().trim();

    if (!title || !category || !video) {
      showToast("Title, category and video link are required.");
      return;
    }

    button.disabled = true;
    button.textContent = "Publishing...";

    try {
      const categoryId = await getOrCreateCategory(category);

      const newFilm = {
        title,
        description: description || "",
        poster_url: poster || null,
        video_url: normaliseVideoUrl(video),
        category_id: categoryId,
        release_year: year || null,
        duration: runtime || null,
        published: true
      };

      const { error } = await db
        .from("films")
        .insert(newFilm);

      if (error) throw error;

      form.reset();

      await loadCatalogue();

      showToast("Film published for everyone!");

    } catch (error) {
      console.error("Film upload error:", error);

      showToast(
        "Film could not be published: " + error.message
      );

    } finally {
      button.disabled = false;
      button.textContent = "Add Film";
    }
  }

  /* ============================================================
     ADMIN FILM MANAGEMENT
     ============================================================ */

  function renderAdminFilms() {
    const list = $("#adminFilmList");

    if (!list || !isAdmin) return;

    list.innerHTML = "";

    if (!films.length) {
      list.innerHTML = `
        <p class="vg-muted">
          No published films yet. Add your first film above.
        </p>
      `;
      return;
    }

    films.forEach((film) => {
      const row = document.createElement("div");

      row.className = "admin-row";

      const details = document.createElement("div");

      details.innerHTML = `
        <strong>${escapeHTML(film.title)}</strong>
        <br>
        <span class="vg-muted">
          ${escapeHTML(categoryName(film.category_id))}
        </span>
      `;

      const actions = document.createElement("div");
      actions.className = "vg-admin-actions";

      const deleteButton = document.createElement("button");

      deleteButton.className = "vg-delete-button";
      deleteButton.textContent = "Delete";

      deleteButton.addEventListener("click", () => {
        deleteFilm(film.id, film.title);
      });

      actions.appendChild(deleteButton);

      row.appendChild(details);
      row.appendChild(actions);

      list.appendChild(row);
    });
  }

  async function deleteFilm(id, title) {
    if (!isAdmin) {
      showToast("Administrator access required.");
      return;
    }

    if (!confirm(`Are you sure you want to delete "${title}"?`)) {
      return;
    }

    try {
      const { error } = await db
        .from("films")
        .delete()
        .eq("id", id);

      if (error) throw error;

      await loadCatalogue();

      showToast("Film deleted.");

    } catch (error) {
      console.error("Delete error:", error);

      showToast(
        "Could not delete film: " + error.message
      );
    }
  }

  /* ============================================================
     MEMBER / CHECKOUT BUTTONS
     ============================================================ */

  ["memberOpen", "memberOpen2", "checkoutBtn"].forEach((id) => {
    const button = document.getElementById(id);

    if (button) {
      button.addEventListener("click", () => {
        showToast("Membership options coming soon.");
      });
    }
  });

  /* ============================================================
     START
     ============================================================ */

  document.addEventListener("DOMContentLoaded", initialise);

  if (document.readyState !== "loading") {
    initialise();
  }

})();
