// ============================================================================
// CONFIG — change this to your deployed backend URL before deploying.
// Local testing: http://localhost:8080
// Production:    https://your-backend-domain.com   (behind Nginx/HTTPS)
// ============================================================================
const API_URL = "https://nami-domain.duckdns.org";

const PAGE_SIZE = 10;

// --- element refs ---
const landing      = document.getElementById("landing");
const topbar       = document.getElementById("topbar");
const resultsArea  = document.getElementById("results-area");
const resultsEl    = document.getElementById("results");
const statsEl      = document.getElementById("stats");
const dymEl        = document.getElementById("did-you-mean");
const paginationEl = document.getElementById("pagination");
const messageEl    = document.getElementById("message");

const qLanding = document.getElementById("q");
const qTop     = document.getElementById("q-top");
const historyEl = document.getElementById("history");

// --- search history ("recent voyages"), persisted in localStorage ---
const HISTORY_KEY = "nami_history";
const HISTORY_MAX = 8;

function loadHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; }
  catch { return []; }
}

function saveToHistory(query) {
  let hist = loadHistory().filter(q => q.toLowerCase() !== query.toLowerCase());
  hist.unshift(query);                 // most recent first
  hist = hist.slice(0, HISTORY_MAX);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(hist));
}

function renderHistory() {
  const hist = loadHistory();
  historyEl.textContent = "";
  if (hist.length === 0) { historyEl.classList.add("hidden"); return; }
  historyEl.classList.remove("hidden");

  const label = document.createElement("span");
  label.className = "history-label";
  label.textContent = "⚓ Recent voyages:";
  historyEl.appendChild(label);

  for (const q of hist) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "history-chip";
    chip.textContent = q;              // textContent = XSS-safe
    chip.addEventListener("click", () => { qLanding.value = q; runSearch(q, 0); });
    historyEl.appendChild(chip);
  }
}

// --- state (so pagination knows the current query) ---
let currentQuery = "";
let currentPage  = 0;
let totalPages   = 0;

// --- wire up the two search forms ---
document.getElementById("search-form").addEventListener("submit", (e) => {
  e.preventDefault();
  runSearch(qLanding.value.trim(), 0);
});
document.getElementById("search-form-top").addEventListener("submit", (e) => {
  e.preventDefault();
  runSearch(qTop.value.trim(), 0);
});

// support ?q= in the URL on first load (shareable searches)
window.addEventListener("DOMContentLoaded", () => {
  renderHistory();
  const params = new URLSearchParams(window.location.search);
  const q = params.get("q");
  if (q) { qLanding.value = q; qTop.value = q; runSearch(q, 0); }
});

// browser BACK / FORWARD: re-render the state from history instead of leaving.
// No ?q => go back to the landing (empty) state.
window.addEventListener("popstate", () => {
  const params = new URLSearchParams(window.location.search);
  const q = params.get("q");
  if (q) {
    qLanding.value = q; qTop.value = q;
    runSearch(q, 0, /* fromHistory */ true);
  } else {
    showLanding();
  }
});

function showLanding() {
  landing.classList.remove("hidden");
  topbar.classList.add("hidden");
  resultsArea.classList.add("hidden");
  qLanding.value = "";
  renderHistory();
  qLanding.focus();
}

async function runSearch(query, page, fromHistory = false) {
  if (!query) return;
  currentQuery = query;
  currentPage = page;

  // switch from landing to results layout
  landing.classList.add("hidden");
  topbar.classList.remove("hidden");
  resultsArea.classList.remove("hidden");
  qTop.value = query;

  // push a history entry so the browser BACK button steps back through searches
  // (and eventually to the landing state) instead of leaving the site.
  // Skip pushing when this call came FROM history (back/forward) — else we'd
  // add duplicate entries and break the back button.
  const newUrl = `?q=${encodeURIComponent(query)}`;
  if (!fromHistory && window.location.search !== newUrl) {
    history.pushState({ q: query }, "", newUrl);
  }

  // remember this voyage (only for the first page of a fresh search)
  if (!fromHistory && page === 0) saveToHistory(query);

  showLoading();
  clearResults();

  try {
    const url = `${API_URL}/search?q=${encodeURIComponent(query)}&page=${page}&size=${PAGE_SIZE}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Server returned ${res.status}`);
    const data = await res.json();
    render(data);
  } catch (err) {
    showMessage("Couldn't reach the search server. Is the backend running?");
  }
}

function render(data) {
  clearResults();
  totalPages = data.totalPages || 0;

  // "Did you mean?" banner (only when the backend corrected the query)
  if (data.didYouMean) {
    dymEl.classList.remove("hidden");
    dymEl.textContent = "";

    const label = document.createElement("span");
    label.className = "dym-label";
    label.textContent = "Did you mean ";

    const corrected = document.createElement("a");
    corrected.className = "dym-term";
    corrected.textContent = data.didYouMean;         // textContent = XSS-safe
    corrected.addEventListener("click", () => runSearch(data.didYouMean, 0));

    const q = document.createElement("span");
    q.className = "dym-label";
    q.textContent = " ?";

    const orig = document.createElement("div");
    orig.className = "dym-original";
    orig.textContent = `Showing results for "${data.didYouMean}" instead of "${currentQuery}"`;

    dymEl.append(label, corrected, q, orig);
  } else {
    dymEl.classList.add("hidden");
  }

  const results = data.results || [];
  if (results.length === 0) {
    showMessage(`Uncharted waters — nothing found for "${data.didYouMean || currentQuery}".`);
    paginationEl.classList.add("hidden");
    return;
  }

  // result count line
  statsEl.textContent = `Charted ${data.totalResults.toLocaleString()} destinations`;

  // build each result with textContent (never innerHTML) — XSS-safe by construction
  for (const r of results) {
    const card = document.createElement("div");
    card.className = "result";

    const a = document.createElement("a");
    a.className = "title";
    a.textContent = r.title;
    a.href = r.url;
    a.target = "_blank";          // open Wikipedia in a new tab
    a.rel = "noopener noreferrer";

    const urlDiv = document.createElement("div");
    urlDiv.className = "url";
    urlDiv.textContent = r.url;

    const snippet = document.createElement("div");
    snippet.className = "snippet";
    snippet.textContent = r.snippet || "";

    const score = document.createElement("div");
    score.className = "score";
    score.textContent = `score ${r.score}`;

    card.append(a, urlDiv, snippet, score);
    resultsEl.appendChild(card);
  }

  renderPagination();
  window.scrollTo(0, 0);
}

// Google-style pagination: « Prev  1 2 [3] 4 5 …  Next »
// Shows a window of page numbers around the current page, plus prev/next.
function renderPagination() {
  paginationEl.textContent = "";
  if (totalPages <= 1) { paginationEl.classList.add("hidden"); return; }
  paginationEl.classList.remove("hidden");

  const WINDOW = 2;  // how many page numbers to show on each side of the current one

  const addBtn = (label, targetPage, opts = {}) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    if (opts.current) b.classList.add("current");
    if (opts.disabled) { b.disabled = true; }
    else b.addEventListener("click", () => runSearch(currentQuery, targetPage));
    paginationEl.appendChild(b);
  };

  const addEllipsis = () => {
    const s = document.createElement("span");
    s.className = "ellipsis";
    s.textContent = "…";
    paginationEl.appendChild(s);
  };

  // Prev
  addBtn("‹ Prev", currentPage - 1, { disabled: currentPage === 0 });

  // first page + leading ellipsis
  let start = Math.max(0, currentPage - WINDOW);
  let end   = Math.min(totalPages - 1, currentPage + WINDOW);
  if (start > 0) {
    addBtn("1", 0);
    if (start > 1) addEllipsis();
  }

  // windowed page numbers (1-based labels, 0-based values)
  for (let p = start; p <= end; p++) {
    addBtn(String(p + 1), p, { current: p === currentPage });
  }

  // trailing ellipsis + last page
  if (end < totalPages - 1) {
    if (end < totalPages - 2) addEllipsis();
    addBtn(String(totalPages), totalPages - 1);
  }

  // Next
  addBtn("Next ›", currentPage + 1, { disabled: currentPage >= totalPages - 1 });
}

function clearResults() {
  resultsEl.textContent = "";
  statsEl.textContent = "";
  messageEl.textContent = "";
}

function showMessage(msg) {
  messageEl.textContent = msg;
}

// spinning compass while a search is in flight
function showLoading() {
  messageEl.textContent = "";
  const wrap = document.createElement("div");
  wrap.className = "loading";
  const compass = document.createElement("div");
  compass.className = "compass-spin";
  compass.textContent = "🧭";
  const label = document.createElement("div");
  label.className = "loading-label";
  label.textContent = "Navigating...";
  wrap.append(compass, label);
  messageEl.appendChild(wrap);
}
