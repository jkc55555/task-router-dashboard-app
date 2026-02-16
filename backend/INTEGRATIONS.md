# Integrations

This document lists environment-driven integration options and how to add Microsoft Graph / Google Calendar later.

## Environment variables

### Storage (file uploads)

| Variable | Description | Default |
|----------|-------------|--------|
| `STORAGE_PROVIDER` | `local` or `s3` | — |
| `LOCAL_UPLOAD_DIR` | Directory for local uploads (relative to cwd) | `./uploads` |
| `AWS_S3_BUCKET` | S3 bucket name (when using S3) | — |
| `AWS_REGION` | AWS region | — |
| `AWS_ACCESS_KEY_ID` | AWS credentials (optional if using instance role) | — |
| `AWS_SECRET_ACCESS_KEY` | AWS credentials | — |

When `STORAGE_PROVIDER=local`, files are stored on disk and served at `GET /uploads/:key`. For S3, install `@aws-sdk/client-s3` and set the AWS env vars; attachment URLs will point to the bucket.

### Email (future)

| Variable | Description |
|----------|-------------|
| `EMAIL_INTEGRATION` | `none`, `microsoft`, or `google` |
| `MICROSOFT_GRAPH_TENANT_ID` | For Microsoft Graph |
| `MICROSOFT_GRAPH_CLIENT_ID` | For Microsoft Graph |
| `MICROSOFT_GRAPH_CLIENT_SECRET` | For Microsoft Graph |
| `GOOGLE_CLIENT_ID` | For Google |
| `GOOGLE_CLIENT_SECRET` | For Google |

Email is not implemented yet. When added, the connector should post messages to **POST /intake** with `title`, `body`, `source`, and optional `attachments` / `externalId` / `metadata`.

### Calendar

| Variable | Description |
|----------|-------------|
| `CALENDAR_MICROSOFT_ENABLED` | `true` to enable Microsoft Calendar (future) |
| `CALENDAR_GOOGLE_ENABLED` | `true` to enable Google Calendar (future) |
| `GOOGLE_CALENDAR_CLIENT_ID` | For Google Calendar OAuth (future) |
| `GOOGLE_CALENDAR_CLIENT_SECRET` | For Google Calendar OAuth (future) |

**.ics import** is implemented: use **POST /intake/ics** or **POST /calendars/import** with a multipart `.ics` file. Events are stored in `CalendarSource` (kind `ics_import`) and `CalendarEvent`, and merged into the Deadlines API.

## Adding Microsoft Graph or Google Calendar later

1. **OAuth**  
   Use the existing env vars (`MICROSOFT_GRAPH_*` or `GOOGLE_*`) to obtain tokens. Store tokens in a small `IntegrationCredential` (or similar) table keyed by user or tenant.

2. **Sync into this app**  
   - Fetch events from the provider’s API in a cron or background job.
   - For each event, either:
     - Create a `CalendarSource` with kind `microsoft` or `google` and upsert `CalendarEvent` rows (by `externalId`), or
     - Post to **POST /intake** with `source: "microsoft"` or `"google"` and optional `metadata` to create inbox items.  
   The first approach keeps a single calendar model and reuses the existing Deadlines merge.

3. **Webhooks (optional)**  
   Subscribe to provider webhooks and on notification either run a sync or post to **POST /intake** for new items.

4. **Config**  
   `backend/src/lib/intake-config.ts` already exposes `getCalendarIntegrationConfig()`. Extend it to read the new env flags and credentials and gate the sync or webhook routes.

## Canonical intake

**POST /intake** accepts JSON:

- `title` (required)
- `body` (optional)
- `source` (optional, e.g. `manual`, `capture`, `intake`, `microsoft`, `google`)
- `attachments` (optional array of `{ type?, storageKey, url, filename, mimeType?, size? }`)
- `externalId` (optional, for idempotency when implemented)
- `metadata` (optional object)

Use this endpoint for any external system (email, calendar, bots) that should create inbox items. File refs must be created first via **POST /intake/upload** if you have binary attachments.

## Intake API key (optional)

| Variable | Description |
|----------|-------------|
| `INTAKE_API_KEY` | If set, **POST /intake** requires the key in `Authorization: Bearer <key>` or `X-API-Key: <key>`. If unset, intake is unauthenticated. |

Use this to restrict add-on and other intake calls to clients that know the secret. Gmail and Outlook add-ons can send the key via the header; set the same value in Script Properties (Gmail) or in `taskpane.js` (Outlook).

## CORS and email add-ons

| Variable | Description |
|----------|-------------|
| `CORS_ORIGIN` | Comma-separated list of allowed origins for browser requests. |

- **Frontend:** Set to your frontend origin (e.g. `https://your-app.vercel.app`) so the web app can call the API.
- **Outlook add-in:** The add-in taskpane runs in the Outlook client and sends `fetch()` to **POST /intake**. Add the Outlook and taskpane origins to `CORS_ORIGIN`, for example:
  - `https://outlook.office.com`
  - `https://outlook.office365.com`
  - Your taskpane host (e.g. `https://your-app.vercel.app` if the taskpane is served from the same domain as the frontend).

**Gmail add-on:** No CORS change needed; it runs on Google’s servers and calls your backend server-to-server.

See repo `extensions/outlook-addin/README.md` and `extensions/gmail-addon/README.md` for add-on setup.
