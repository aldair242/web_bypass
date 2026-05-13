const API_URL = "https://uid-worker.bottuser7.workers.dev/uids";

/* =========================
   CARGAR UIDS
========================= */
async function loadUIDs() {
  const res = await fetch(API_URL);
  const data = await res.json();

  const users = data.users || {};
  const list = document.getElementById("uidList");

  list.innerHTML = "";

  let total = 0;
  let active = 0;
  let expired = 0;

  Object.entries(users).forEach(([uid, info]) => {
    total++;

    const isExpired =
      info.daysRemaining !== null && info.daysRemaining <= 0;

    if (isExpired) expired++;
    else active++;

    const expText = info.expiresAt
      ? new Date(info.expiresAt).toLocaleString()
      : "Sin expiración";

    let badge;
    if (info.daysRemaining === null) {
      badge = `<span class="badge active">∞</span>`;
    } else if (isExpired) {
      badge = `<span class="badge expired">Expirado</span>`;
    } else {
      badge = `<span class="badge active">${info.daysRemaining} días</span>`;
    }

    list.innerHTML += `
      <tr>
        <td>${uid}</td>
        <td>${expText}</td>
        <td>${badge}</td>
        <td>
          <button class="btn delete" onclick="deleteUID('${uid}')">
            Eliminar
          </button>
        </td>
      </tr>
    `;
  });

  /* STATS */
  document.getElementById("totalCount").textContent = total;
  document.getElementById("activeCount").textContent = active;
  document.getElementById("expiredCount").textContent = expired;
}

/* =========================
   AGREGAR UID
========================= */
async function addUID() {
  const uidInput = document.getElementById("newUID");
  const daysInput = document.getElementById("days");

  const uid = uidInput.value.trim();
  const days = parseInt(daysInput.value, 10);

  if (!uid) {
    alert("Escribe un UID");
    return;
  }

  if (!days || days <= 0) {
    alert("Días inválidos");
    return;
  }

  await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      uid,
      value: "1",
      days
    })
  });

  uidInput.value = "";
  daysInput.value = "";

  loadUIDs();
}

/* =========================
   ELIMINAR UID
========================= */
async function deleteUID(uid) {
  const ok = confirm(`¿Eliminar UID ${uid}?`);
  if (!ok) return;

  await fetch(`${API_URL}/${uid}`, {
    method: "DELETE"
  });

  loadUIDs();
}

/* =========================
   INIT
========================= */
loadUIDs();
