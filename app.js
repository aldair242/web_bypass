/* ════════════════════════════════════════════════
   UID VAULT — app.js
   Funciones:
   · Login con roles (superadmin / admin)
   · CRUD de UIDs vía Cloudflare Worker
   · Tracking de autor por UID (localStorage)
   · Feed de actividad reciente
   · Gestión de admins (solo superadmin)
════════════════════════════════════════════════ */

const API_URL = "https://uid-worker.bottuser7.workers.dev/uids";

/* ────────────────────────────────────────
   USUARIOS — almacenados en localStorage
   Estructura: { username: { pass, role, name, color } }
──────────────────────────────────────── */
const SEED_USERS = {
  aldairjeremy: { pass: "jeremy2403", role: "superadmin", name: "Super Admin",  color: "#f5a524" },
  admin1:     { pass: "admin1234", role: "admin",      name: "Administrador 1", color: "#6777ff" }
};

function getUsers() {
  try {
    return JSON.parse(localStorage.getItem("uidvault_users")) || SEED_USERS;
  } catch { return SEED_USERS; }
}
function saveUsers(u) {
  localStorage.setItem("uidvault_users", JSON.stringify(u));
}

/* ────────────────────────────────────────
   SESIÓN
──────────────────────────────────────── */
let session = null; // { username, name, role, color }

function doLogin() {
  const username = document.getElementById("loginUser").value.trim();
  const pass     = document.getElementById("loginPass").value;
  const users    = getUsers();
  const found    = users[username];

  const errEl = document.getElementById("loginError");

  if (!found || found.pass !== pass) {
    errEl.classList.add("show");
    document.getElementById("loginPass").value = "";
    setTimeout(() => errEl.classList.remove("show"), 3000);
    return;
  }

  session = { username, ...found };
  errEl.classList.remove("show");
  bootApp();
}

// Permite login con Enter
document.getElementById("loginPass").addEventListener("keydown", e => {
  if (e.key === "Enter") doLogin();
});
document.getElementById("loginUser").addEventListener("keydown", e => {
  if (e.key === "Enter") document.getElementById("loginPass").focus();
});

function doLogout() {
  session = null;
  document.getElementById("loginScreen").style.display = "flex";
  document.getElementById("app").style.display = "none";
  document.getElementById("loginUser").value = "";
  document.getElementById("loginPass").value = "";
}

function togglePass() {
  const inp = document.getElementById("loginPass");
  inp.type = inp.type === "password" ? "text" : "password";
}

/* ────────────────────────────────────────
   INICIALIZAR APP
──────────────────────────────────────── */
function bootApp() {
  document.getElementById("loginScreen").style.display = "none";
  document.getElementById("app").style.display = "flex";

  // Avatar en sidebar
  const initials = session.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  const av = document.getElementById("sidebarAvatar");
  av.textContent = initials;
  av.style.background = session.color + "22";
  av.style.color       = session.color;
  av.style.border      = `1.5px solid ${session.color}44`;

  document.getElementById("sidebarName").textContent = session.name;
  document.getElementById("sidebarRole").textContent =
    session.role === "superadmin" ? "Super Admin" : "Administrador";

  // Mostrar sección admin solo si superadmin
  if (session.role === "superadmin") {
    document.getElementById("navLabelAdmin").style.display = "block";
    document.getElementById("navAdmins").style.display = "flex";
  }

  // Reloj
  updateClock();
  setInterval(updateClock, 1000);

  showPage("dashboard");
}

function updateClock() {
  const el = document.getElementById("topbarClock");
  if (el) el.textContent = new Date().toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });
}

/* ────────────────────────────────────────
   NAVEGACIÓN
──────────────────────────────────────── */
const PAGE_META = {
  dashboard: { title: "Dashboard",          sub: "Vista general del sistema" },
  uids:      { title: "Licencias / UIDs",   sub: "Gestión de licencias activas" },
  admins:    { title: "Administradores",     sub: "Equipo y control de acceso" }
};

function showPage(id) {
  // Ocultar todas las páginas y desactivar nav links
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.querySelectorAll(".nav-link").forEach(l => l.classList.remove("active"));

  // Activar página y link
  const page = document.getElementById("page-" + id);
  if (page) page.classList.add("active");
  const link = document.querySelector(`.nav-link[data-page="${id}"]`);
  if (link) link.classList.add("active");

  // Topbar
  const meta = PAGE_META[id] || {};
  document.getElementById("pageTitle").textContent = meta.title || id;
  document.getElementById("pageSub").textContent   = meta.sub   || "";

  // Cargar datos según página
  if (id === "dashboard") { loadUIDs(); renderDashboardActivity(); }
  if (id === "uids")      { loadUIDs(); }
  if (id === "admins")    { renderAdminList(); }
}

/* ════════════════════════════════════════════════
   UIDs
════════════════════════════════════════════════ */
async function loadUIDs() {
  const list = document.getElementById("uidList");
  if (!list) return;

  list.innerHTML = `<tr><td colspan="6" class="loading-cell"><span class="spinner"></span>Cargando licencias…</td></tr>`;

  let data;
  try {
    const res = await fetch(API_URL);
    data = await res.json();
  } catch {
    list.innerHTML = `<tr><td colspan="6" class="loading-cell" style="color:var(--red)">⚠ No se pudo conectar con la API</td></tr>`;
    return;
  }

  const users  = data.users || {};
  const entries = Object.entries(users);

  let total = 0, active = 0, expired = 0;
  list.innerHTML = "";

  if (entries.length === 0) {
    list.innerHTML = `
      <tr><td colspan="6">
        <div class="empty-state">
          <div class="empty-state__icon">📭</div>
          <div class="empty-state__text">No hay UIDs registrados aún</div>
        </div>
      </td></tr>`;
  } else {
    entries.forEach(([uid, info]) => {
      total++;
      const isExpired = info.daysRemaining !== null && info.daysRemaining <= 0;
      if (isExpired) expired++; else active++;

      const expText = info.expiresAt
        ? new Date(info.expiresAt).toLocaleString("es", { dateStyle: "short", timeStyle: "short" })
        : "Sin expiración";

      let badge;
      if (info.daysRemaining === null) {
        badge = `<span class="badge badge--infinite">∞ Permanente</span>`;
      } else if (isExpired) {
        badge = `<span class="badge badge--expired">Expirado</span>`;
      } else {
        badge = `<span class="badge badge--active">${info.daysRemaining}d restantes</span>`;
      }

      // Metadata de autor
      const meta      = getUIDMeta(uid);
      const addedAt   = meta ? new Date(meta.addedAt).toLocaleString("es", { dateStyle: "short", timeStyle: "short" }) : "—";
      let authorHTML  = `<span class="no-perm">—</span>`;

      if (meta) {
        const allUsers = getUsers();
        const u        = allUsers[meta.username];
        const color    = u ? u.color : "#6b7280";
        const ini      = meta.addedBy.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
        authorHTML = `
          <div class="author-cell">
            <div class="author-avatar" style="background:${color}22;color:${color};border:1.5px solid ${color}44">${ini}</div>
            <span class="author-name">${meta.addedBy}</span>
          </div>`;
      }

      // Permiso para eliminar: superadmin puede todo; admin solo sus propios UIDs
      const canDelete = session.role === "superadmin" ||
                        (meta && meta.username === session.username);

      const actionHTML = canDelete
        ? `<button class="btn-del" onclick="deleteUID('${uid}')">Eliminar</button>`
        : `<span class="no-perm">Sin permiso</span>`;

      list.innerHTML += `
        <tr>
          <td class="td-uid">${uid}</td>
          <td class="td-date">${expText}</td>
          <td>${badge}</td>
          <td>${authorHTML}</td>
          <td class="td-date">${addedAt}</td>
          <td>${actionHTML}</td>
        </tr>`;
    });
  }

  // Contadores
  document.getElementById("totalCount").textContent  = total;
  document.getElementById("activeCount").textContent = active;
  document.getElementById("expiredCount").textContent= expired;
  const countEl = document.getElementById("uidCount");
  if (countEl) countEl.textContent = `${total} registro${total !== 1 ? "s" : ""}`;
}

/* ── Agregar UID ── */
async function addUID() {
  const uidInput  = document.getElementById("newUID");
  const daysInput = document.getElementById("days");
  const uid  = uidInput.value.trim();
  const days = parseInt(daysInput.value, 10);

  if (!uid)             { showToast("⚠️", "Escribe un UID"); return; }
  if (!days || days < 1){ showToast("⚠️", "Indica un número de días válido"); return; }

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uid, value: "1", days })
    });

    if (!res.ok) throw new Error("API error");

    // Guardar metadata de autor
    saveUIDMeta(uid, {
      username: session.username,
      addedBy:  session.name,
      addedAt:  new Date().toISOString()
    });

    // Guardar en actividad
    logActivity("add", uid, session.name);

    uidInput.value  = "";
    daysInput.value = "";
    showToast("✅", `UID <strong>${uid}</strong> registrado`);
    loadUIDs();
    renderDashboardActivity();
  } catch {
    showToast("❌", "Error al registrar el UID");
  }
}

/* ── Eliminar UID ── */
async function deleteUID(uid) {
  if (!confirm(`¿Eliminar el UID "${uid}"? Esta acción no se puede deshacer.`)) return;

  try {
    await fetch(`${API_URL}/${uid}`, { method: "DELETE" });
    removeUIDMeta(uid);
    logActivity("del", uid, session.name);
    showToast("🗑️", `UID ${uid} eliminado`);
    loadUIDs();
    renderDashboardActivity();
  } catch {
    showToast("❌", "Error al eliminar el UID");
  }
}

/* ════════════════════════════════════════════════
   METADATA (localStorage)
════════════════════════════════════════════════ */
function getUIDMeta(uid) {
  try { return JSON.parse(localStorage.getItem("uidmeta:" + uid)); }
  catch { return null; }
}
function saveUIDMeta(uid, meta) {
  localStorage.setItem("uidmeta:" + uid, JSON.stringify(meta));
}
function removeUIDMeta(uid) {
  localStorage.removeItem("uidmeta:" + uid);
}

/* ════════════════════════════════════════════════
   ACTIVIDAD (feed de últimas acciones, localStorage)
════════════════════════════════════════════════ */
const ACTIVITY_KEY = "uidvault_activity";
const MAX_EVENTS   = 20;

function logActivity(type, uid, actor) {
  let log = [];
  try { log = JSON.parse(localStorage.getItem(ACTIVITY_KEY)) || []; } catch {}
  log.unshift({ type, uid, actor, at: new Date().toISOString() });
  log = log.slice(0, MAX_EVENTS);
  localStorage.setItem(ACTIVITY_KEY, JSON.stringify(log));
}

function renderDashboardActivity() {
  const el = document.getElementById("recentActivity");
  if (!el) return;

  let log = [];
  try { log = JSON.parse(localStorage.getItem(ACTIVITY_KEY)) || []; } catch {}

  if (log.length === 0) {
    el.innerHTML = `<p class="activity-empty">Sin actividad registrada aún.</p>`;
    return;
  }

  el.innerHTML = log.slice(0, 10).map(e => {
    const dotCls = e.type === "add" ? "activity-dot--add" : "activity-dot--del";
    const verb   = e.type === "add" ? "registró" : "eliminó";
    const time   = new Date(e.at).toLocaleString("es", { dateStyle: "short", timeStyle: "short" });
    return `
      <div class="activity-item">
        <div class="activity-dot ${dotCls}"></div>
        <div>
          <div class="activity-text">
            <strong>${e.actor}</strong> ${verb} el UID <strong>${e.uid}</strong>
          </div>
          <div class="activity-time">${time}</div>
        </div>
      </div>`;
  }).join("");
}

/* ════════════════════════════════════════════════
   ADMINISTRADORES (solo superadmin)
════════════════════════════════════════════════ */
function renderAdminList() {
  const el = document.getElementById("adminList");
  if (!el) return;

  const users = getUsers();
  el.innerHTML = "";

  Object.entries(users).forEach(([username, u]) => {
    const ini     = u.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
    const roleTag = u.role === "superadmin"
      ? `<span class="role-tag role-tag--super">Super Admin</span>`
      : `<span class="role-tag role-tag--admin">Admin</span>`;

    const delBtn = (u.role !== "superadmin")
      ? `<button class="btn-del" style="font-size:11px;padding:4px 9px" onclick="removeAdmin('${username}')">Quitar</button>`
      : "";

    el.innerHTML += `
      <div class="admin-row">
        <div class="admin-row__avatar" style="background:${u.color}22;color:${u.color};border:1.5px solid ${u.color}44">${ini}</div>
        <div class="admin-row__info">
          <div class="admin-row__name">${u.name}</div>
          <div class="admin-row__user">@${username}</div>
        </div>
        ${roleTag}
        ${delBtn}
      </div>`;
  });
}

function addAdmin() {
  const name = document.getElementById("newAdminName").value.trim();
  const user = document.getElementById("newAdminUser").value.trim();
  const pass = document.getElementById("newAdminPass").value;

  if (!name || !user || !pass) { showToast("⚠️", "Completa todos los campos"); return; }

  const users = getUsers();
  if (users[user]) { showToast("⚠️", "Ese nombre de usuario ya existe"); return; }

  const palette = ["#6777ff","#2dd4a0","#22d3ee","#a78bfa","#f472b6","#fb923c","#38bdf8"];
  users[user] = {
    pass,
    role:  "admin",
    name,
    color: palette[Object.keys(users).length % palette.length]
  };
  saveUsers(users);

  document.getElementById("newAdminName").value = "";
  document.getElementById("newAdminUser").value = "";
  document.getElementById("newAdminPass").value = "";

  showToast("✅", `Administrador <strong>${name}</strong> creado`);
  renderAdminList();
}

function removeAdmin(username) {
  if (!confirm(`¿Eliminar al administrador "${username}"?`)) return;
  const users = getUsers();
  if (users[username].role === "superadmin") { showToast("⚠️", "No puedes eliminar al superadmin"); return; }
  delete users[username];
  saveUsers(users);
  showToast("🗑️", `Admin ${username} eliminado`);
  renderAdminList();
}

/* ════════════════════════════════════════════════
   TOAST
════════════════════════════════════════════════ */
let _toastTimer;
function showToast(icon, msg) {
  const t  = document.getElementById("toast");
  document.getElementById("toastIcon").textContent = icon;
  document.getElementById("toastMsg").innerHTML    = msg;
  t.classList.add("show");
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => t.classList.remove("show"), 3200);
}
