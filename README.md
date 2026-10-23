# FileNest: Laravel + React file CRUD

FileNest is a small file-library example built with a Laravel JSON API and a
separate React/Vite interface. It stores uploaded files on Laravel's private
local disk, while SQLite stores the metadata.

## Features

- Create, view, search, filter, and paginate image/document records.
- Register, sign in, and sign out with secure Laravel sessions.
- Keep each account's file list, previews, and downloads private to that account.
- Edit a title or description, or replace the stored upload.
- Preview images and download documents or images.
- Delete a record and its stored file together.
- Validate image and document formats and enforce upload-size limits.
- Show API validation and network errors in the interface.

## Requirements

- PHP 8.3 or newer and Composer.
- Node.js 20.19+ or 22.12+ and npm.
- SQLite (the checked-in Laravel environment example is configured for SQLite).

## Run locally

Open two terminals from the workspace root.

### 1. Prepare Laravel

```powershell
cd backend
composer install
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
php artisan key:generate
if (-not (Test-Path database/database.sqlite)) { New-Item database/database.sqlite -ItemType File }
php artisan migrate
php artisan serve
```

The backend listens on `http://127.0.0.1:8000`. The first migration creates
the `media_files` metadata table; uploaded files are saved under
`backend/storage/app/private/media-files`.

The commands create the environment file and SQLite database only when they
do not already exist, so existing local settings and data are preserved. Check
that `DB_CONNECTION=sqlite` is set in `backend/.env`.

### 2. Run React

In a second terminal:

```powershell
cd frontend
npm install
npm run dev
```

Open the Vite URL shown in the terminal (normally `http://localhost:5173`).
Vite forwards `/api` requests to the Laravel server at `127.0.0.1:8000`.
If Laravel is running on a different address, update the `/api` proxy in
`frontend/vite.config.js`.

## React application architecture

The React client uses React Router for separate `/login`, `/register`, and
protected `/files` pages. Redux Toolkit owns shared authentication and file
library state; the Laravel session cookie remains the source of truth for
authentication and is not copied into browser storage.

```text
frontend/src/
  components/       Route guards and reusable UI components
  pages/            Login, registration, and file-library pages
  services/api.js   JSON, multipart, CSRF, and error handling
  store/
    index.js        Redux store configuration
    slices/         Authentication and file-library state/thunks
  App.jsx           Route definitions and initial session check
  main.jsx          React, router, and Redux providers
```

The API service centralizes same-origin requests and Laravel CSRF headers.
Async thunks in each Redux slice perform API work and store loading, success,
and error state. Page components dispatch those actions and render the state;
the route guards prevent unauthenticated users from entering the file library.

## API reference

All endpoints are prefixed with `/api`; JSON endpoints accept and return JSON.
The React app uses Laravel's session cookie and CSRF token; passwords and
session identifiers are never saved in browser storage.

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/auth/csrf-token` | Public | Start/read the CSRF session token before a form submission |
| `POST` | `/api/auth/register` | Public | Create an account and sign in |
| `POST` | `/api/auth/login` | Public, rate limited | Sign in with email and password |
| `GET` | `/api/auth/user` | Signed in | Return the current account profile |
| `POST` | `/api/auth/logout` | Signed in | Invalidate the current session |

### File endpoints

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/files` | Signed in: list records; optional `type=image|document`, `search`, and `page` query parameters |
| `POST` | `/api/files` | Signed in: create a record using multipart form data |
| `GET` | `/api/files/{id}` | Signed in: read one owned record |
| `POST` + `_method=PUT` or `PUT` | `/api/files/{id}` | Signed in: update an owned record |
| `DELETE` | `/api/files/{id}` | Signed in: delete an owned record and its upload |
| `GET` | `/api/files/{id}/content` | Signed in: display an owned image inline |
| `GET` | `/api/files/{id}/download` | Signed in: download an owned upload |

### Sign-up and sign-in

Open the frontend and choose **Create an account** to register with a name,
email, and password. Passwords must contain at least eight characters and be
confirmed. On later visits, use the sign-in form. The app checks the existing
session when it starts and provides a **Sign out** action.

The browser first requests `/api/auth/csrf-token`, then sends that token in the
`X-CSRF-TOKEN` header for registration, sign-in, sign-out, uploads, edits, and
deletes. Laravel rotates the session ID after sign-in and sign-up, and
invalidates the session on sign-out. Login attempts are rate limited.

For direct API clients, keep cookies between requests and include the CSRF
token from `/api/auth/csrf-token` in the `X-CSRF-TOKEN` header on every
state-changing request. The React app handles this automatically.

The ownership migration keeps any files created before authentication as
unassigned records; they are not visible to any account. Assign existing
records to an account deliberately if they need to be retained in the
authenticated library.

### Create an upload

Send `multipart/form-data`. The file field is named `file`; `type` must be
`image` or `document`. This example assumes you have already authenticated
and have a valid session cookie and CSRF token. Replace the placeholders with
the values from that session; the React app handles this automatically.

```powershell
curl.exe -X POST http://127.0.0.1:8000/api/files `
  -H "Accept: application/json" `
  -H "Cookie: <session-cookie>" `
  -H "X-CSRF-TOKEN: <csrf-token>" `
  -F "title=Project cover" `
  -F "description=Cover art for the project" `
  -F "type=image" `
  -F "file=@C:\path\to\cover.png"
```

The API returns `201 Created` on success. To edit text fields, send
`title` and/or `description`. To replace the upload too, add another
`multipart/form-data` field named `file`. The React client submits edits as
`POST` with `_method=PUT`, which PHP/Laravel reliably parses for multipart
requests. A regular JSON `PUT` can also be used for metadata-only updates.

```powershell
curl.exe -X POST http://127.0.0.1:8000/api/files/1 `
  -H "Accept: application/json" `
  -H "Cookie: <session-cookie>" `
  -H "X-CSRF-TOKEN: <csrf-token>" `
  -F "_method=PUT" `
  -F "title=Approved project cover"
```

Create requires `title`, `type` (`image` or `document`), and `file`.
`description` is optional. Images are limited to JPG, JPEG, PNG, WEBP, or GIF
and 10 MB. Documents are limited to PDF, DOC/DOCX, XLS/XLSX, PPT/PPTX, TXT,
or CSV and 20 MB. Update does not allow changing the record's type; a
replacement must pass the same validation as its existing type.

### Response shape

Paginated list responses include the records in `data`, pagination links in
`links`, pagination details in `meta`, and overall counts in `summary`:

```json
{
  "data": [
    {
      "id": 1,
      "title": "Project cover",
      "description": "Cover art for the project",
      "type": "image",
      "original_name": "cover.png",
      "mime_type": "image/png",
      "size": 24810,
      "content_url": "/api/files/1/content",
      "download_url": "/api/files/1/download"
    }
  ],
  "summary": {
    "total": 1,
    "images": 1,
    "documents": 0
  }
}
```

List responses contain Laravel pagination fields under `meta` and aggregate
image/document counts under `summary`. Record responses expose safe metadata
and relative `content_url` and `download_url` paths; the private storage path
is never returned.

Validation failures return `422 Unprocessable Entity` with an `errors` object.
Missing record IDs or missing stored files return `404 Not Found`.

## Implementation walkthrough

1. `backend/database/migrations/2026_10_23_000000_create_media_files_table.php`
   defines the metadata persisted for each upload. Binary file data is kept
   outside the database to avoid bloating database backups.
2. `backend/app/Models/MediaFile.php` allows only the expected metadata fields
   to be mass assigned. This prevents request data from setting arbitrary
   model attributes.
3. `backend/app/Http/Controllers/Api/MediaFileController.php` validates each
   request, writes files to the private `local` disk, handles CRUD operations,
   and serves content only through API routes. MIME/extension rules and size
   caps are enforced on the server, not just by the browser.
4. `backend/app/Http/Resources/MediaFileResource.php` is the single JSON
   representation of a record. It intentionally leaves out internal storage
   paths and gives the client same-origin URLs.
5. `backend/routes/api.php` maps the collection/resource methods and the
   image-content and download routes. `AuthController` handles session
   registration, login, logout, profile, and CSRF-token requests.
   `backend/bootstrap/app.php` registers these routes with the `/api` prefix.
6. `frontend/src/store/slices/authSlice.js` and `filesSlice.js` keep shared
   authentication/library state and expose async thunks for backend requests.
   `services/api.js` centralizes same-origin and CSRF-aware fetch requests.
7. `frontend/src/pages/` separates the login, registration, and library
   screens. Route guards protect the library, while `App.jsx` defines routes
   and starts the session check. `_method=PUT` handles multipart updates.
8. `frontend/src/App.css` and `frontend/src/index.css` define the responsive
   library layout and accessible focus states. `frontend/vite.config.js`
   proxies API calls during development so the browser uses same-origin paths.
9. `backend/tests/Feature/MediaFileCrudTest.php` verifies the full image CRUD
   flow, rejects a mismatched upload, and checks type/search filters.

### Upload request, step by step

1. The React form creates `FormData`, not JSON, so the browser can transmit
   binary file bytes together with the title, description, and type.
2. The browser's `accept` attribute helps users choose a supported file. It is
   only a convenience: the API independently validates the actual upload and
   enforces format and size limits.
3. Laravel stores the upload on the private `local` disk and generates a
   storage name. Using a generated name avoids trusting a client-supplied
   filename for the storage path.
4. Laravel saves the original filename and other display metadata in SQLite.
   Storing the binary separately keeps the database focused on searchable
   records and allows the storage disk to be changed later.
5. The API resource returns display metadata plus content/download endpoints.
   It does not expose the private storage path, so clients cannot construct
   direct storage URLs.
6. The controller assigns each new record to the authenticated account. List
   queries and record operations enforce ownership so one account cannot
   browse, change, preview, download, or delete another account's uploads.
7. The React page reads the API response and refreshes its listing after a
   successful change. It displays API validation or network errors instead of
   silently treating a failed request as successful.
8. For edits, the client sends `_method=PUT` with multipart `POST` because
   multipart `PUT` parsing is inconsistent in PHP environments. If no new
   file is selected, Laravel keeps the original upload.
9. For deletion, Laravel removes the database row and its stored file. The
   associated feature test checks both sides of that operation.

## Checks

Run focused backend tests:

```powershell
cd backend
php artisan test tests/Feature/MediaFileCrudTest.php
```

Check the frontend build and lint:

```powershell
cd frontend
npm run build
npm run lint
```

## Security before deployment

File CRUD routes require a Laravel-authenticated session and check per-user
ownership; upload data remains on the private storage disk. Registration is
open to any visitor by default, so disable public registration or add an
invitation/approval flow if the application should be private. Configure HTTPS,
secure session-cookie settings, upload quotas, rate limits, and file-retention
and backup policies before deployment. Serve the frontend and API from the
same site (or configure a carefully restricted trusted proxy) so the browser
can send the session cookie and CSRF token securely.
