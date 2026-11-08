// VentureGate frontend connected to Supabase.
const SUPABASE_URL = window.VENTUREGATE_SUPABASE_URL;
const SUPABASE_KEY = window.VENTUREGATE_SUPABASE_KEY;

const $ = (s) => document.querySelector(s);
const supabaseReady = Boolean(
  window.supabase && SUPABASE_URL && SUPABASE_KEY &&
  !SUPABASE_KEY.includes("PASTE_YOUR")
);
const db = supabaseReady
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY)
  : null;

let films = [];
let categories = [];
let activeFilter = "All";
let currentUser = null;
let isAdmin = false;
let toastTimer;

function esc(v = "") {
  return String(v).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}
function toast(msg) {
  const el = $("#toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 3500);
}
function showModal(id) {
  $("#" + id).classList.remove("hidden");
  document.body.style.overflow = "hidden";
}
function hideModal(id) {
  $("#" + id).classList.add("hidden");
  document.body.style.overflow = "";
  if (id === "filmModal") $("#playerArea").innerHTML = "";
}

document.querySelectorAll("[data-close]").forEach(b =>
  b.addEventListener("click", () => hideModal(b.dataset.close))
);
document.querySelectorAll(".modal").forEach(m =>
  m.addEventListener("click", e => {
    if (e.target === m) hideModal(m.id);
  })
);
document.addEventListener("keydown", e => {
  if (e.key === "Escape") {
    document.querySelectorAll(".modal:not(.hidden)").forEach(m => hideModal(m.id));
  }
});

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
    $("#emptyState").textContent = "Supabase is not configured yet. Add your project details to config.js.";
    $("#emptyState").classList.remove("hidden");
    return;
  }
  const { data, error } = await db
    .from("films")
    .select("id,title,description,poster_url,video_url,release_year,duration,featured,categories(name)")
    .eq("published", true)
    .order("featured", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    toast("Could not load films. Check your Supabase tables and policies.");
    return;
  }
  films = (data || []).map(normaliseFilm);
  renderFilms();
}

function renderFilms() {
  const search = $("#searchInput").value.trim().toLowerCase();
  const list = films.filter(f =>
    (activeFilter === "All" || f.category === activeFilter) &&
    (`${f.title} ${f.category} ${f.description}`).toLowerCase().includes(search)
  );
  $("#filmGrid").innerHTML = list.map(f => `
    <article class="film-card" data-id="${esc(f.id)}">
      <div class="poster">
        ${f.poster ? `<img src="${esc(f.poster)}" alt="${esc(f.title)} poster" onerror="this.remove()">` : `<div class="poster-fallback">${esc(f.title.slice(0,1))}</div>`}
        <span class="poster-tag">${esc(f.category.toUpperCase())}</span>
        <div class="play-overlay"><span>▶</span></div>
      </div>
      <div class="film-info"><h3>${esc(f.title)}</h3><p>${esc(f.year || "Independent")} <span>•</span> ${esc(f.runtime || "Independent film")}</p></div>
    </article>`).join("");
  $("#emptyState").classList.toggle("hidden", list.length > 0);
  document.querySelectorAll(".film-card").forEach(card =>
    card.addEventListener("click", () => openFilm(card.dataset.id))
  );
}

function videoEmbedUrl(raw) {
  try {
    const u = new URL(raw);
    if (u.hostname.includes("youtu.be")) {
      const id = u.pathname.split("/").filter(Boolean)[0];
      return id ? `https://www.youtube-nocookie.com/embed/${id}` : raw;
    }
    if (u.hostname.includes("youtube.com")) {
      if (u.pathname.startsWith("/embed/")) return raw;
      const id = u.searchParams.get("v") || u.pathname.split("/").filter(Boolean).pop();
      return id ? `https://www.youtube-nocookie.com/embed/${id}` : raw;
    }
    if (u.hostname.includes("vimeo.com")) {
      if (u.pathname.startsWith("/video/")) return raw;
      const id = u.pathname.split("/").filter(Boolean).pop();
      return id && /^\d+$/.test(id) ? `https://player.vimeo.com/video/${id}` : raw;
    }
  } catch (_) {}
  return raw;
}

function openFilm(id) {
  const f = films.find(x => String(x.id) === String(id));
  if (!f) return;
  $("#modalCategory").textContent = f.category.toUpperCase();
  $("#modalTitle").textContent = f.title;
  $("#modalDescription").textContent = f.description;
  $("#modalMeta").textContent = `${f.year || ""} • ${f.runtime || "Independent film"}`;
  const area = $("#playerArea");
  area.innerHTML = "";
  if (f.video) {
    if (/youtube\.com|youtu\.be|vimeo\.com/.test(f.video)) {
      const iframe = document.createElement("iframe");
      iframe.src = videoEmbedUrl(f.video);
      iframe.allow = "autoplay; fullscreen; picture-in-picture";
      iframe.allowFullscreen = true;
      iframe.title = f.title;
      area.appendChild(iframe);
    } else {
      const video = document.createElement("video");
      video.controls = true;
      video.autoplay = true;
      video.playsInline = true;
      video.src = f.video;
      area.appendChild(video);
    }
  } else {
    area.innerHTML = '<div class="player-placeholder">This film has no video link yet.</div>';
  }
  showModal("filmModal");
}

async function loadCategories() {
  const { data, error } = await db.from("categories").select("id,name");
  if (error) throw error;
  categories = data || [];
  const select = $('select[name="category"]');
  if (categories.length) {
    select.innerHTML = categories.map(c => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join("");
  }
}

async function refreshAdmin() {
  const { data: { user } } = await db.auth.getUser();
  currentUser = user || null;
  isAdmin = false;
  if (currentUser) {
    const { data: profile, error } = await db
      .from("profiles").select("role").eq("id", currentUser.id).maybeSingle();
    if (!error && profile?.role === "admin") isAdmin = true;
  }
  $("#adminLoginPanel").classList.toggle("hidden", isAdmin);
  $("#adminPanel").classList.toggle("hidden", !isAdmin);
  if (isAdmin) {
    $("#adminStatus").textContent = `Signed in as ${currentUser.email}.`;
    await loadAdminFilms();
  } else if (currentUser) {
    $("#adminLoginPanel").classList.remove("hidden");
    $("#adminLoginPanel").querySelector(".admin-warning").textContent =
      "This account is signed in but does not have the VentureGate admin role.";
  }
}

async function loadAdminFilms() {
  const { data, error } = await db
    .from("films")
    .select("id,title,categories(name)")
    .order("created_at", { ascending: false });
  if (error) {
    toast("Could not load the admin film list.");
    return;
  }
  $("#adminFilmList").innerHTML = (data || []).map(f => `
    <div class="admin-row">
      <span>${esc(f.title)} <small>· ${esc(f.categories?.name || "Uncategorised")}</small></span>
      <button class="delete-btn" data-delete="${esc(f.id)}">REMOVE</button>
    </div>`).join("") || "<p>No films added yet.</p>";

  document.querySelectorAll("[data-delete]").forEach(button => {
    button.addEventListener("click", async () => {
      if (!confirm("Remove this film from VentureGate?")) return;
      const { error: deleteError } = await db.from("films").delete().eq("id", button.dataset.delete);
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

async function addFilm(event) {
  event.preventDefault();
  if (!isAdmin) return toast("Please sign in with the admin account first.");
  const form = event.currentTarget;
  const d = new FormData(form);
  const payload = {
    title: String(d.get("title")).trim(),
    category_id: d.get("category"),
    release_year: d.get("year") ? Number(d.get("year")) : null,
    duration: String(d.get("runtime") || "").trim(),
    poster_url: String(d.get("poster") || "").trim(),
    video_url: String(d.get("video") || "").trim(),
    description: String(d.get("description")).trim(),
    featured: d.get("featured") === "on",
    published: true
  };
  const { error } = await db.from("films").insert(payload);
  if (error) {
    console.error(error);
    toast("Film could not be saved. Check the categories and database setup.");
    return;
  }
  form.reset();
  await loadFilms();
  await loadAdminFilms();
  toast("Film published to the VentureGate library.");
}

$("#filters").addEventListener("click", e => {
  const button = e.target.closest("[data-filter]");
  if (!button) return;
  activeFilter = button.dataset.filter;
  document.querySelectorAll(".filter").forEach(x =>
    x.classList.toggle("active", x === button)
  );
  renderFilms();
});
document.querySelectorAll("[data-filter-link]").forEach(a =>
  a.addEventListener("click", () => {
    activeFilter = a.dataset.filterLink;
    document.querySelectorAll(".filter").forEach(x =>
      x.classList.toggle("active", x.dataset.filter === activeFilter)
    );
    renderFilms();
  })
);
$("#searchInput").addEventListener("input", renderFilms);
$("#searchToggle").addEventListener("click", () => {
  $("#searchInput").focus();
  $("#films").scrollIntoView({ behavior: "smooth" });
});
$("#viewAll").addEventListener("click", () => {
  activeFilter = "All";
  $("#searchInput").value = "";
  document.querySelectorAll(".filter").forEach(x =>
    x.classList.toggle("active", x.dataset.filter === "All")
  );
  renderFilms();
});
$("#heroPlay").addEventListener("click", () =>
  $("#films").scrollIntoView({ behavior: "smooth" })
);

$("#memberOpen").addEventListener("click", () => showModal("memberModal"));
$("#memberOpen2").addEventListener("click", () => showModal("memberModal"));
$("#checkoutBtn").addEventListener("click", () =>
  toast("The £25 payment checkout is not connected yet.")
);
$("#adminOpen").addEventListener("click", async () => {
  showModal("adminModal");
  if (!db) {
    $("#adminLoginPanel").querySelector(".admin-warning").textContent =
      "Supabase is not configured. Check config.js first.";
    return;
  }
  await refreshAdmin();
});
$("#loginForm").addEventListener("submit", async event => {
  event.preventDefault();
  const d = new FormData(event.currentTarget);
  const { error } = await db.auth.signInWithPassword({
    email: String(d.get("email")).trim(),
    password: String(d.get("password"))
  });
  if (error) {
    toast("Sign-in failed: check your email and password.");
    return;
  }
  await refreshAdmin();
  if (isAdmin) toast("Welcome to VentureGate Studio.");
});
$("#signOutBtn").addEventListener("click", async () => {
  await db.auth.signOut();
  await refreshAdmin();
  toast("Signed out.");
});
$("#filmForm").addEventListener("submit", addFilm);

async function start() {
  if (!db) {
    $("#emptyState").textContent = "Supabase setup is nearly ready. Add your project URL and publishable key to config.js.";
    $("#emptyState").classList.remove("hidden");
    return;
  }
  try {
    await loadCategories();
    await loadFilms();
    await refreshAdmin();
    db.auth.onAuthStateChange(() => {
      // Defer the profile lookup so it does not block Supabase's auth callback.
      setTimeout(() => refreshAdmin(), 0);
    });
  } catch (error) {
    console.error(error);
    toast("Supabase connection error. Check your setup steps.");
  }
}
start();
