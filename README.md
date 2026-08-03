# Atlantic Coast Tours — Live-File Correlation Version

## Guaranteed behavior

For every customer question, the chatbot:

1. Fetches the assigned Google Sheet again.
2. Reads the current headers and rows from that fresh response.
3. Uses Gemini only to understand the wording and correlate the question with matching row IDs.
4. Copies all displayed business information from the matching live spreadsheet rows.
5. Never allows Gemini to invent or change spreadsheet values.

A lookup can use any current header, including:

- Tour ID
- Tour name
- Category
- Location
- Meeting point
- Price
- Duration
- Capacity
- Availability
- Slots this week
- Special offer
- Description

When a lookup identifies a row, the chatbot returns every header and corresponding value for that row. If a value matches multiple rows, all corresponding rows are returned.

The headers are read dynamically. If another column is added to the live Google Sheet, that column will automatically appear in complete-row answers.

## Important meaning of “live file”

The source is the assigned online Google Sheet identified in `Code.gs`. The `.xlsx` file uploaded to GitHub is only a static reference copy and cannot reflect live Sheet edits automatically.

To demonstrate a live update:

1. Ask about a row such as `ACT017`.
2. Change one of the ACT017 values in the assigned Google Sheet.
3. Save the Sheet.
4. Ask about ACT017 again.
5. The second answer should show the changed value and a new Sheet-fetch timestamp.

## Installation

### Google Apps Script

1. Open the existing Apps Script project.
2. Replace everything in `Code.gs` with the supplied new `Code.gs`.
3. Save.
4. Confirm Script Properties contain:

```text
GEMINI_API_KEY = your private Google AI Studio key
GEMINI_MODEL = gemini-3.5-flash-lite
```

5. Select **Deploy → Manage deployments**.
6. Edit the current Web App deployment.
7. Under **Version**, select **New version**.
8. Keep:
   - Execute as: **Me**
   - Who has access: **Anyone**
9. Select **Deploy**.

Saving the script without deploying a new version leaves the old chatbot active.

### GitHub Pages

Replace these repository-root files:

```text
app.js
index.html
README.md
```

`styles.css` does not need changing.

The supplied `app.js` already contains the Apps Script URL found in the uploaded version. If a completely new Apps Script deployment gives you a different `/exec` URL, update `CONFIG.APPS_SCRIPT_URL` in `app.js`.

Commit the changes, wait for GitHub Pages to finish deploying, and hard-refresh the page. The supplied `index.html` loads `app.js?v=5` to avoid an older browser-cached copy.

## Correlation tests

### Tour ID to complete row

```text
ACT017
```

Expected: every current header and value from the ACT017 row.

### Tour name to complete row

```text
Aran Islands Sunset Boat Cruise
```

Expected: the same complete ACT017 row.

### Meeting point to corresponding rows

```text
Which tours use Rossaveel Harbour?
```

Expected: every matching row, including the relevant tour IDs and all corresponding current values.

### Category to corresponding rows

```text
Show me the Food Tour category
```

Expected: every row whose Category is Food Tour, with complete row details.

### Price to corresponding rows

```text
Which tours have a price of 45 EUR?
```

Expected: every matching row with complete details.

### Slot count to corresponding rows

```text
Which tours have 6 slots this week?
```

Expected: every row whose `slots_this_week` value is 6.

### Special offer to row

```text
Which tour has the Sunset special?
```

Expected: the complete matching row.

### Live-change test

Change the price, slots, meeting point or offer of a row in the Google Sheet and repeat the same question. The next answer must use the changed value.
