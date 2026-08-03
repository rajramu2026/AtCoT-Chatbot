/* Atlantic Coast Tours — resilient GitHub Pages frontend (v9)
   Both tour cards and chatbot questions use the Apps Script Web App.
   This file intentionally avoids template literals, optional chaining and
   decorative third-party photo requests to reduce browser failure points. */

(function () {
  "use strict";

  var APPS_SCRIPT_WEB_APP_URL =
    "https://script.google.com/macros/s/AKfycbxu4sWYZqMcnRecay1NyF5vX-f3oFtSUh6qgQBdkUdzn3-Bt3bXtQV4tMtKEpiaoB44/exec";

  var CONFIG = {
    APPS_SCRIPT_URL: APPS_SCRIPT_WEB_APP_URL,
    CARD_REFRESH_MINUTES: 5,
    ASSISTANT_NAME: "AtCoT"
  };

  var chatMessages = document.getElementById("chatMessages");
  var chatForm = document.getElementById("chatForm");
  var chatInput = document.getElementById("chatInput");
  var sendBtn = document.getElementById("sendBtn");
  var chatSuggestions = document.getElementById("chatSuggestions");
  var statusLine = document.getElementById("statusLine");
  var chatFallback = document.getElementById("chatFallback");

  function cleanText(value) {
    if (value === undefined || value === null) return "";
    return String(value).trim();
  }

  function isListed(value) {
    var text = cleanText(value);
    var lower = text.toLowerCase();
    return text !== "" && lower !== "nan" && lower !== "null";
  }

  function appsScriptConfigured() {
    var url = cleanText(CONFIG.APPS_SCRIPT_URL);
    return /^https:\/\/script\.google\.com\/macros\/s\/.+\/exec(?:\?.*)?$/.test(url);
  }

  function requestAppsScript(parameters) {
    return new Promise(function (resolve, reject) {
      if (!appsScriptConfigured()) {
        reject(new Error("The Google Apps Script Web App URL in app.js is missing or invalid."));
        return;
      }

      var callbackName = "__atcot_" + Date.now() + "_" + Math.random().toString(36).slice(2);
      var script = document.createElement("script");
      var settled = false;

      function cleanup() {
        try {
          delete window[callbackName];
        } catch (ignore) {
          window[callbackName] = undefined;
        }
        if (script.parentNode) script.parentNode.removeChild(script);
      }

      var timer = window.setTimeout(function () {
        if (settled) return;
        settled = true;
        cleanup();
        reject(new Error("The live service did not respond. Confirm the Apps Script Web App is deployed as a new version with access set to Anyone."));
      }, 30000);

      window[callbackName] = function (data) {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        cleanup();

        if (data && data.error) {
          reject(new Error(data.error));
        } else if (!data) {
          reject(new Error("The Apps Script Web App returned no data."));
        } else {
          resolve(data);
        }
      };

      var query = [];
      var key;
      parameters = parameters || {};
      for (key in parameters) {
        if (Object.prototype.hasOwnProperty.call(parameters, key)) {
          query.push(encodeURIComponent(key) + "=" + encodeURIComponent(String(parameters[key])));
        }
      }
      query.push("callback=" + encodeURIComponent(callbackName));
      query.push("fresh=" + encodeURIComponent(String(Date.now())));

      script.async = true;
      script.src = CONFIG.APPS_SCRIPT_URL +
        (CONFIG.APPS_SCRIPT_URL.indexOf("?") === -1 ? "?" : "&") +
        query.join("&");

      script.onerror = function () {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        cleanup();
        reject(new Error("Could not reach Apps Script. Confirm the Web App access is set to Anyone."));
      };

      document.head.appendChild(script);
    });
  }

  function fetchFreshCardRecords() {
    return requestAppsScript({ action: "tours" }).then(function (data) {
      if (
        data.liveDataUsed !== true ||
        data.groundingMode !== "Gemini correlation + exact live-file rows"
      ) {
        throw new Error("Apps Script is running an older Code.gs version. Deploy the supplied Code.gs as a new Web App version.");
      }

      var records = Array.isArray(data.records) ? data.records : [];
      return records.filter(function (record) {
        return record && isListed(record.tour_name);
      });
    });
  }

  function gradientClass(index) {
    var classes = ["cliffs", "connemara", "kylemore", "achill", "slieve", "aran"];
    return classes[index % classes.length];
  }

  function makeElement(tag, className, text) {
    var element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function renderTourCards() {
    var grid = document.getElementById("tourGrid");
    if (!grid) return;

    fetchFreshCardRecords().then(function (records) {
      if (!records.length) throw new Error("No tour rows were returned by the live service.");

      grid.innerHTML = "";
      records.slice(0, 6).forEach(function (record, index) {
        var card = makeElement("article", "tour-card");
        var imageWrap = makeElement("div", "tour-img " + gradientClass(index));

        if (isListed(record.category)) {
          imageWrap.appendChild(makeElement("span", "category-badge", record.category));
        }

        imageWrap.appendChild(
          makeElement(
            "span",
            "place-label",
            isListed(record.location) ? record.location : "West of Ireland"
          )
        );

        var heading = makeElement("h3", "", record.tour_name);
        var meta = makeElement("div", "tour-meta");

        if (isListed(record.price_eur)) {
          meta.appendChild(makeElement("span", "meta-price", "EUR " + record.price_eur));
        }

        if (isListed(record.duration_hours)) {
          meta.appendChild(makeElement("span", "meta-duration", record.duration_hours + " hours"));
        }

        var link = makeElement("a", "tour-link", "Ask the AI about this tour →");
        link.href = "#chat";
        link.addEventListener("click", function () {
          if (!chatInput) return;
          chatInput.value = isListed(record.tour_id)
            ? "Tell me about tour " + record.tour_id
            : "Tell me about " + record.tour_name;
          chatInput.focus();
        });

        card.appendChild(imageWrap);
        card.appendChild(heading);
        card.appendChild(meta);
        card.appendChild(link);
        grid.appendChild(card);
      });

      setChatStatus("ready", "connected to live tour data");
    }).catch(function (error) {
      console.error("Could not render live tour cards", error);
      setChatStatus("error", "live service unavailable");
      grid.innerHTML = "";
      grid.appendChild(
        makeElement(
          "p",
          "loading-note",
          error && error.message ? error.message : "The live tour list is unavailable right now."
        )
      );
    });
  }

  function setChatStatus(state, text) {
    if (!statusLine) return;

    var color = state === "busy" ? "#f59e0b" : state === "error" ? "#ef4444" : "#4ade80";
    statusLine.textContent = "Gemini Flash-Lite · " + text + " · ";

    var dot = document.createElement("span");
    dot.id = "liveDot";
    dot.style.color = color;
    dot.textContent = "●";
    dot.setAttribute("aria-hidden", "true");
    statusLine.appendChild(dot);

    var liveText = document.createTextNode(" live");
    statusLine.appendChild(liveText);
  }

  function initializeChatInterface() {
    if (chatInput) chatInput.disabled = false;
    if (sendBtn) sendBtn.disabled = false;
    if (chatFallback) chatFallback.hidden = true;

    setChatStatus(
      appsScriptConfigured() ? "ready" : "error",
      appsScriptConfigured() ? "ready for your question" : "setup required"
    );
  }

  function appendMessage(role, text, metaText) {
    if (!chatMessages) return null;

    var wrap = makeElement("div", "msg " + (role === "user" ? "user" : "bot"));
    var content = makeElement("div", "message-content");
    var bubble = makeElement("div", "bubble", text);

    content.appendChild(bubble);

    if (metaText && role !== "user") {
      content.appendChild(makeElement("div", "message-meta", metaText));
    }

    wrap.appendChild(content);
    chatMessages.appendChild(wrap);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return wrap;
  }

  function appendTyping() {
    var message = appendMessage("bot", CONFIG.ASSISTANT_NAME + " is checking the live Sheet and asking Gemini…");
    if (message) message.classList.add("typing");
    return message;
  }

  function formatFetchTime(isoString) {
    if (!isoString) return "fresh Sheet data used";
    var date = new Date(isoString);
    if (isNaN(date.getTime())) return "fresh Sheet data used";

    return "Sheet fetched " + date.toLocaleTimeString("en-IE", {
      timeZone: "Europe/Dublin",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
  }

  function askAssistant(question) {
    return requestAppsScript({ action: "chat", question: question }).then(function (data) {
      if (!data.reply) {
        throw new Error("The language model returned no answer.");
      }
      if (
        data.liveDataUsed !== true ||
        data.groundingMode !== "Gemini correlation + exact live-file rows"
      ) {
        throw new Error("Apps Script is running older chatbot code. Replace Code.gs and deploy it as a new Web App version.");
      }
      return data;
    });
  }

  function setChatControlsDisabled(disabled) {
    if (sendBtn) sendBtn.disabled = disabled;
    if (chatInput) chatInput.disabled = disabled;
  }

  function handleUserQuestion(question) {
    var cleaned = cleanText(question);
    if (!cleaned) {
      if (chatInput) chatInput.focus();
      return;
    }

    appendMessage("user", cleaned);
    if (chatInput) chatInput.value = "";
    setChatControlsDisabled(true);
    setChatStatus("busy", "checking fresh Sheet data");

    var typing = appendTyping();

    askAssistant(cleaned).then(function (data) {
      if (typing && typing.parentNode) typing.parentNode.removeChild(typing);
      appendMessage(
        "bot",
        data.reply,
        (data.model || "Gemini") + " · " + formatFetchTime(data.sheetFetchedAt) + " · exact live-file rows"
      );
      setChatStatus("ready", "ready for your next question");
    }).catch(function (error) {
      console.error("Chat request failed", error);
      if (typing && typing.parentNode) typing.parentNode.removeChild(typing);
      appendMessage(
        "bot",
        error && error.message ? error.message : "Sorry, the assistant is unavailable right now."
      );
      setChatStatus("error", "temporarily unavailable");
    }).then(function () {
      setChatControlsDisabled(false);
      if (chatInput) chatInput.focus();
    });
  }

  if (chatForm) {
    chatForm.addEventListener("submit", function (event) {
      event.preventDefault();
      handleUserQuestion(chatInput ? chatInput.value : "");
    });
  }

  if (chatSuggestions) {
    chatSuggestions.addEventListener("click", function (event) {
      var target = event.target;
      if (target && target.classList && target.classList.contains("chip")) {
        handleUserQuestion(target.textContent);
      }
    });
  }

  var year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();

  initializeChatInterface();
  renderTourCards();
  window.setInterval(renderTourCards, CONFIG.CARD_REFRESH_MINUTES * 60 * 1000);
}());
