# GTD Inbox — Gmail Add-on

Add the current email to your GTD app inbox with one click from Gmail.

## Setup

1. **Script Properties** (in Apps Script: Project Settings → Script Properties):
   - `BACKEND_URL` — Your backend base URL (e.g. `https://your-api.railway.app`). No trailing slash.
   - `API_KEY` — (Optional) If your backend validates an API key, set it here. The add-on sends `Authorization: Bearer <API_KEY>`.

2. **Deploy with clasp** (optional, for local development):
   ```bash
   npm install -g @google/clasp
   clasp login
   clasp create --type standalone   # or clone existing scriptId
   clasp push
   clasp deploy
   ```
   Or copy `Code.gs` and `appsscript.json` into a new Apps Script project in the [Apps Script editor](https://script.google.com), set Script Properties, then deploy as a test or production add-on.

## Behavior

- When the user opens an email in Gmail, the add-on shows a card with **Add to GTD Inbox**.
- On click, the add-on POSTs to `POST /intake` with `title` (subject), `body` (plain text), `source: "gmail"`, and optional `metadata` (messageId, threadId, webLink).
- Success: notification "Added to GTD Inbox". The item appears in your app inbox.

## Distribution

- **Testing:** Deploy as "Test deployment" and install for yourself or your org.
- **Production:** Publish to [Google Workspace Marketplace](https://developers.google.com/workspace/marketplace) (review required).

## Backend

The backend must expose **POST /intake** (see repo root `backend/INTEGRATIONS.md`). No CORS change is needed; the add-on runs on Google's servers and calls your API server-to-server.
