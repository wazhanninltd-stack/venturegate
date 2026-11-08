// ======================================================
// VENTUREGATE - SUPABASE WEBSITE SYSTEM
// Includes admin login, film management and password reset
// ======================================================

// SUPABASE CONNECTION
const SUPABASE_URL = window.VENTUREGATE_SUPABASE_URL;
const SUPABASE_KEY = window.VENTUREGATE_SUPABASE_KEY;

const $ = (selector) => document.querySelector(selector);

const supabaseReady = Boolean(
  window.supabase &&
  SUPABASE_URL &&
  SUPABASE_KEY &&
  !SUPABASE_KEY.includes("PASTE_YOUR")
);

const db = supabaseReady
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY)
  : null;


// ======================================================
// WEBSITE VARIABLES
// ======================================================

let films = [];
let categories = [];
let activeFilter = "All";
let currentUser = null;
let isAdmin = false;
let toastTimer;


// ======================================================
// GENERAL WEBSITE FUNCTIONS
// ======================================================

function esc(value = "") {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[character]));
}

function toast(message) {
  const element = $("#toast");

  if (!element) return;

  element.textContent = message;
  element.classList.add("show");

  clearTimeout(toastTimer);

  toastTimer = setTimeout(() => {
    element.classList.remove("show");
  }, 3500);
}

function showModal(id) {
  const modal = $("#" + id);

  if (!modal) return;

  modal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

function hideModal(id) {
  const modal = $("#" + id);

  if (!modal) return;

  modal.classList.add("hidden");
  document.body.style.overflow = "";

  if (id === "filmModal" && $("#playerArea")) {
    $("#playerArea").innerHTML = "";
  }
}


// ======================================================
// MODAL CONTROLS
// ======================================================

document.querySelectorAll("[data-close]").forEach(button => {
  button.addEventListener("click", () => {
    hideModal(button.dataset.close);
  });
});

document.querySelectorAll(".modal").forEach(modal => {
  modal.addEventListener("click", event => {
    if (event.target === modal) {
      hideModal(modal.id);
    }
  });
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    document.querySelectorAll(".modal:not(.hidden)").forEach(modal => {
      hideModal(modal.id);
    });
  }
});


// ======================================================
// FILM DATABASE FUNCTIONS
// ======================================================

function normaliseFilm(row) {
  return {
    id: row.id,
    title: row.title || "Untitled",
    category: row.categories?.name || "Short Film",
    year: row.release_year || "",
    runtime: row.duration || "",
    description: row.description || "",
    poster: row.poster_url || "",
    video: row.video_url || "",
    featured: Boolean(row.featured)
  };
}


async function loadFilms() {

  if (!db) {
    $("#filmGrid").innerHTML = "";

    $("#emptyState").textContent =
      "Supabase is not configured yet. Check config.js.";

    $("#emptyState").classList.remove("hidden");

    return;
  }

  const { data, error } = await db
    .from("films")
    .select(`
      id,
      title,
      description,
      poster_url,
      video_url,
      release_year,
      duration,
      featured,
      categories(name)
    `)
    .eq("published", true)
    .order("featured", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    toast("Could not load films. Check your Supabase setup.");
    return;
  }

  films = (data || []).map(normaliseFilm);

  renderFilms();
}


// ======================================================
// DISPLAY FILMS
// ======================================================

function renderFilms() {

  const search = $("#searchInput").value.trim().toLowerCase();

  const list = films.filter(film => {

    const matchesCategory =
      activeFilter === "All" ||
      film.category === activeFilter;

    const matchesSearch =
      `${film.title} ${film.category} ${film.description}`
        .toLowerCase()
        .includes(search);

    return matchesCategory && matchesSearch;
  });

  $("#filmGrid").innerHTML = list.map(film => `
    <article class="film-card" data-id="${esc(film.id)}">

      <div class="poster">

        ${
          film.poster
            ? `<img src="${esc(film.poster)}"
                alt="${esc(film.title)} poster"
                onerror="this.remove()">`
            : `<div class="poster-fallback">
                ${esc(film.title.slice(0, 1))}
              </div>`
        }

        <span class="poster-tag">
          ${esc(film.category.toUpperCase())}
        </span>

        <div class="play-overlay">
          <span>▶</span>
        </div>

      </div>

      <div class="film-info">
        <h3>${esc(film.title)}</h3>

        <p>
          ${esc(film.year || "Independent")}
          <span>•</span>
          ${esc(film.runtime || "Independent film")}
        </p>
      </div>

    </article>
  `).join("");

  $("#emptyState").classList.toggle("hidden", list.length > 0);

  document.querySelectorAll(".film-card").forEach(card => {
    card.addEventListener("click", () => {
      openFilm(card.dataset.id);
    });
  });
}


// ======================================================
// VIDEO PLAYER
// ======================================================

function videoEmbedUrl(raw) {

  try {

    const url = new URL(raw);

    if (url.hostname.includes("youtu.be")) {

      const id = url.pathname.split("/").filter(Boolean)[0];

      return id
        ? `https://www.youtube-nocookie.com/embed/${id}`
        : raw;
    }

    if (url.hostname.includes("youtube.com")) {

      if (url.pathname.startsWith("/embed/")) {
        return raw;
      }

      const id =
        url.searchParams.get("v") ||
        url.pathname.split("/").filter(Boolean).pop();

      return id
        ? `https://www.youtube-nocookie.com/embed/${id}`
        : raw;
    }

    if (url.hostname.includes("vimeo.com")) {

      if (url.pathname.startsWith("/video/")) {
        return raw;
      }

      const id = url.pathname.split("/").filter(Boolean).pop();

      return id && /^\d+$/.test(id)
        ? `https://player.vimeo.com/video/${id}`
        : raw;
    }

  } catch (_) {}

  return raw;
}


function openFilm(id) {

  const film = films.find(item => String(item.id) === String(id));

  if (!film) return;

  $("#modalCategory").textContent = film.category.toUpperCase();
  $("#modalTitle").textContent = film.title;
  $("#modalDescription").textContent = film.description;

  $("#modalMeta").textContent =
    `${film.year || ""} • ${film.runtime || "Independent film"}`;

  const area = $("#playerArea");

  area.innerHTML = "";

  if (film.video) {

    if (/youtube\.com|youtu\.be|vimeo\.com/.test(film.video)) {

      const iframe = document.createElement("iframe");

      iframe.src = videoEmbedUrl(film.video);
      iframe.allow = "autoplay; fullscreen; picture-in-picture";
      iframe.allowFullscreen = true;
      iframe.title = film.title;

      area.appendChild(iframe);

    } else {

      const video = document.createElement("video");

      video.controls = true;
      video.autoplay = true;
      video.playsInline = true;
      video.src = film.video;

      area.appendChild(video);
    }

  } else {

    area.innerHTML =
      '<div class="player-placeholder">This film has no video link yet.</div>';
  }

  showModal("filmModal");
}


// ======================================================
// CATEGORY SYSTEM
// ======================================================

async function loadCategories() {

  const { data, error } = await db
    .from("categories")
    .select("id,name");

  if (error) throw error;

  categories = data || [];

  const select = $('select[name="category"]');

  if (categories.length && select) {

    select.innerHTML = categories.map(category => `
      <option value="${esc(category.id)}">
        ${esc(category.name)}
      </option>
    `).join("");
  }
}


// ======================================================
// ADMIN LOGIN AND PERMISSIONS
// ======================================================

async function refreshAdmin() {

  if (!db) return;

  const {
    data: { user }
  } = await db.auth.getUser();

  currentUser = user || null;

  isAdmin = false;

  if (currentUser) {

    const { data: profile, error } = await db
      .from("profiles")
      .select("role")
      .eq("id", currentUser.id)
      .maybeSingle();

    if (!error && profile?.role === "admin") {
      isAdmin = true;
    }
  }

  $("#adminLoginPanel").classList.toggle("hidden", isAdmin);

  $("#adminPanel").classList.toggle("hidden", !isAdmin);

  if (isAdmin) {

    $("#adminStatus").textContent =
      `Signed in as ${currentUser.email}.`;

    await loadAdminFilms();

  } else if (currentUser) {

    $("#adminLoginPanel").classList.remove("hidden");

    $("#adminLoginPanel").querySelector(".admin-warning").textContent =
      "This account is signed in but does not have the VentureGate admin role.";
  }
}


// ======================================================
// ADMIN FILM LIST
// ======================================================

async function loadAdminFilms() {

  const { data, error } = await db
    .from("films")
    .select("id,title,categories(name)")
    .order("created_at", { ascending: false });

  if (error) {

    toast("Could not load the admin film list.");

    return;
  }

  $("#adminFilmList").innerHTML = (data || []).map(film => `
    <div class="admin-row">

      <span>
        ${esc(film.title)}
        <small>· ${esc(film.categories?.name || "Uncategorised")}</small>
      </span>

      <button class="delete-btn" data-delete="${esc(film.id)}">
        REMOVE
      </button>

    </div>
  `).join("") || "<p>No films added yet.</p>";

  document.querySelectorAll("[data-delete]").forEach(button => {

    button.addEventListener("click", async () => {

      if (!confirm("Remove this film from VentureGate?")) return;

      const { error: deleteError } = await db
        .from("films")
        .delete()
        .eq("id", button.dataset.delete);

      if (deleteError) {

        toast("Could not remove film. Check admin permissions.");

        return;
      }

      await loadFilms();
      await loadAdminFilms();

      toast("Film removed from the library.");
    });
  });
}


// ======================================================
// ADD FILM
// ======================================================

async function addFilm(event) {

  event.preventDefault();

  if (!isAdmin) {
    return toast("Please sign in with the admin account first.");
  }

  const form = event.currentTarget;

  const data = new FormData(form);

  const payload = {

    title: String(data.get("title")).trim(),

    category_id: data.get("category"),

    release_year: data.get("year")
      ? Number(data.get("year"))
      : null,

    duration: String(data.get("runtime") || "").trim(),

    poster_url: String(data.get("poster") || "").trim(),

    video_url: String(data.get("video") || "").trim(),

    description: String(data.get("description")).trim(),

    featured: data.get("featured") === "on",

    published: true
  };

  const { error } = await db
    .from("films")
    .insert(payload);

  if (error) {

    console.error(error);

    toast("Film could not be saved. Check categories and database setup.");

    return;
  }

  form.reset();

  await loadFilms();
  await loadAdminFilms();

  toast("Film published to the VentureGate library.");
}


// ======================================================
// PASSWORD RECOVERY SYSTEM
// ======================================================

// This is the address Supabase will return users to
// after they click the password recovery email.

const recoveryRedirect =
  window.location.origin + window.location.pathname;


// SEND PASSWORD RESET EMAIL

async function requestPasswordReset(email) {

  if (!db) {

    toast("Supabase connection unavailable.");

    return;
  }

  const { error } = await db.auth.resetPasswordForEmail(email, {

    redirectTo: recoveryRedirect

  });

  if (error) {

    console.error(error);

    toast("Could not send recovery email. Please try again.");

    return;
  }

  toast("Password recovery email sent. Check your inbox.");
}


// FORGOT PASSWORD BUTTON

if ($("#forgotAdminBtn")) {

  $("#forgotAdminBtn").addEventListener("click", async () => {

    const email = $("#loginForm").elements.email.value.trim();

    if (!email) {

      toast("Enter your email address first.");

      $("#loginForm").elements.email.focus();

      return;
    }

    await requestPasswordReset(email);

  });
}


// DETECT PASSWORD RECOVERY LINK

// This listener is registered before the website starts,
// so Supabase can notify us when the recovery link is opened.

if (db) {

  db.auth.onAuthStateChange((event) => {

    if (event === "PASSWORD_RECOVERY") {

      showModal("passwordModal");

    }

  });
}


// SAVE THE NEW PASSWORD

if ($("#passwordResetForm")) {

  $("#passwordResetForm").addEventListener("submit", async event => {

    event.preventDefault();

    if (!db) {

      toast("Supabase connection unavailable.");

      return;
    }

    const form = event.currentTarget;

    const data = new FormData(form);

    const password = String(data.get("password") || "");

    const confirmPassword =
      String(data.get("confirmPassword") || "");

    if (password.length < 8) {

      toast("Your password must be at least 8 characters.");

      return;
    }

    if (password !== confirmPassword) {

      toast("Your passwords do not match.");

      return;
    }

    const { error } = await db.auth.updateUser({

      password: password

    });

    if (error) {

      console.error(error);

      toast("Password update failed. Please try again.");

      return;
    }

    form.reset();

    hideModal("passwordModal");

    toast("Your password has been successfully updated.");

  });
}


// ======================================================
// FILTERS AND SEARCH
// ======================================================

$("#filters").addEventListener("click", event => {

  const button = event.target.closest("[data-filter]");

  if (!button) return;

  activeFilter = button.dataset.filter;

  document.querySelectorAll(".filter").forEach(item => {

    item.classList.toggle("active", item === button);

  });

  renderFilms();
});


document.querySelectorAll("[data-filter-link]").forEach(link => {

  link.addEventListener("click", () => {

    activeFilter = link.dataset.filterLink;

    document.querySelectorAll(".filter").forEach(item => {

      item.classList.toggle(
        "active",
        item.dataset.filter === activeFilter
      );

    });

    renderFilms();
  });
});


$("#searchInput").addEventListener("input", renderFilms);


$("#searchToggle").addEventListener("click", () => {

  $("#searchInput").focus();

  $("#films").scrollIntoView({
    behavior: "smooth"
  });

});


$("#viewAll").addEventListener("click", () => {

  activeFilter = "All";

  $("#searchInput").value = "";

  document.querySelectorAll(".filter").forEach(item => {

    item.classList.toggle(
      "active",
      item.dataset.filter === "All"
    );

  });

  renderFilms();
});


$("#heroPlay").addEventListener("click", () => {

  $("#films").scrollIntoView({
    behavior: "smooth"
  });

});


// ======================================================
// MEMBERSHIP
// ======================================================

$("#memberOpen").addEventListener("click", () => {

  showModal("memberModal");

});


$("#memberOpen2").addEventListener("click", () => {

  showModal("memberModal");

});


$("#checkoutBtn").addEventListener("click", () => {

  toast("The £25 payment checkout is not connected yet.");

});


// ======================================================
// ADMIN MODAL
// ======================================================

$("#adminOpen").addEventListener("click", async () => {

  showModal("adminModal");

  if (!db) {

    $("#adminLoginPanel").querySelector(".admin-warning").textContent =
      "Supabase is not configured. Check config.js first.";

    return;
  }

  await refreshAdmin();

});


// ======================================================
// ADMIN SIGN IN
// ======================================================

$("#loginForm").addEventListener("submit", async event => {

  event.preventDefault();

  if (!db) {

    toast("Supabase connection unavailable.");

    return;
  }

  const data = new FormData(event.currentTarget);

  const { error } = await db.auth.signInWithPassword({

    email: String(data.get("email")).trim(),

    password: String(data.get("password"))

  });

  if (error) {

    toast("Sign-in failed: check your email and password.");

    return;
  }

  await refreshAdmin();

  if (isAdmin) {

    toast("Welcome to VentureGate Studio.");

  }

});


// ======================================================
// ADMIN SIGN OUT
// ======================================================

$("#signOutBtn").addEventListener("click", async () => {

  if (!db) return;

  await db.auth.signOut();

  await refreshAdmin();

  toast("Signed out.");

});


// ======================================================
// FILM FORM
// ======================================================

$("#filmForm").addEventListener("submit", addFilm);


// ======================================================
// START WEBSITE
// ======================================================

async function start() {

  if (!db) {

    $("#emptyState").textContent =
      "Supabase setup is nearly ready. Check config.js.";

    $("#emptyState").classList.remove("hidden");

    return;
  }

  try {

    await loadCategories();

    await loadFilms();

    await refreshAdmin();

    db.auth.onAuthStateChange(() => {

      setTimeout(() => refreshAdmin(), 0);

    });

  } catch (error) {

    console.error(error);

    toast("Supabase connection error. Check your setup steps.");

  }

}

start();


// ======================================================
// END OF VENTUREGATE APP.JS
// ======================================================
