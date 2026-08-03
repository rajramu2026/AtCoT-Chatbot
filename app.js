/* =========================================================================
   Atlantic Coast Tours — Live Spreadsheet Assistant (GitHub Pages edition)
   -------------------------------------------------------------------------
   This version does NOT put an AI API key in the browser. It reads the live
   Google Sheet directly and answers common customer questions from the exact
   spreadsheet values. This keeps the chatbot working on a static GitHub Pages
   site without an expiring/exposed Gemini credential.
   ========================================================================= */

const CONFIG = {
  SHEET_ID: "1balBGf8QhZ5dc-RCCAPt2kcrcf6m_YRh0HL_r8bBtJw",
  SHEETS: [{ name: "Tours & Pricing", gid: "120683740" }],
  REFRESH_MINUTES: 5,
  BUSINESS_NAME: "Atlantic Coast Tours",
  ASSISTANT_NAME: "AtCoT",
};

let liveData = {
  fetchedAt: null,
  sheetsRaw: {},
  records: [],
  error: null,
};

let conversationState = { lastTour: null };

function sheetCsvUrl(gid) {
  return `https://docs.google.com/spreadsheets/d/${CONFIG.SHEET_ID}/export?format=csv&gid=${gid}`;
}

/** CSV parser that supports quoted commas, quotes and embedded newlines. */
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

  return rows.filter((r) => r.some((cell) => String(cell).trim() !== ""));
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
  }).filter((record) => validValue(record.tour_name));
}

function validValue(value) {
  const text = String(value ?? "").trim();
  return text !== "" && text.toLowerCase() !== "nan" && text.toLowerCase() !== "null";
}

async function fetchLiveData() {
  const allRecords = [];
  liveData.error = null;

  for (const sheet of CONFIG.SHEETS) {
    try {
      const response = await fetch(sheetCsvUrl(sheet.gid), { cache: "no-store" });
      if (!response.ok) throw new Error(`Sheet returned HTTP ${response.status}`);
      const rows = parseCSV(await response.text());
      liveData.sheetsRaw[sheet.name] = rows;
      allRecords.push(...rowsToRecords(rows));
    } catch (error) {
      console.error(`Could not load ${sheet.name}`, error);
      liveData.error = error;
    }
  }

  if (allRecords.length) liveData.records = allRecords;
  liveData.fetchedAt = new Date();
  return liveData;
}

/* ------------------------ Spreadsheet answer engine --------------------- */

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9€£$]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const STOP_WORDS = new Set([
  "a", "an", "and", "are", "about", "any", "at", "be", "can", "could",
  "do", "does", "for", "from", "have", "how", "i", "in", "is", "it",
  "me", "my", "of", "on", "our", "please", "the", "there", "this", "to",
  "tour", "tours", "trip", "what", "when", "where", "which", "with", "you",
]);

function meaningfulTokens(value) {
  return normalizeText(value)
    .split(" ")
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token));
}

function recordSearchText(record) {
  return normalizeText([
    record.tour_name,
    record.category,
    record.location,
    record.meeting_point,
    record.description,
  ].filter(validValue).join(" "));
}

const TOUR_ALIASES = {
  "cliffs of moher": "Cliffs of Moher Guided Cliff Walk",
  "moher": "Cliffs of Moher Guided Cliff Walk",
  "aran islands": "Aran Islands Day Tour (Inis Mor)",
  "inis mor": "Aran Islands Day Tour (Inis Mor)",
  "connemara hike": "Connemara National Park Hike",
  "diamond hill": "Connemara National Park Hike",
  "killary fjord": "Killary Fjord Kayak Adventure",
  "killary kayak": "Killary Fjord Kayak Adventure",
  "galway food": "Galway City Food Tour",
  "sunset cycle": "Wild Atlantic Way Sunset Cycle",
  "achill": "Achill Island Coastal Explorer",
  "croagh patrick": "Croagh Patrick Guided Ascent",
  "inishbofin": "Inishbofin Island Cycle & Ferry",
  "loop head lighthouse": "Loop Head Lighthouse Tour",
  "westport greenway": "Westport Greenway Bike Tour",
  "sea cave kayaking": "Sea Cave Kayaking at Kilkee",
  "salthill": "Salthill Promenade Segway Tour",
  "mweelrea": "Mweelrea Mountain Challenge Hike",
  "kinvara": "Kinvara Kayak & Castle Tour",
  "ballycroy": "Ballycroy Dark Sky Night Walk",
  "spiddal": "Spiddal Coastal Foraging Walk",
  "keem bay": "Keem Bay Cliff & Beach Combo",
};

function findTourByExactName(name) {
  const target = normalizeText(name);
  return liveData.records.find((record) => normalizeText(record.tour_name) === target) || null;
}

function findBestTour(question) {
  const normalizedQuestion = normalizeText(question);

  for (const [alias, tourName] of Object.entries(TOUR_ALIASES)) {
    if (normalizedQuestion.includes(alias)) {
      const aliased = findTourByExactName(tourName);
      if (aliased) return aliased;
    }
  }

  let best = null;
  let bestScore = 0;
  const questionTokens = meaningfulTokens(normalizedQuestion);

  for (const record of liveData.records) {
    const normalizedName = normalizeText(record.tour_name);
    if (normalizedName && normalizedQuestion.includes(normalizedName)) return record;

    const nameTokens = new Set(meaningfulTokens(record.tour_name));
    const fullText = recordSearchText(record);
    let score = 0;

    for (const token of questionTokens) {
      if (nameTokens.has(token)) score += 4;
      else if (fullText.includes(token)) score += 1;
    }

    if (score > bestScore) {
      bestScore = score;
      best = record;
    }
  }

  return bestScore >= 4 ? best : null;
}

function getContextTour(question) {
  const matched = findBestTour(question);
  if (matched) {
    conversationState.lastTour = matched;
    return matched;
  }

  const q = normalizeText(question);
  const refersToPrevious = /\b(it|that|this|the tour|this tour|that tour)\b/.test(q);
  return refersToPrevious ? conversationState.lastTour : null;
}

function formatPrice(record) {
  return validValue(record.price_eur) ? `EUR ${record.price_eur}` : null;
}

function formatDuration(record) {
  return validValue(record.duration_hours) ? `${record.duration_hours} hours` : null;
}

function slotsNumber(record) {
  if (!validValue(record.slots_this_week)) return null;
  const number = Number(record.slots_this_week);
  return Number.isFinite(number) ? number : null;
}

function compactList(items, limit = 8) {
  const shown = items.slice(0, limit);
  const extra = items.length - shown.length;
  return `${shown.join("\n")}${extra > 0 ? `\n…and ${extra} more.` : ""}`;
}

function uniqueCategories() {
  return [...new Set(liveData.records.map((r) => r.category).filter(validValue))];
}

function detectCategory(question) {
  const q = normalizeText(question);
  return uniqueCategories().find((category) => {
    const c = normalizeText(category);
    const singular = c.replace(/s$/, "");
    return q.includes(c) || (singular.length > 3 && q.includes(singular));
  }) || null;
}

const MONTHS = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

function monthInRange(currentMonth, start, end) {
  return start <= end
    ? currentMonth >= start && currentMonth <= end
    : currentMonth >= start || currentMonth <= end;
}

function scheduleCouldIncludeSaturday(availability) {
  const value = normalizeText(availability);
  if (!value) return false;
  if (value.includes("all week") || value.includes("weekend") || value.includes("wed sun")) return true;

  const range = value.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/);
  if (range) {
    return monthInRange(new Date().getMonth(), MONTHS[range[1]], MONTHS[range[2]]);
  }
  return false;
}

function answerForTour(record, question) {
  const q = normalizeText(question);
  const name = record.tour_name;
  const price = formatPrice(record);
  const duration = formatDuration(record);
  const slots = slotsNumber(record);

  if (/\b(price|cost|how much|rate|fee)\b/.test(q)) {
    return price
      ? `${name} is listed at ${price}. Would you like its meeting point, duration or current slots as well?`
      : `I don't have a confirmed price for ${name} in the live tour data.`;
  }

  if (/\b(slot|slots|space|spaces|available|availability|book|booking)\b/.test(q)) {
    const parts = [];
    if (slots !== null) parts.push(`${record.slots_this_week} slots this week`);
    if (validValue(record.availability)) parts.push(`availability listed as “${record.availability}”`);
    return parts.length
      ? `${name} currently shows ${parts.join(" and ")}. For a particular date, please tell me the date so the team can confirm it.`
      : `I don't have confirmed slot information for ${name} in the live tour data.`;
  }

  if (/\b(depart|departure|meet|meeting|pickup|pick up|start|starting point)\b/.test(q)) {
    return validValue(record.meeting_point)
      ? `${name} meets at ${record.meeting_point}.`
      : `I don't have a confirmed meeting point for ${name} in the live tour data.`;
  }

  if (/\b(duration|how long|hours|length)\b/.test(q)) {
    return duration
      ? `${name} is listed as ${duration}.`
      : `I don't have a confirmed duration for ${name} in the live tour data.`;
  }

  if (/\b(where|location|located|area)\b/.test(q)) {
    return validValue(record.location)
      ? `${name} is listed in ${record.location}${validValue(record.meeting_point) ? `, meeting at ${record.meeting_point}` : ""}.`
      : `I don't have a confirmed location for ${name} in the live tour data.`;
  }

  if (/\b(offer|offers|discount|deal|special)\b/.test(q)) {
    return validValue(record.special_offer)
      ? `${name} has this listed offer: ${record.special_offer}.`
      : `There is no special offer listed for ${name} right now.`;
  }

  const details = [];
  if (validValue(record.description)) details.push(record.description);
  if (price) details.push(`Price: ${price}.`);
  if (duration) details.push(`Duration: ${duration}.`);
  if (validValue(record.meeting_point)) details.push(`Meeting point: ${record.meeting_point}.`);
  if (slots !== null) details.push(`Slots this week: ${record.slots_this_week}.`);
  if (validValue(record.special_offer)) details.push(`Offer: ${record.special_offer}.`);
  return `${name}: ${details.join(" ")}`;
}

function answerFromLiveData(question) {
  if (!liveData.records.length) {
    return "I can't access the live tour information right now. Please try again shortly or contact Atlantic Coast Tours directly.";
  }

  const q = normalizeText(question);
  const requestedCategory = detectCategory(question);
  const categoryListRequest = requestedCategory
    && /\b(what|which|list|show|options|any)\b/.test(q)
    && /\b(tour|tours|option|options|activity|activities)\b/.test(q);

  if (!categoryListRequest) {
    const tour = getContextTour(question);
    if (tour) return answerForTour(tour, question);
  }

  if (/^(hi|hello|hey|dia dhuit|good morning|good afternoon|good evening)\b/.test(q)) {
    return "Dia dhuit! I can check live tour names, prices, durations, meeting points, offers and slots from Atlantic Coast Tours. What would you like to know?";
  }

  if (/\b(offer|offers|discount|discounts|deal|deals|special)\b/.test(q)) {
    const offers = liveData.records.filter((record) => validValue(record.special_offer));
    if (!offers.length) return "There are no special offers listed in the live tour data right now.";
    return `These offers are currently listed:\n${compactList(offers.map((record) => `• ${record.tour_name}: ${record.special_offer}`), 10)}`;
  }

  if (/\bsaturday\b/.test(q) && /\b(slot|slots|space|spaces|available|availability|tour|tours)\b/.test(q)) {
    const candidates = liveData.records.filter((record) => {
      const slots = slotsNumber(record);
      return slots !== null && slots > 0 && scheduleCouldIncludeSaturday(record.availability);
    });
    if (!candidates.length) {
      return "I don't have any Saturday-compatible tours with confirmed slots in the live data right now.";
    }
    return `The live sheet shows these Saturday-compatible schedules with slots this week:\n${compactList(candidates.map((record) => `• ${record.tour_name}: ${record.slots_this_week} slots; ${record.availability}`), 10)}\nPlease share the exact Saturday date for final confirmation.`;
  }

  if (/\b(this week|running this week|available this week|slots this week)\b/.test(q)) {
    const available = liveData.records.filter((record) => {
      const slots = slotsNumber(record);
      return slots !== null && slots > 0;
    });
    return available.length
      ? `The live sheet currently shows ${available.length} tours with slots this week. Here are the first ones:\n${compactList(available.map((record) => `• ${record.tour_name}: ${record.slots_this_week} slots`), 10)}`
      : "No tours currently show confirmed slots this week in the live data.";
  }

  const category = requestedCategory;
  if (category) {
    const matches = liveData.records.filter((record) => normalizeText(record.category) === normalizeText(category));
    return matches.length
      ? `${category} options in the live sheet:\n${compactList(matches.map((record) => {
          const price = formatPrice(record);
          const slots = slotsNumber(record);
          return `• ${record.tour_name}${price ? ` — ${price}` : ""}${slots !== null ? `; ${record.slots_this_week} slots this week` : ""}`;
        }), 12)}`
      : `I don't have any ${category} options listed right now.`;
  }

  if (/\b(list|all|what|which|show)\b/.test(q) && /\b(tour|tours|trip|trips|activities|options)\b/.test(q)) {
    return `Atlantic Coast Tours currently lists ${liveData.records.length} tours. Here are the first ones:\n${compactList(liveData.records.map((record) => `• ${record.tour_name} (${record.category})`), 12)}\nAsk me about any tour by name for its exact price, duration, meeting point and slots.`;
  }

  if (/\b(price|cost|how much|depart|departure|meet|meeting|pickup|duration|how long|where|slot|slots|available|availability)\b/.test(q)) {
    return "Which tour do you mean? Please type part of the tour name, such as “Cliffs of Moher”, “Killary Fjord” or “Galway City Food Tour”.";
  }

  if (/\b(contact|phone|email|address)\b/.test(q)) {
    return "I don't have confirmed contact details in the live tour data. Please use Atlantic Coast Tours' official contact channel.";
  }

  return "I can help with Atlantic Coast Tours' live tour list, prices, durations, meeting points, availability, slots and offers. Please ask about a tour or category from the list.";
}

/* ------------------------- Live place photography ----------------------- */

const PLACE_RULES = [
  { words: ["cliffs of moher", "moher"], wiki: "Cliffs of Moher", label: "Cliffs of Moher", css: "cliffs" },
  { words: ["aran", "inis mor", "inis meain"], wiki: "Aran Islands", label: "Aran Islands", css: "aran" },
  { words: ["connemara", "diamond hill", "twelve bens"], wiki: "Connemara National Park", label: "Connemara", css: "connemara" },
  { words: ["killary", "doolough"], wiki: "Killary Harbour", label: "Killary Fjord", css: "fjord" },
  { words: ["galway", "salthill", "spanish arch"], wiki: "Galway", label: "Galway", css: "galway" },
  { words: ["clifden", "sky road"], wiki: "Clifden", label: "Clifden", css: "skyroad" },
  { words: ["achill", "keem"], wiki: "Achill Island", label: "Achill Island", css: "achill" },
  { words: ["croagh patrick"], wiki: "Croagh Patrick", label: "Croagh Patrick", css: "croagh" },
  { words: ["burren", "fanore"], wiki: "The Burren", label: "The Burren", css: "burren" },
  { words: ["loop head", "kilkee"], wiki: "Loop Head", label: "Loop Head", css: "doolin" },
  { words: ["westport"], wiki: "Westport, County Mayo", label: "Westport", css: "westport" },
];

const DEFAULT_PLACE = { wiki: "Wild Atlantic Way", label: "Wild Atlantic Way", css: "generic" };
const photoCache = new Map();

function detectPlace(record) {
  const text = normalizeText(`${record.tour_name} ${record.location} ${record.meeting_point} ${record.description}`);
  return PLACE_RULES.find((place) => place.words.some((word) => text.includes(normalizeText(word)))) || DEFAULT_PLACE;
}

async function fetchPlacePhoto(wikiTitle) {
  if (photoCache.has(wikiTitle)) return photoCache.get(wikiTitle);
  try {
    const url = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(wikiTitle)}&prop=pageimages&format=json&pithumbsize=1000&origin=*`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Photo returned HTTP ${response.status}`);
    const data = await response.json();
    const page = Object.values(data?.query?.pages || {})[0];
    const source = page?.thumbnail?.source || null;
    photoCache.set(wikiTitle, source);
    return source;
  } catch (error) {
    console.warn("Photo lookup failed", wikiTitle, error);
    photoCache.set(wikiTitle, null);
    return null;
  }
}

async function setBackgroundPhoto(elementId, wikiTitle) {
  const element = document.getElementById(elementId);
  if (!element) return;
  const source = await fetchPlacePhoto(wikiTitle);
  if (source) element.style.backgroundImage = `url("${source}")`;
}

async function renderTourCards() {
  const grid = document.getElementById("tourGrid");
  if (!grid) return;

  if (!liveData.records.length) {
    grid.innerHTML = '<p class="loading-note">The live tour list is unavailable right now. Please try again shortly.</p>';
    return;
  }

  grid.innerHTML = "";
  for (const record of liveData.records.slice(0, 6)) {
    const place = detectPlace(record);
    const card = document.createElement("div");
    card.className = "tour-card reveal";

    const imageWrap = document.createElement("div");
    imageWrap.className = `tour-img ${place.css}`;

    const image = document.createElement("img");
    image.className = "tour-photo";
    image.alt = `${place.label} — ${record.tour_name}`;
    image.loading = "lazy";
    imageWrap.appendChild(image);

    if (validValue(record.category)) {
      const badge = document.createElement("span");
      badge.className = "category-badge";
      badge.textContent = record.category;
      imageWrap.appendChild(badge);
    }

    const placeLabel = document.createElement("span");
    placeLabel.className = "place-label";
    placeLabel.textContent = place.label;
    imageWrap.appendChild(placeLabel);

    const heading = document.createElement("h3");
    heading.textContent = record.tour_name;

    const meta = document.createElement("div");
    meta.className = "tour-meta";
    if (formatPrice(record)) {
      const price = document.createElement("span");
      price.className = "meta-price";
      price.textContent = formatPrice(record);
      meta.appendChild(price);
    }
    if (formatDuration(record)) {
      const duration = document.createElement("span");
      duration.className = "meta-duration";
      duration.textContent = formatDuration(record);
      meta.appendChild(duration);
    }

    const link = document.createElement("a");
    link.href = "#chat";
    link.className = "tour-link";
    link.textContent = "Check price & slots →";
    link.addEventListener("click", () => {
      const input = document.getElementById("chatInput");
      if (input) input.value = `Tell me about ${record.tour_name}`;
    });

    card.append(imageWrap, heading, meta, link);
    grid.appendChild(card);

    fetchPlacePhoto(place.wiki).then((source) => {
      if (source) {
        image.src = source;
        image.classList.add("loaded");
      }
    });
  }

  revealOnScroll();
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
const liveDot = document.getElementById("liveDot");

function appendMessage(role, text) {
  const wrap = document.createElement("div");
  wrap.className = `msg ${role === "user" ? "user" : "bot"}`;
  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = text;
  wrap.appendChild(bubble);
  chatMessages.appendChild(wrap);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return wrap;
}

function appendTyping() {
  const wrap = document.createElement("div");
  wrap.className = "msg bot typing";
  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = `${CONFIG.ASSISTANT_NAME} is checking the live tour data…`;
  wrap.appendChild(bubble);
  chatMessages.appendChild(wrap);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return wrap;
}

async function handleUserQuestion(question) {
  const cleaned = String(question || "").trim();
  if (!cleaned) return;

  appendMessage("user", cleaned);
  chatInput.value = "";
  sendBtn.disabled = true;
  const typing = appendTyping();

  try {
    const staleMs = CONFIG.REFRESH_MINUTES * 60 * 1000;
    if (!liveData.fetchedAt || Date.now() - liveData.fetchedAt.getTime() > staleMs) {
      await fetchLiveData();
      await renderTourCards();
    }
    const reply = answerFromLiveData(cleaned);
    typing.remove();
    appendMessage("bot", reply);
  } catch (error) {
    console.error(error);
    typing.remove();
    appendMessage("bot", "Sorry, I can't access the live tour information right now. Please try again shortly or contact Atlantic Coast Tours directly.");
  } finally {
    sendBtn.disabled = false;
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
  liveDot.style.color = "#f59e0b";
  revealOnScroll();
  setBackgroundPhoto("hero", "Cliffs of Moher");
  setBackgroundPhoto("about", "Connemara");
  await fetchLiveData();
  await renderTourCards();
  liveDot.style.color = liveData.records.length ? "#4ade80" : "#ef4444";

  setInterval(async () => {
    await fetchLiveData();
    await renderTourCards();
    liveDot.style.color = liveData.records.length ? "#4ade80" : "#ef4444";
  }, CONFIG.REFRESH_MINUTES * 60 * 1000);
})();
