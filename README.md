# Atlantic Coast Tours — GitHub Pages Deployment

This repository contains the public Atlantic Coast Tours website and its live Gemini-powered tour assistant.

## Required GitHub files

Upload these exact filenames to the repository root:

```text
index.html
styles.css
app.js
README.md
```

Delete any duplicate or incorrectly named JavaScript files, especially:

```text
app (1).js
app.js.txt
```

The website must contain exactly one active frontend JavaScript file named `app.js`.

## Current frontend version

The supplied `index.html` loads:

```html
<link rel="stylesheet" href="styles.css?v=9" />
<script src="app.js?v=9"></script>
```

The `v=9` query values force browsers and GitHub Pages to fetch the updated files instead of reusing an older cached copy.

## Apps Script connection

The supplied `app.js` is configured to use this Google Apps Script Web App deployment:

```text
https://script.google.com/macros/s/AKfycbxu4sWYZqMcnRecay1NyF5vX-f3oFtSUh6qgQBdkUdzn3-Bt3bXtQV4tMtKEpiaoB44/exec
```

`Code.gs` belongs in Google Apps Script and must not be uploaded to GitHub.

For the public website to work, deploy the current `Code.gs` as a Web App with:

- **Execute as:** Me
- **Who has access:** Anyone
- **Version:** New version containing the latest saved `Code.gs`

If Apps Script generates a different `/exec` URL, replace only the value of `APPS_SCRIPT_WEB_APP_URL` near the top of `app.js`.

## Live-data behavior

- Tour cards request `action=tours` through Apps Script.
- Chat questions request `action=chat` through Apps Script.
- Apps Script fetches the assigned Google Sheet for every chatbot question.
- Gemini correlates the natural-language question with the appropriate live rows.
- Trusted Apps Script code constructs business answers from exact Sheet values.
- Blank, `NaN`, `null`, and unavailable values are not presented as valid business data.

## Upload instructions

1. Open the GitHub repository.
2. Delete the existing `index.html`, `styles.css`, and `app.js` if necessary.
3. Delete `app (1).js` if it exists.
4. Upload the supplied files using the exact names:
   - `index.html`
   - `styles.css`
   - `app.js`
   - `README.md`
5. Commit the changes.
6. Wait for the GitHub Pages deployment to complete.
7. Hard-refresh the published website:
   - Windows/Linux: `Ctrl + Shift + R`
   - macOS: `Cmd + Shift + R`

Do not paste extra characters before the first line of `app.js`. It must begin with:

```javascript
/* Atlantic Coast Tours
```

It must not begin with `X`, a backtick, or Markdown code-fence characters.

## Required tests

### 1. Interface

- The chatbot question box is visible immediately.
- The input and **Ask AtCoT** button become enabled.
- No JavaScript syntax error appears in the browser console.

### 2. Tour cards

The loading placeholders should be replaced by current tour cards returned through Apps Script.

### 3. Chatbot

Ask:

```text
Tell me about ACT017
```

The answer should use the complete current ACT017 row from the online Google Sheet.

### 4. Fresh update

1. Change a value for ACT017 in the online Google Sheet.
2. Save the Sheet.
3. Ask about ACT017 again.
4. The next answer should show the new value and a new Sheet-fetch time.

## Troubleshooting

### `Unexpected identifier 'Photo'`

An older `app.js` accidentally began with `X` and a backtick. Replace the entire file with the supplied `app.js`. The current version does not use the failing photo-request code or JavaScript template literals.

### `Apps Script is running an older Code.gs version`

Save the latest `Code.gs`, select **Deploy → Manage deployments**, choose **New version**, and deploy again with access set to **Anyone**.

### `The live service did not respond`

Confirm that the Apps Script deployment is public, the `/exec` URL in `app.js` is current, and opening the `/exec` URL in a private browser window does not require Google sign-in.

### Loading cards never disappear

Confirm that GitHub contains a file named exactly `app.js` and that the published page source contains:

```html
<script src="app.js?v=9"></script>
```
