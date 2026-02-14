# GTD Inbox — Outlook Add-in

Add the current email to your GTD app inbox with one click from Outlook (web or desktop).

## Setup

1. **Backend URL and API key**  
   Edit `taskpane.js`: set `BACKEND_URL` to your backend base URL (e.g. `https://your-api.railway.app`). Optionally set `API_KEY` if your backend validates it.

2. **Host the taskpane and manifest**  
   All URLs must be HTTPS in production.

   - **Option A — Next.js app:** Copy `taskpane.html`, `taskpane.js`, and icon images into `frontend/public/addin/`. Serve at `https://your-frontend.vercel.app/addin/taskpane.html`, etc.
   - **Option B — Static host:** Deploy the contents of `extensions/outlook-addin/` (or a `dist/` with built files) to a static host (e.g. Vercel, Netlify) and use that base URL.

3. **Manifest URLs**  
   Replace every `https://localhost:3000` in `manifest.xml` with your taskpane base URL (e.g. `https://your-frontend.vercel.app`). Replace the add-in `<Id>` with a new GUID. Add real icon files (16x16, 32x32, 80x80) and point `icon-16`, `icon-32`, `icon-80` to their URLs.

4. **CORS**  
   The add-in runs in the Outlook client; `fetch()` to your backend is cross-origin. Add the Outlook and taskpane origins to your backend **CORS_ORIGIN** (comma-separated), e.g.:
   - `https://outlook.office.com`
   - `https://outlook.office365.com`
   - Your taskpane origin (e.g. `https://your-frontend.vercel.app`)

## Behavior

- User opens an email in Outlook and clicks **Add to GTD Inbox** in the add-in (or opens the add-in taskpane and clicks the button).
- The taskpane reads `Office.context.mailbox.item` (subject, body), then POSTs to `POST /intake` with `source: "outlook"` and optional `metadata` (itemId, webLink).
- Success: "Added to GTD Inbox" in the taskpane.

## Sideload (testing)

1. In Outlook on the web: Settings → View all Outlook settings → General → Manage add-ins → Add a custom add-in → Add from file → upload your `manifest.xml` (after fixing URLs and hosting the taskpane).
2. On Windows: Use the Office Centralized Deployment or sideload via registry/manifest file as per Microsoft docs.

## Distribution

- **Production:** Publish to [AppSource](https://learn.microsoft.com/en-us/office/dev/store/submit-to-appsource) (validation required).
- **Org-only:** Use Centralized Deployment in the Microsoft 365 admin center.
