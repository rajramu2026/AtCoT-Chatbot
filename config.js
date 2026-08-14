/* ============================================================
   CONFIG — the only file you should NEED to edit before deploying.
   ============================================================ */

const CONFIG = {
  // 1) PASTE YOUR ASSIGNED GOOGLE SHEET LINK HERE.
  //    Just use the ordinary link from your browser's address bar while you
  //    have the sheet open (or Share > Copy link) — e.g.
  //      https://docs.google.com/spreadsheets/d/XXXXXXXX/edit#gid=0
  //    No "Publish to web" needed (that requires edit rights you may not
  //    have). Read-only / view access is enough — app.js auto-converts
  //    this into Google's public CSV query endpoint and re-fetches it
  //    fresh (no caching) on every single question.
  //    Requirement: the sheet's sharing setting must be at least
  //    "Anyone with the link — Viewer" (ask whoever assigned it if unsure;
  //    this is usually already the case for a link they sent you).
  SHEET_SOURCE_URL: "https://docs.google.com/spreadsheets/d/1balBGf8QhZ5dc-RCCAPt2kcrcf6m_YRh0HL_r8bBtJw/edit?usp=sharing",

  // 2) Business identity (used in the chat system prompt + UI text).
  BUSINESS_NAME: "Atlantic Coast Tours",
  BUSINESS_BLURB:
    "small-group outdoor tours and boat trips along Ireland's Wild Atlantic Way (Clare, Galway and Mayo)",

  // 3) LLM brain settings — called directly from the browser. The visitor's
  //    own API key is stored only in their browser's localStorage — it is
  //    NEVER written to this repo or sent anywhere except the endpoint below.
  //
  //    DEFAULT = Groq. Groq's API is genuinely free (no credit card needed)
  //    and uses the exact same request format as OpenAI, so no code
  //    changes are needed elsewhere — this really is the "no complicated
  //    stuff" option. Get a free key at https://console.groq.com/keys.
  LLM_PROVIDER: "groq",
  LLM_MODEL: "llama-3.1-8b-instant",
  LLM_ENDPOINT: "https://api.groq.com/openai/v1/chat/completions",

  // --- Prefer OpenAI instead? Comment out the 3 lines above and uncomment
  //     these 3 instead. Note: OpenAI no longer gives free trial credit —
  //     you must add a small prepaid balance (a few cents covers this
  //     whole assignment) at https://platform.openai.com/settings/billing.
  // LLM_PROVIDER: "openai",
  // LLM_MODEL: "gpt-4o-mini",
  // LLM_ENDPOINT: "https://api.openai.com/v1/chat/completions",

  // 4) IMPORTANT FOR SUBMISSION: paste YOUR free Groq key here so the
  //    chatbot works immediately for your lecturer at just the live URL —
  //    no key prompt, no setup on their side, nothing to sign up for.
  //
  //    Get one free at https://console.groq.com/keys (no card needed),
  //    then paste it below, e.g. DEFAULT_API_KEY: "gsk_abc123...".
  //
  //    Trade-off to know about: because this file is public in your GitHub
  //    repo, anyone who looks at the source could see and reuse this key.
  //    With Groq's free tier that's low-risk (no billing — worst case is
  //    someone else eats your free rate limit, not your wallet), which is
  //    why it's fine for a graded class demo. If you're ever worried about
  //    it after submitting, just delete/regenerate the key at the link
  //    above — that instantly disables it everywhere.
  DEFAULT_API_KEY: "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",
};
