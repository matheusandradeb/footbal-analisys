const DATA_URL = "data/historico_apostas.json";

let allBets = [];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function fmtDate(iso) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function statusBadge(bet) {
  if (bet.status === "green") return `<span class="badge badge-green">Green</span>`;
  if (bet.status === "red") return `<span class="badge badge-red">Red</span>`;
  const overdue = bet.data_jogo && bet.data_jogo < todayISO();
  if (overdue) return `<span class="badge badge-overdue">Pendente (vencido)</span>`;
  return `<span class="badge badge-pendente">Pendente</span>`;
}

function computeStats(bets) {
  const decided = bets.filter((b) => b.status === "green" || b.status === "red");
  const green = decided.filter((b) => b.status === "green").length;
  const red = decided.filter((b) => b.status === "red").length;
  const pendente = bets.length - decided.length;
  const taxa = decided.length ? Math.round((green / decided.length) * 100) : null;
  return { total: bets.length, green, red, pendente, taxa, decidedCount: decided.length };
}

function computeBreakdown(bets) {
  const groups = {};
  bets.forEach((b) => {
    if (b.status !== "green" && b.status !== "red") return;
    const key = b.mercado || "Sem mercado";
    groups[key] = groups[key] || { green: 0, red: 0 };
    groups[key][b.status] += 1;
  });
  return Object.entries(groups)
    .map(([mercado, v]) => {
      const total = v.green + v.red;
      const rate = total ? Math.round((v.green / total) * 100) : 0;
      return { mercado, ...v, total, rate };
    })
    .sort((a, b) => b.total - a.total);
}

function renderStats(bets) {
  const s = computeStats(bets);
  document.getElementById("stat-taxa").textContent = s.taxa === null ? "—" : `${s.taxa}%`;
  document.getElementById("stat-taxa-sub").textContent =
    s.decidedCount < 15
      ? `Amostra curta (${s.decidedCount}/15) — calibração ainda aquecendo`
      : `${s.decidedCount} apostas decididas`;
  document.getElementById("stat-green").textContent = s.green;
  document.getElementById("stat-red").textContent = s.red;
  document.getElementById("stat-pendente").textContent = s.pendente;
}

function renderBreakdown(bets) {
  const rows = computeBreakdown(bets);
  const container = document.getElementById("breakdown-grid");
  if (!rows.length) {
    container.innerHTML = `<p class="stat-sub">Ainda sem apostas decididas para mostrar por mercado.</p>`;
    return;
  }
  container.innerHTML = rows
    .map(
      (r) => `
    <div class="breakdown-item">
      <div class="name">${r.mercado}</div>
      <div class="rate">${r.green}G / ${r.red}R — ${r.rate}% de acerto</div>
      <div class="breakdown-bar"><div class="breakdown-bar-fill" style="width:${r.rate}%"></div></div>
    </div>`
    )
    .join("");
}

function renderPendingAlert(bets) {
  const overdue = bets.filter(
    (b) => b.status === "pendente" && b.data_jogo && b.data_jogo < todayISO()
  );
  const banner = document.getElementById("pending-alert");
  const text = document.getElementById("pending-alert-text");
  if (!overdue.length) {
    banner.classList.add("hidden");
    return;
  }
  banner.classList.remove("hidden");
  text.textContent = `⚠ ${overdue.length} aposta(s) com jogo já realizado e resultado ainda não conferido: ${overdue
    .map((b) => b.confronto)
    .join(", ")}. Peça ao agente analista-futebol para verificar.`;
}

function populateFilterOptions(bets) {
  const ligaSel = document.getElementById("filter-liga");
  const mercadoSel = document.getElementById("filter-mercado");
  const ligas = [...new Set(bets.map((b) => b.liga).filter(Boolean))].sort();
  const mercados = [...new Set(bets.map((b) => b.mercado).filter(Boolean))].sort();
  ligas.forEach((l) => {
    const opt = document.createElement("option");
    opt.value = l;
    opt.textContent = l;
    ligaSel.appendChild(opt);
  });
  mercados.forEach((m) => {
    const opt = document.createElement("option");
    opt.value = m;
    opt.textContent = m;
    mercadoSel.appendChild(opt);
  });
}

function currentFilters() {
  return {
    liga: document.getElementById("filter-liga").value,
    mercado: document.getElementById("filter-mercado").value,
    status: document.getElementById("filter-status").value,
  };
}

function applyFilters(bets) {
  const f = currentFilters();
  return bets.filter((b) => {
    if (f.liga && b.liga !== f.liga) return false;
    if (f.mercado && b.mercado !== f.mercado) return false;
    if (f.status && b.status !== f.status) return false;
    return true;
  });
}

function renderTable() {
  const filtered = applyFilters(allBets).sort((a, b) =>
    (b.data_jogo || "").localeCompare(a.data_jogo || "")
  );
  const tbody = document.getElementById("history-tbody");
  const emptyState = document.getElementById("empty-state");
  if (!filtered.length) {
    tbody.innerHTML = "";
    emptyState.classList.remove("hidden");
    return;
  }
  emptyState.classList.add("hidden");
  tbody.innerHTML = filtered
    .map(
      (b) => `
    <tr>
      <td>${fmtDate(b.data_jogo)}</td>
      <td>${b.liga || "—"}</td>
      <td class="confronto">${b.confronto || "—"}</td>
      <td>${b.mercado || "—"}</td>
      <td>${b.jogador || "—"}</td>
      <td>${b.odd_referencia ?? "—"}</td>
      <td>${b.confianca || "—"}</td>
      <td>${statusBadge(b)}</td>
      <td>${b.resultado_real || "—"}</td>
    </tr>`
    )
    .join("");
}

async function loadData() {
  try {
    const res = await fetch(`${DATA_URL}?t=${Date.now()}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    allBets = await res.json();
  } catch (err) {
    document.getElementById("history-tbody").innerHTML = "";
    document.getElementById("empty-state").textContent =
      "Não foi possível carregar o histórico (data/historico_apostas.json). " + err.message;
    document.getElementById("empty-state").classList.remove("hidden");
    allBets = [];
  }
  populateFilterOptions(allBets);
  renderStats(allBets);
  renderBreakdown(allBets);
  renderPendingAlert(allBets);
  renderTable();
  document.getElementById("last-updated").textContent = `Atualizado em ${new Date().toLocaleString("pt-BR")}`;
}

document.getElementById("filter-liga").addEventListener("change", renderTable);
document.getElementById("filter-mercado").addEventListener("change", renderTable);
document.getElementById("filter-status").addEventListener("change", renderTable);
document.getElementById("refresh-btn").addEventListener("click", loadData);

loadData();
