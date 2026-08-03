# Atlantic Coast Tours — Corrected GitHub Pages Deployment

## Why the current website stopped working

There are two separate problems in the uploaded deployment:

1. The GitHub file is named `app (1).js`, but `index.html` requests `app.js`. Because those filenames are different, the browser does not load the JavaScript. The loading tour-card placeholders therefore remain on the page and the chatbot handlers are not started.
2. The current Apps Script `/exec` deployment redirects unauthenticated visitors to Google sign-in. A public GitHub Pages chatbot cannot use that deployment until Web App access is set to **Anyone**.

The corrected version also loads both the tour cards and chatbot responses through Apps Script. It no longer asks the browser to download the Google Sheet CSV directly.

## Files for GitHub

The repository root must contain these exact filenames:

```text
index.html
styles.css
app.js
README.md
CA2 - Atlantic Coast Tours.xlsx
```

Delete `app (1).js`. Upload the supplied corrected file using the exact name `app.js`.

Do not rename it to `app (1).js`, `app.js.txt`, or any other name.

The Excel file is an unchanged static reference copy. Live website data comes from the assigned online Google Sheet through Apps Script.

## Google Apps Script update

`Code.gs` is installed in Google Apps Script, not in the GitHub repository.

1. Open the Apps Script project.
2. Replace everything in `Code.gs` with the supplied corrected `Code.gs`.
3. Save.
4. Open **Project Settings → Script Properties**.
5. Confirm these properties exist:

```text
GEMINI_API_KEY = your private Gemini API key
GEMINI_MODEL = gemini-3.5-flash-lite
```

6. Select **Deploy → Manage deployments**.
7. Edit the Web App deployment.
8. Select **New version**.
9. Confirm:
   - Execute as: **Me**
   - Who has access: **Anyone**
10. Select **Deploy**.
11. Copy the deployed Web App URL ending in `/exec`.

The supplied `app.js` currently contains the `/exec` URL from the uploaded `app (1).js`. If deployment creates a different URL, update only this line near the top of `app.js`:

```javascript
const APPS_SCRIPT_WEB_APP_URL =
  "PASTE_THE_NEW_EXEC_URL_HERE";
```

## GitHub update

1. Delete `app (1).js` from GitHub.
2. Upload the supplied `app.js` using that exact filename.
3. Replace `index.html` with the supplied version.
4. Keep or replace `styles.css` with the supplied copy.
5. Replace `README.md` with this file.
6. Commit the changes.
7. Wait for GitHub Pages deployment to finish.
8. Hard-refresh the website:
   - Windows: `Ctrl + Shift + R`
   - macOS: `Cmd + Shift + R`

The corrected `index.html` loads `app.js?v=7` and `styles.css?v=7` so browsers do not reuse older cached files. The chat window is now visible by default and no longer depends on a JavaScript animation class. If JavaScript fails, the question box remains visible with a clear loading message instead of disappearing.

## Required tests

### Tour cards

Open the website. The loading cards must be replaced by current live tour cards.

### Chatbot

Ask:

```text
ACT017
```

The answer must return the complete ACT017 row from the current Google Sheet.

### Live update

1. Change an ACT017 value in the online Google Sheet.
2. Save the Sheet.
3. Ask `ACT017` again.
4. The next response must show the changed value and a new Sheet-fetch time.

## If an error remains

- **Apps Script Web App did not respond:** deployment access is not set to Anyone, the deployment is stale, or the `/exec` URL is wrong.
- **Apps Script is running an older Code.gs version:** replace `Code.gs`, save, and deploy a New version.
- **The page still shows Loading live tours:** confirm the repository has `app.js` exactly and that `index.html` contains `<script src="app.js?v=6"></script>`.
