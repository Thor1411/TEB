# PDF Editor Web Application

A full-stack PDF editor built with React and Node.js. Upload PDFs, add text, draw shapes, and download your edited documents. Also includes quick conversion tools to convert PDFs to images and images to PDF.

## Project Structure

```
TEB/
├── frontend/          # React + Vite application
│   ├── src/
│   │   ├── components/
│   │   │   ├── PDFEditor.jsx
│   │   │   ├── PDFViewer.jsx
│   │   │   └── Toolbar.jsx
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── package.json
│   └── vite.config.js
│
├── backend/           # Node.js Express server
│   ├── server.js
│   └── package.json
│
└── README.md
```

## Features

- Upload PDF files
- Add text to PDFs
- Draw rectangles on PDFs
- Navigate between pages
- Download edited PDFs
- Convert PDF to images (PNG format, downloaded as ZIP)
- Convert multiple images to PDF
- Modern, responsive UI

### Security Additions (Platform Mode)

This project now supports a more secure, server-mediated workflow designed to reduce common PDF tool risks:

- **Authenticated access (JWT)**: basic login gate for API calls.
- **Sanitization (active content removal)**: uploaded PDFs are sanitized server-side via **rasterize → rebuild**, removing JavaScript/actions/embedded files/links by design.
- **Encrypted storage at rest**: sanitized PDFs are stored encrypted in a local vault directory.
- **Secure redaction**: filled rectangles can be burned into the PDF server-side to prevent “overlay-only” redactions.
- **Audit logging (tamper-evident)**: append-only audit logs per document with a hash chain.
- **Controlled sharing (expiring token)**: time-limited share links to download a document.
- **Integrity signatures (platform-level)**: the platform can sign and verify document byte hashes (note: not an embedded PAdES signature yet).
- **Embedded PDF signatures (PKCS#12)**: optional endpoint to create a real, embedded (in-document) signature using `@signpdf`.

## Git Notes (Repo Git vs “PDF Git”)

There are **two different things** called “git” in this project:

- **Repo Git (normal `git`)** tracks source code changes in this folder.
- **PDF Git (TEB feature)** stores a version-history object *inside the PDF itself* as an **embedded attachment** named `teb-git.json`.

### Why `git status` may “not show my changes”

The backend stores encrypted PDFs + audit/meta files under `backend/secure_storage/`.
That directory is **intentionally git-ignored** via `backend/.gitignore`:

- If you edit files under `backend/secure_storage/`, repo git will not show them.
- To confirm, you can run `git status --ignored`.

### Why external PDF editors “remove PDF Git info”

PDF Git is embedded using PDF **attachments** (`EmbeddedFiles`). Many PDF editors/viewers:

- rewrite PDFs on save,
- drop unknown attachments/metadata,
- or do “Save As” that rebuilds the file structure.

So after editing in a different PDF editor, it’s normal for `teb-git.json` to disappear.

### Recommended workflow (backup + restore)

If you *must* edit in an external editor, do this:

1. **Extract** the embedded git metadata *before* external editing:
   - `cd backend`
   - `npm run pdfgit:extract -- /path/to/input.pdf /path/to/teb-git.json`
2. Edit the PDF in your external editor and save it.
3. **Re-embed** the metadata into the edited PDF:
   - `cd backend`
   - `npm run pdfgit:embed -- /path/to/edited.pdf /path/to/teb-git.json /path/to/edited-with-git.pdf`

If the external editor already stripped the metadata and you didn’t extract it first, the history cannot be recovered from the PDF alone.

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm
- poppler-utils (for PDF to image conversion)
- qpdf (for structural PDF validation)
- Optional: Docker (recommended) to run poppler/qpdf in an isolated sandbox

### Installation

1. **Install Frontend Dependencies**
   ```bash
   cd frontend
   npm install
   ```

2. **Install Backend Dependencies**
   ```bash
   cd backend
   npm install
   ```

### Running the Application

1. **Start the Backend Server** (Terminal 1)
   ```bash
   cd backend
   npm start
   ```
   Backend will run on `http://localhost:5000`

2. **Start the Frontend Development Server** (Terminal 2)
   ```bash
   cd frontend
   npm run dev
   ```
   Frontend will run on `http://localhost:3000`

3. Open your browser and navigate to `http://localhost:3000`

### Login

Default demo credentials:

- Username: `admin`
- Password: `admin123`

You can override the admin password with `DEFAULT_ADMIN_PASSWORD`.

## Environment Variables (Backend)

Tip: copy [backend/.env.example](backend/.env.example) to `backend/.env` for an easy local setup.

Recommended for repeatable demos:

- `JWT_SECRET` (required for stable tokens across restarts)
- `MASTER_KEY` (32 bytes, base64 or 64-hex; required for decrypting vault docs across restarts)
- `SHARE_SECRET` (HMAC secret for share links)

Database:

- `MONGODB_URI` (optional; when set, user/doc/audit metadata is stored in MongoDB)

Sandboxing (recommended):

- `SANDBOX_DOCKER` (default `1`; set to `0` to force local tool execution)
- `SANDBOX_IMAGE` (default `secure-pdf-sanitizer:latest`)
- `SANDBOX_MEMORY` (default `512m`)
- `SANDBOX_CPUS` (default `1`)
- `SANDBOX_PIDS` (default `128`)
- `DOCKER_AVAILABLE_TTL_MS` (default `30000`; caches the Docker availability probe to reduce per-request overhead)

Embedded signing (PKCS#12):

- `PDF_SIGN_P12_PATH` (path to a `.p12`/`.pfx` on the backend machine)
- `PDF_SIGN_P12_PASSPHRASE` (passphrase for that PKCS#12 file, if set)

Optional limits:

- `MAX_PDF_BYTES` (default 25MB)
- `MAX_IMAGE_BYTES` (default 10MB)
- `MAX_SANITIZE_PAGES` (default 50)
- `PDFTOPPM_TIMEOUT_MS` (default 60000)
- `SANITIZE_DPI` (default 200; increase to 300 for sharper sanitized PDFs, at a CPU/memory cost)
- `SANITIZE_PRESERVE_PAGE_SIZE` (default `1`; set to `0` to skip the extra PDF page-size scan for faster sanitization; output page size will follow rasterized image dimensions)
- `RATE_LIMIT_PER_MINUTE` (default 120)

Validation strictness:

- `REQUIRE_QPDF` (default `0`; set to `1` to fail requests when `qpdf` validation cannot run)

Storage dirs:

- `UPLOAD_DIR` (default `./uploads`)
- `VAULT_DIR` (default `./secure_storage`)
- `WORK_DIR` (default `./uploads/work`)

## Docker Sandbox Setup (Recommended)

Build the sanitizer image:

```bash
docker build -t secure-pdf-sanitizer:latest backend/sanitizer
```

When Docker is available (and `SANDBOX_DOCKER` is not `0`), the backend runs `pdftoppm` and `qpdf` inside this container with:

- no network access
- read-only root filesystem
- all Linux caps dropped
- basic CPU/memory/pids limits

## Technologies Used

### Frontend
- **React** - UI library
- **Vite** - Build tool
- **pdf-lib** - PDF manipulation
- **pdfjs-dist** - PDF rendering

### Backend
- **Express** - Web framework
- **CORS** - Cross-origin resource sharing
- **Multer** - File upload handling
- **pdf-lib** - PDF processing
- **Sharp** - Image processing for conversions
- **Archiver** - Creating ZIP files for image exports

## Usage

### PDF Editing
1. Click "Upload PDF" to select a PDF file
2. Use the toolbar to:
   - Add text: Click "Add Text", enter text, then click on the PDF
   - Draw rectangle: Click "Rectangle", then click on the PDF
   - Navigate pages: Use previous/next buttons
3. Download your edited PDF using the "Download" button

### Quick Conversion Tools
1. **PDF to Images**: Select a PDF file, click "Convert to Images" to download all pages as PNG images in a ZIP file
2. **Images to PDF**: Select one or multiple images (JPG/PNG), click "Convert to PDF" to combine them into a single PDF

### Embedded Signing (Backend)

- Create an embedded signature: `POST /api/documents/:id/sign-embedded`
- Inspect whether a PDF looks embedded-signed: `GET /api/documents/:id/inspect-embedded-signature`

## Development

### Frontend Development
```bash
cd frontend
npm run dev      # Start dev server
npm run build    # Build for production
npm run preview  # Preview production build
```

### Backend Development
```bash
cd backend
npm run dev      # Start with auto-reload (Node 18.11+)
npm start        # Start normally
```

## Build for Production

```bash
# Build frontend
cd frontend
npm run build

# The build output will be in frontend/dist
```

