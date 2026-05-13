/* ============================================================
   UID PRO — Sistema de Roles (Superadmin + Operadores)
   ============================================================ */

const API_URL = "https://uid-worker.bottuser7.workers.dev/uids";

/* ─── ESTADO GLOBAL ─────────────────────────────────── */
let currentUser = null; // { username, role: 'superadmin'|'operator' }
let appUsers = {};      // { username: { pass, role, createdAt } }

/* ─── USUARIOS INICIALES (guardados en localStorage) ─── */
function loadAppUsers() {
  const stored = localStorage.getItem("uid_pro_users");
  if (stored) {
    appUsers = JSON.parse(stored);
  } else {
    // Crear superadmin por defecto
    appUsers = {
      admin: { pass: "admin123", role: "superadmin", createdAt: new Date().toISOString() }
    };
    saveAppUsers();
  }
}

function saveAppUsers() {
  localStorage.setItem("uid_pro_users", JSON.stringify(appUsers));
}

/* ─── LOGIN / LOGOUT ───────────────────────────────── */
function doLogin() {
  const user = document.getElementById("loginUser").value.trim();
  const pass = document.getElementById("loginPass").value;

  if (appUsers[user] && appUsers[user].pass === pass) {
    currentUser = { username: user, role: appUsers[user].role };
    document.getElementById("loginError").classList.add("hidden");
    enterApp();
  } else {
    document.getElementById("loginError").classList.remove("hidden");
  }
}

document.getElementById("loginPass").addEventListener("keydown", e => {
  if (e.key === "Enter") doLogin();
});
document.getElementById("loginUser").addEventListener("keydown", e => {
  if (e.key === "Enter") document.getElementById("loginPass").focus();
});

function doLogout() {
  currentUser = null;
  document.getElementById("appShell").classList.add("hidden");
  document.getElementById("loginScreen").classList.remove("hidden");
  document.getElementById("loginUser").value = "";
  document.getElementById("loginPass").value = "";
}

function enterApp() {
  document.getElementById("loginScreen").classList.add("hidden");
  document.getElementById("appShell").classList.remove("hidden");

  const isSA = currentUser.role === "superadmin";

  // Mostrar nav correcto
  document.getElementById("navSuperadmin").classList.toggle("hidden", !isSA);
  document.getElementById("navOperator").classList.toggle("hidden", isSA);

  // Topbar
  const rolePill = document.getElementById("topbarRole");
  rolePill.textContent = isSA ? "★ Superadmin" : "Operador";
  rolePill.className = "pill " + (isSA ? "role-sa" : "role");

  // Sidebar user
  document.getElementById("sidebarUser").textContent = `@${currentUser.username}`;

  // Default view
  const defaultView = isSA ? "dashboard-sa" : "operator-view";
  activateView(defaultView);
  setTopbarTitle(defaultView);

  if (isSA) {
    refreshSuperadminDashboard();
  } else {
    loadMyUIDs();
  }
}

/* ─── NAVEGACIÓN ────────────────────────────────────── */
function switchView(el) {
  document.querySelectorAll(".nav-item").forEach(a => a.classList.remove("active"));
  el.classList.add("active");

  const view = el.dataset.view;
  activateView(view);
  setTopbarTitle(view);

  if (view === "dashboard-sa") refreshSuperadminDashboard();
  if (view === "users-view") renderUsersList();
  if (view === "all-uids-view") loadAllUIDs();
  if (view === "operator-view") loadMyUIDs();
}

function activateView(viewId) {
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  const el = document.getElementById(viewId);
  if (el) el.classList.add("active");
}

const VIEW_TITLES = {
  "dashboard-sa": "Dashboard",
  "users-view": "Gestión de Usuarios",
  "all-uids-view": "Todos los UIDs",
  "operator-view": "Mis UIDs"
};
function setTopbarTitle(view) {
  document.getElementById("topbarTitle").textContent = VIEW_TITLES[view] || view;
}

/* ─── API HELPERS ──────────────────────────────────── */
async function apiGet() {
  const res = await fetch(API_URL);
  const data = await res.json();
  return data.users || {};
}

async function apiAdd(uid, days) {
  await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uid, value: "1", days })
  });
}

async function apiDelete(uid) {
  await fetch(`${API_URL}/${uid}`, { method: "DELETE" });
}

/* ─── UID META (quién agregó cada uid) ─────────────── */
function getUIDMeta() {
  const stored = localStorage.getItem("uid_pro_meta");
  return stored ? JSON.parse(stored) : {};
}

function setUIDMeta(uid, owner) {
  const meta = getUIDMeta();
  meta[uid] = { owner, addedAt: new Date().toISOString() };
  localStorage.setItem("uid_pro_meta", JSON.stringify(meta));
}

function removeUIDMeta(uid) {
  const meta = getUIDMeta();
  delete meta[uid];
  localStorage.setItem("uid_pro_meta", JSON.stringify(meta));
}

/* ─── SUPERADMIN: DASHBOARD ────────────────────────── */
async function refreshSuperadminDashboard() {
  const users = appUsers;
  const operators = Object.entries(users).filter(([, u]) => u.role !== "superadmin");
  document.getElementById("sa-totalUsers").textContent = operators.length;

  const allUIDs = await apiGet();
  const meta = getUIDMeta();
  let active = 0, expired = 0;

  Object.entries(allUIDs).forEach(([, info]) => {
    if (info.daysRemaining !== null && info.daysRemaining <= 0) expired++;
    else active++;
  });

  document.getElementById("sa-activeUIDs").textContent = active;
  document.getElementById("sa-expiredUIDs").textContent = expired;
  document.getElementById("sa-totalUIDs").textContent = Object.keys(allUIDs).length;

  // Operator summary
  const tbody = document.getElementById("sa-operatorSummary");
  const uidsByOwner = {};
  Object.entries(allUIDs).forEach(([uid]) => {
    const owner = meta[uid]?.owner || "—";
    uidsByOwner[owner] = (uidsByOwner[owner] || 0) + 1;
  });

  const allAccounts = Object.entries(users);
  tbody.innerHTML = allAccounts.map(([name, info]) => `
    <tr>
      <td><span class="uid-code">${name}</span></td>
      <td><span class="badge ${info.role === 'superadmin' ? 'role-sa' : 'role-op'}">${info.role === 'superadmin' ? '★ Superadmin' : 'Operador'}</span></td>
      <td>${uidsByOwner[name] || 0}</td>
      <td><span class="badge active">Activo</span></td>
    </tr>
  `).join("") || `<tr><td colspan="4" style="color:var(--muted);font-size:13px">Sin usuarios</td></tr>`;
}

/* ─── SUPERADMIN: CREAR OPERADOR ───────────────────── */
function createOperator() {
  const username = document.getElementById("newUserName").value.trim();
  const pass     = document.getElementById("newUserPass").value.trim();

  if (!username || !pass) return toast("Completa todos los campos", "error");
  if (appUsers[username]) return toast("Ese usuario ya existe", "error");
  if (pass.length < 4) return toast("Contraseña muy corta (mín. 4 chars)", "error");

  appUsers[username] = { pass, role: "operator", createdAt: new Date().toISOString() };
  saveAppUsers();

  document.getElementById("newUserName").value = "";
  document.getElementById("newUserPass").value = "";

  toast(`Operador @${username} creado`, "success");
  renderUsersList();
}

/* ─── SUPERADMIN: LISTA DE USUARIOS ────────────────── */
function renderUsersList() {
  const tbody = document.getElementById("usersList");
  tbody.innerHTML = Object.entries(appUsers).map(([name, info]) => {
    const isSA = info.role === "superadmin";
    const date = new Date(info.createdAt).toLocaleDateString("es-PE");
    const actions = isSA
      ? `<span style="color:var(--muted);font-size:12px">—</span>`
      : `
        <div class="actions-cell">
          <button class="btn warning" onclick="resetPass('${name}')">Cambiar pass</button>
          <button class="btn delete" onclick="deleteOperator('${name}')">Eliminar</button>
        </div>`;
    return `
      <tr>
        <td><span class="uid-code">${name}</span></td>
        <td><span class="badge ${isSA ? 'role-sa' : 'role-op'}">${isSA ? '★ Superadmin' : 'Operador'}</span></td>
        <td style="color:var(--muted);font-family:var(--mono);font-size:13px">${date}</td>
        <td>${actions}</td>
      </tr>`;
  }).join("");
}

function deleteOperator(username) {
  if (!confirm(`¿Eliminar operador @${username}? Sus UIDs permanecerán.`)) return;
  delete appUsers[username];
  saveAppUsers();
  toast(`Operador @${username} eliminado`, "success");
  renderUsersList();
  refreshSuperadminDashboard();
}

function resetPass(username) {
  showModal(username);
}

/* ─── MODAL CAMBIO CONTRASEÑA ──────────────────────── */
function showModal(username) {
  const modal = document.createElement("div");
  modal.className = "modal-overlay";
  modal.id = "passModal";
  modal.innerHTML = `
    <div class="modal">
      <h3>Cambiar contraseña — @${username}</h3>
      <div class="form-group">
        <label>Nueva contraseña</label>
        <input id="modalPass" type="password" placeholder="Mín. 4 caracteres"/>
      </div>
      <div class="modal-actions">
        <button class="btn secondary" onclick="closeModal()">Cancelar</button>
        <button class="btn primary" onclick="confirmPassChange('${username}')">Guardar</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  setTimeout(() => document.getElementById("modalPass")?.focus(), 100);
}

function closeModal() {
  document.getElementById("passModal")?.remove();
}

function confirmPassChange(username) {
  const pass = document.getElementById("modalPass").value.trim();
  if (pass.length < 4) return toast("Contraseña muy corta", "error");
  appUsers[username].pass = pass;
  saveAppUsers();
  closeModal();
  toast(`Contraseña de @${username} actualizada`, "success");
}

/* ─── SUPERADMIN: TODOS LOS UIDS ───────────────────── */
async function loadAllUIDs() {
  const allUIDs = await apiGet();
  const meta = getUIDMeta();
  let total = 0, active = 0, expired = 0;
  const rows = [];

  Object.entries(allUIDs).forEach(([uid, info]) => {
    total++;
    const isExpired = info.daysRemaining !== null && info.daysRemaining <= 0;
    if (isExpired) expired++; else active++;

    const expText = info.expiresAt ? new Date(info.expiresAt).toLocaleDateString("es-PE") : "Sin expiración";
    const owner = meta[uid]?.owner || "—";
    let badge = info.daysRemaining === null
      ? `<span class="badge active">∞</span>`
      : isExpired
        ? `<span class="badge expired">Expirado</span>`
        : `<span class="badge active">${info.daysRemaining}d</span>`;

    rows.push(`
      <tr>
        <td><span class="uid-code">${uid}</span></td>
        <td style="color:var(--muted);font-family:var(--mono);font-size:12px">${owner}</td>
        <td style="color:var(--muted);font-size:13px">${expText}</td>
        <td>${badge}</td>
        <td>
          <button class="btn delete" onclick="saDeleteUID('${uid}')">Eliminar</button>
        </td>
      </tr>`);
  });

  document.getElementById("all-total").textContent = total;
  document.getElementById("all-active").textContent = active;
  document.getElementById("all-expired").textContent = expired;
  document.getElementById("allUIDsList").innerHTML = rows.join("") ||
    `<tr><td colspan="5" style="color:var(--muted);font-size:13px;padding:20px 0">Sin UIDs registrados</td></tr>`;
}

async function saDeleteUID(uid) {
  if (!confirm(`¿Eliminar UID ${uid}?`)) return;
  await apiDelete(uid);
  removeUIDMeta(uid);
  toast("UID eliminado", "success");
  loadAllUIDs();
}

/* ─── OPERATOR: CARGAR MIS UIDS ───────────────────── */
async function loadMyUIDs() {
  const allUIDs = await apiGet();
  const meta = getUIDMeta();
  const myUID = currentUser.username;

  const myEntries = Object.entries(allUIDs).filter(([uid]) =>
    meta[uid]?.owner === myUID
  );

  let total = 0, active = 0, expired = 0;
  const rows = [];

  myEntries.forEach(([uid, info]) => {
    total++;
    const isExpired = info.daysRemaining !== null && info.daysRemaining <= 0;
    if (isExpired) expired++; else active++;

    const expText = info.expiresAt ? new Date(info.expiresAt).toLocaleDateString("es-PE") : "Sin expiración";
    let badge = info.daysRemaining === null
      ? `<span class="badge active">∞</span>`
      : isExpired
        ? `<span class="badge expired">Expirado</span>`
        : `<span class="badge active">${info.daysRemaining} días</span>`;

    rows.push(`
      <tr>
        <td><span class="uid-code">${uid}</span></td>
        <td style="color:var(--muted);font-size:13px">${expText}</td>
        <td>${badge}</td>
        <td>
          <button class="btn delete" onclick="deleteMyUID('${uid}')">Eliminar</button>
        </td>
      </tr>`);
  });

  document.getElementById("op-total").textContent = total;
  document.getElementById("op-active").textContent = active;
  document.getElementById("op-expired").textContent = expired;
  document.getElementById("uidList").innerHTML = rows.join("") ||
    `<tr><td colspan="4" style="color:var(--muted);font-size:13px;padding:20px 0">No has registrado UIDs aún</td></tr>`;
}

/* ─── OPERATOR: AGREGAR UID ────────────────────────── */
async function addUID() {
  const uidInput  = document.getElementById("newUID");
  const daysInput = document.getElementById("days");
  const uid  = uidInput.value.trim();
  const days = parseInt(daysInput.value, 10);

  if (!uid)           return toast("Escribe un UID", "error");
  if (!days || days <= 0) return toast("Días inválidos", "error");

  await apiAdd(uid, days);
  setUIDMeta(uid, currentUser.username);

  uidInput.value  = "";
  daysInput.value = "";

  toast(`UID ${uid} agregado`, "success");
  loadMyUIDs();
}

/* ─── OPERATOR: ELIMINAR UID ───────────────────────── */
async function deleteMyUID(uid) {
  if (!confirm(`¿Eliminar UID ${uid}?`)) return;
  await apiDelete(uid);
  removeUIDMeta(uid);
  toast("UID eliminado", "success");
  loadMyUIDs();
}

/* ─── TOAST ────────────────────────────────────────── */
function toast(msg, type = "success") {
  const t = document.createElement("div");
  t.className = `toast ${type}`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

/* ─── INIT ─────────────────────────────────────────── */
loadAppUsers();
