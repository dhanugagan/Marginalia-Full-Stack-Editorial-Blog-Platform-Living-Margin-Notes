# Marginalia — Full-Stack Editorial Blog Platform & Living Margin Notes

Marginalia is a full-stack editorial publishing platform built with **React 19**, **TypeScript**, **Tailwind CSS**, **Express**, and **SQLite (`better-sqlite3`)**. It delivers complete user authentication, CRUD post management, nested comments, and a suite of interactive reading and authoring innovations designed around deliberate, calm editorial craftsmanship.

---

## Key Features

### Core Full-Stack Capabilities
- **User Registration, Login & Session Authentication**:
  - Salted password hashing via Node.js `crypto.scryptSync` and timing-safe verification (`crypto.timingSafeEqual`).
  - Signed HMAC-SHA256 session tokens persisted in `HttpOnly; SameSite=Lax` cookies (and supported via `Authorization: Bearer <token>` for API testing).
- **Create, Edit, Draft & Delete Blog Posts**:
  - Full lifecycle management for both `published` essays and private `draft` manuscripts under **My Desk**.
  - Automatic slug generation, reading-time calculation, and excerpt derivation.
- **Threaded Comment Salon**:
  - Nested replies (`parent_id`), persistent duplicate-safe upvotes (`comment_votes`), and author/post-owner moderation (`DELETE /api/comments/:id`).
- **RESTful Backend + Relational SQLite Persistence**:
  - WAL-mode SQLite database persisted at `data/marginalia.db` with foreign key integrity and automatic initial editorial seeding.

### Innovative Reading & Authoring Features
1. **Living Inline Margin Annotations (70/30 Asymmetric Canvas)**:
   - Highlight any sentence inside an essay or click a paragraph's margin trigger to pin a note anchored to that exact `paragraph_index` and `selected_quote`.
   - Annotated phrases appear underlined inside the prose and sync directly with the sticky margin rail—plus a dedicated global **Annotations** stream.
2. **Passage Resonance Heatmap Scrubber**:
   - Readers can tap **Resonate** on any paragraph (`POST /api/posts/:id/sparks`), lighting up a live visual heatmap strip at the top of the essay so readers can jump straight to the most resonant passages.
3. **Sync-Read Audio Edition**:
   - Built-in Web Speech API narrator (`Listen` / `Pause` / `0.9x–1.5x` speed) that reads the essay aloud paragraph-by-paragraph while highlighting and scrolling to the active paragraph in real time.
4. **Time-Travel Revision History & LCS Diff Inspector**:
   - Every edit to an essay stores an immutable snapshot in `post_revisions`. Open **History (vN)** on any post to inspect a Longest Common Subsequence (LCS) line-by-line diff (`+ added` / `- removed`) across versions.
5. **Dual-Pane Zen Studio with Slash Commands**:
   - Split-screen Markdown authoring with live Broadsheet preview (including editorial drop caps), word/reading-time counters, cover photograph picker, and `/` slash commands (`/h2`, `/quote`, `/code`, `/list`, `/divider`).
6. **Stance-Tagged Comment Dialogue**:
   - Every comment is categorized by conversational stance (**Insight**, **Question**, **Counterpoint**, **Note**), allowing readers to filter discussions by intellectual intent.
7. **Paper & Night Folio Reader Calibration**:
   - Switch between Archival Paper (light) and Night Folio (dark), adjust reading typography scale (`Compact`, `Standard`, `Large`), or toggle **Focus Mode**.

---

## Project Structure

```
├── server.ts                  # Express REST API server + Vite dev/static middleware
├── server/
│   ├── auth.ts                # Scrypt password hashing & HMAC-SHA256 token middleware
│   └── db.ts                  # SQLite schema, migrations, and seed data
├── src/
│   ├── App.tsx                # Top-level editorial layout, Edition, Archive, Annotations & My Desk
│   ├── types.ts               # Shared TypeScript models & editorial constants
│   ├── lib/
│   │   ├── api.ts             # Typed REST API client
│   │   └── diff.ts            # LCS line diff algorithm & date formatting
│   └── components/
│       ├── AuthModal.tsx      # Sign-in, registration & demo account flow
│       ├── EditorialMarkdown.tsx  # Safe Markdown renderer with paragraph indexing & quote highlights
│       ├── PostEditorStudio.tsx   # Dual-pane Markdown studio with slash commands
│       ├── PostReaderView.tsx     # 70/30 reading canvas, audio narration, annotations & comments
│       └── RevisionDiffDrawer.tsx # Time-travel revision diff inspector
├── data/
│   └── marginalia.db          # Auto-generated SQLite database file
└── README.md
```

---

## Database Schema (SQLite)

| Table | Purpose |
| :--- | :--- |
| `users` | Contributor accounts, scrypt password hashes, bios, roles |
| `posts` | Essays and drafts with slugs, categories, reading times, and view counts |
| `post_revisions` | Versioned manuscript snapshots (`version_num`, `change_summary`, `content`) |
| `comments` | Threaded replies (`parent_id`), `stance` tags, and upvote counts |
| `comment_votes` | Composite primary key `(comment_id, user_id)` preventing duplicate upvotes |
| `paragraph_annotations` | Paragraph-anchored margin notes, quoted excerpts, and highlight ink colors |
| `paragraph_sparks` | Per-paragraph reader resonance events powering the heatmap scrubber |

---

## RESTful API Reference

### Authentication
- `POST /api/auth/register` — Register a new contributor (`{ name, username?, email, password, bio? }`)
- `POST /api/auth/login` — Sign in (`{ email, password }`), sets `HttpOnly` cookie and returns `{ user, token }`
- `POST /api/auth/logout` — Clears session cookie
- `GET /api/auth/me` — Returns authenticated user or `null`

### Blog Posts & Revisions
- `GET /api/posts` — List posts (`?category=`, `?q=`, `?status=published|draft|all`, `?author=`, `?sort=latest|popular|discussed`)
- `GET /api/posts/:idOrSlug` — Fetch full essay, increment read count, return `sparksByParagraph`
- `POST /api/posts` *(Auth required)* — Create essay/draft and record `v1` revision
- `PUT /api/posts/:id` *(Author only)* — Update essay/draft and append `vN` revision snapshot
- `DELETE /api/posts/:id` *(Author only)* — Delete essay and cascading records
- `GET /api/posts/:id/revisions` — Retrieve full revision history timeline

### Comments, Margin Annotations & Sparks
- `GET /api/posts/:id/comments` — List all threaded comments with `user_upvoted` state
- `POST /api/posts/:id/comments` *(Auth required)* — Post top-level comment or threaded reply (`{ content, parent_id?, stance }`)
- `POST /api/comments/:id/upvote` *(Auth required)* — Toggle upvote on a comment
- `DELETE /api/comments/:id` *(Comment or post author)* — Delete comment
- `GET /api/annotations/recent` — Global stream of recent margin annotations across published essays
- `GET /api/posts/:id/annotations` — Margin notes for a specific essay
- `POST /api/posts/:id/annotations` *(Auth required)* — Pin a paragraph-anchored margin note
- `DELETE /api/annotations/:id` *(Note author)* — Remove margin note
- `POST /api/posts/:id/sparks` — Record paragraph resonance tap

---

## Demo Accounts (Pre-Seeded)

- **Clara Vance** (Editor): `clara@marginalia.press` / `marginalia2026`
- **Julian Mercer** (Writer): `julian@marginalia.press` / `marginalia2026`

*(You can also click **"Sign in as Demo Editor (Clara Vance)"** directly inside the Sign-In modal or register your own account.)*

---

## Local Development & Build

```bash
# Install dependencies
npm install

# Run full-stack Express + Vite server on http://localhost:3000
npm run dev

# Type-check with TypeScript
npm run lint

# Build production client bundle
npm run build

# Start production server
npm start
```
