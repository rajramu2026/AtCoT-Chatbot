/* =========================================================================
   Atlantic Coast Tours — simple Gemini chatbot for GitHub Pages
   -------------------------------------------------------------------------
   The browser calls a Google Apps Script Web App. Apps Script securely keeps
   the Gemini key, fetches the Google Sheet for every question and asks the
   genuine Gemini Flash-Lite language model to answer from that fresh data.
   ========================================================================= */

/* ========================================================================
   UPDATE YOUR GOOGLE APPS SCRIPT URL ONLY ON THE LINE BELOW

   1. In Google Apps Script, select Deploy → Manage deployments.
   2. Deploy Code.gs as a Web App.
   3. Copy the Web App URL ending in /exec.
   4. Replace PASTE_YOUR_APPS_SCRIPT_EXEC_URL_HERE below with that URL.

   Do not paste the Code.gs source code here. Paste only the /exec URL.
   ======================================================================== */
const APPS_SCRIPT_WEB_APP_URL =
  "https://script.google.com/macros/s/AKfycbzWq_Wf2yw8O7FsxEmHhuUPQny_cUcFK-rayIrcsnEiCGlv0pZG6Av-GpFaZODhqlI/exec";

const CONFIG = {
  APPS_SCRIPT_URL: APPS_SCRIPT_WEB_APP_URL,

  // Used only to render the visible tour cards. Chat answers are produced by
  // Apps Script, which independently fetches the Sheet for every question.
  SHEET_ID: "1balBGf8QhZ5dc-RCCAPt2kcrcf6m_YRh0HL_r8bBtJw",
  SHEET_GID: "120683740",
  CARD_REFRESH_MINUTES: 5,
  ASSISTANT_NAME: "AtCoT",
};

const photoCache = new Map();

function sheetCsvUrl() {
  const url = new URL(`https://docs.google.com/spreadsheets/d/${CONFIG.SHEET_ID}/export`);
  url.searchParams.set("format", "csv");
  url.searchParams.set("gid", CONFIG.SHEET_GID);
  url.searchParams.set("fresh", String(Date.now()));
  return url.toString();
}

function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }

  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((currentRow) => currentRow.some((cell) => String(cell).trim() !== ""));
}

function normalizeHeader(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function rowsToRecords(rows) {
  if (rows.length < 2) return [];
  const headers = rows[0].map(normalizeHeader);
  return rows.slice(1).map((row) => {
    const record = {};
    headers.forEach((header, index) => {
      record[header] = String(row[index] ?? "").trim();
    });
    return record;
  }).filter((record) => isListed(record.tour_name));
}

function isListed(value) {
  const text = String(value ?? "").trim();
  return text !== "" && text.toLowerCase() !== "nan" && text.toLowerCase() !== "null";
}

/* -------------------------- Live tour cards ----------------------------- */

async function fetchFreshCardRecords() {
  const response = await fetch(sheetCsvUrl(), {
    cache: "no-store",
    headers: {
      "Cache-Control": "no-cache, no-store, max-age=0",
      Pragma: "no-cache",
    },
  });
  if (!response.ok) throw new Error(`Google Sheet returned HTTP ${response.status}`);
  return rowsToRecords(parseCSV(await response.text()));
}

function locationSearchTerm(record) {
  const location = isListed(record.location)
    ? record.location.replace(/,?\s*Co(?:unty)?\.?\s+[^,]+$/i, "").trim()
    : "";
  return [location, "West of Ireland"].filter(Boolean).join(" ");
}

async function fetchPlacePhoto(searchTerm) {
  if (!searchTerm) return null;
  if (photoCache.has(searchTerm)) return photoCache.get(searchTerm);

  try {
    const url = new URL("https://en.wikipedia.org/w/api.php");
    url.searchParams.set("action", "query");
    url.searchParams.set("generator", "search");
    url.searchParams.set("gsrsearch", searchTerm);
    url.searchParams.set("gsrlimit", "1");
    url.searchParams.set("prop", "pageimages");
    url.searchParams.set("pithumbsize", "1000");
    url.searchParams.set("format", "json");
    url.searchParams.set("origin", "*");

    const response = await fetch(url);
    if (!response.ok) throw new Error(`Photo request returned HTTP ${response.status}`);
    const data = await response.json();
    const page = Object.values(data?.query?.pages || {})[0];
    const source = page?.thumbnail?.source || null;
    photoCache.set(searchTerm, source);
    return source;
  } catch (error) {
    console.warn("Decorative photo lookup failed", error);
    photoCache.set(searchTerm, null);
    return null;
  }
}

async function setBackgroundPhoto(elementId, searchTerm) {
  const element = document.getElementById(elementId);
  if (!element) return;
  const source = await fetchPlacePhoto(searchTerm);
  if (source) element.style.backgroundImage = `url("${source}")`;
}

async function renderTourCards() {
  const grid = document.getElementById("tourGrid");
  if (!grid) return;

  try {
    const records = await fetchFreshCardRecords();
    if (!records.length) throw new Error("No tour rows were returned");

    grid.innerHTML = "";
    for (const record of records.slice(0, 6)) {
      const card = document.createElement("div");
      card.className = "tour-card reveal";

      const imageWrap = document.createElement("div");
      imageWrap.className = "tour-img generic";

      const image = document.createElement("img");
      image.className = "tour-photo";
      image.alt = isListed(record.location)
        ? `${record.location} — ${record.tour_name}`
        : record.tour_name;
      image.loading = "lazy";
      imageWrap.appendChild(image);

      if (isListed(record.category)) {
        const badge = document.createElement("span");
        badge.className = "category-badge";
        badge.textContent = record.category;
        imageWrap.appendChild(badge);
      }

      const placeLabel = document.createElement("span");
      placeLabel.className = "place-label";
      placeLabel.textContent = isListed(record.location) ? record.location : "West of Ireland";
      imageWrap.appendChild(placeLabel);

      const heading = document.createElement("h3");
      heading.textContent = record.tour_name;

      const meta = document.createElement("div");
      meta.className = "tour-meta";

      if (isListed(record.price_eur)) {
        const price = document.createElement("span");
        price.className = "meta-price";
        price.textContent = `EUR ${record.price_eur}`;
        meta.appendChild(price);
      }

      if (isListed(record.duration_hours)) {
        const duration = document.createElement("span");
        duration.className = "meta-duration";
        duration.textContent = `${record.duration_hours} hours`;
        meta.appendChild(duration);
      }

      const link = document.createElement("a");
      link.href = "#chat";
      link.className = "tour-link";
      link.textContent = "Ask the AI about this tour →";
      link.addEventListener("click", () => {
        const input = document.getElementById("chatInput");
        if (input) {
          input.value = isListed(record.tour_id)
            ? `Tell me about tour ${record.tour_id}`
            : `Tell me about ${record.tour_name}`;
          input.focus();
        }
      });

      card.append(imageWrap, heading, meta, link);
      grid.appendChild(card);

      fetchPlacePhoto(locationSearchTerm(record)).then((source) => {
        if (source) {
          image.src = source;
          image.classList.add("loaded");
        }
      });
    }

    revealOnScroll();
  } catch (error) {
    console.error("Could not render live tour cards", error);
    grid.innerHTML = '<p class="loading-note">The live tour list is unavailable right now. Please try again shortly.</p>';
  }
}

function revealOnScroll() {
  const targets = document.querySelectorAll(".reveal:not(.revealed)");
  if (!("IntersectionObserver" in window)) {
    targets.forEach((element) => element.classList.add("revealed"));
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("revealed");
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });

  targets.forEach((element) => observer.observe(element));
}

/* ------------------------------- Chat UI -------------------------------- */

const chatMessages = document.getElementById("chatMessages");
const chatForm = document.getElementById("chatForm");
const chatInput = document.getElementById("chatInput");
const sendBtn = document.getElementById("sendBtn");
const chatSuggestions = document.getElementById("chatSuggestions");
const statusLine = document.getElementById("statusLine");

function appendMessage(role, text, metaText = "") {
  const wrap = document.createElement("div");
  wrap.className = `msg ${role === "user" ? "user" : "bot"}`;

  const content = document.createElement("div");
  content.className = "message-content";

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = text;
  content.appendChild(bubble);

  if (metaText && role !== "user") {
    const meta = document.createElement("div");
    meta.className = "message-meta";
    meta.textContent = metaText;
    content.appendChild(meta);
  }

  wrap.appendChild(content);
  chatMessages.appendChild(wrap);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return wrap;
}

function appendTyping() {
  return appendMessage("bot", `${CONFIG.ASSISTANT_NAME} is checking the live Sheet and asking Gemini…`);
}

function setChatStatus(state, text) {
  if (!statusLine) return;
  const color = state === "busy" ? "#f59e0b" : state === "error" ? "#ef4444" : "#4ade80";
  statusLine.innerHTML = `Gemini Flash-Lite · ${text} · <span id="liveDot" style="color:${color}">●</span> live`;
}

function formatFetchTime(isoString) {
  if (!isoString) return "fresh Sheet data used";
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "fresh Sheet data used";
  return `Sheet fetched ${date.toLocaleTimeString("en-IE", {
    timeZone: "Europe/Dublin",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })}`;
}

function appsScriptConfigured() {
  const url = String(CONFIG.APPS_SCRIPT_URL || "").trim();
  return /^https:\/\/script\.google\.com\/macros\/s\/.+\/exec(?:\?.*)?$/.test(url);
}

function askAssistant(question) {
  return new Promise((resolve, reject) => {
    if (!appsScriptConfigured()) {
      reject(new Error("The site owner must paste the deployed Google Apps Script /exec URL into CONFIG.APPS_SCRIPT_URL in app.js."));
      return;
    }

    const callbackName = `__atcot_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement("script");
    let settled = false;

    const cleanup = () => {
      delete window[callbackName];
      script.remove();
    };

    const timer = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error("The live assistant timed out. Please try again."));
    }, 30000);

    window[callbackName] = (data) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      cleanup();

      if (data && data.error) {
        reject(new Error(data.error));
      } else if (!data || !data.reply) {
        reject(new Error("The language model returned no answer."));
      } else if (
        data.liveDataUsed !== true ||
        data.groundingMode !== "Gemini correlation + exact live-file rows"
      ) {
        reject(new Error("Google Apps Script is still running the older chatbot code. Deploy the new Code.gs as a new Web App version."));
      } else {
        resolve(data);
      }
    };

    const url = new URL(CONFIG.APPS_SCRIPT_URL);
    url.searchParams.set("callback", callbackName);
    url.searchParams.set("question", question);
    url.searchParams.set("fresh", String(Date.now()));

    script.async = true;
    script.src = url.toString();
    script.onerror = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      cleanup();
      reject(new Error("Could not reach the Google Apps Script assistant."));
    };

    document.head.appendChild(script);
  });
}

async function handleUserQuestion(question) {
  const cleaned = String(question || "").trim();
  if (!cleaned) return;

  appendMessage("user", cleaned);
  chatInput.value = "";
  sendBtn.disabled = true;
  chatInput.disabled = true;
  setChatStatus("busy", "fetching fresh Sheet data");
  const typing = appendTyping();

  try {
    const data = await askAssistant(cleaned);
    typing.remove();
    appendMessage(
      "bot",
      data.reply,
      `${data.model || "Gemini"} · ${formatFetchTime(data.sheetFetchedAt)} · exact live-file rows`
    );
    setChatStatus("ready", "fresh Sheet per question");

    console.info("Chat verification", {
      provider: data.provider,
      model: data.model,
      sheetFetchedAt: data.sheetFetchedAt,
      liveDataUsed: data.liveDataUsed,
      groundingMode: data.groundingMode,
    });
  } catch (error) {
    console.error(error);
    typing.remove();
    appendMessage("bot", error.message || "Sorry, the assistant is unavailable right now.");
    setChatStatus("error", "temporarily unavailable");
  } finally {
    sendBtn.disabled = false;
    chatInput.disabled = false;
    chatInput.focus();
  }
}

chatForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  handleUserQuestion(chatInput.value);
});

chatSuggestions?.addEventListener("click", (event) => {
  if (event.target.classList.contains("chip")) {
    handleUserQuestion(event.target.textContent);
  }
});

const year = document.getElementById("year");
if (year) year.textContent = new Date().getFullYear();

(async function init() {
  revealOnScroll();
  setBackgroundPhoto("hero", "Wild Atlantic Way Ireland coastline");
  setBackgroundPhoto("about", "West of Ireland landscape");
  await renderTourCards();
  setChatStatus(appsScriptConfigured() ? "ready" : "error", appsScriptConfigured() ? "fresh Sheet per question" : "setup required");
  setInterval(renderTourCards, CONFIG.CARD_REFRESH_MINUTES * 60 * 1000);
})();
