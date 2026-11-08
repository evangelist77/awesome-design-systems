# Awesome Design Systems Gallery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fork `alexpate/awesome-design-systems` and build a fast, Vercel-ready static gallery web app that displays landing page screenshots of every design system in `README.md`, expands any clicked thumbnail to fill the viewport, transitions directly to the live website, and cleanly restores the gallery on browser Back navigation.

**Architecture:** A build-time Node.js parser extracts design system entries from the root `README.md` table into `src/data/systems.json`, while a Playwright script captures `1280x800` WebP screenshots into `public/screenshots/<slug>.webp`. A zero-framework Vite frontend renders the filterable gallery grid and drives a hardware-accelerated FLIP viewport-expansion overlay that navigates via `window.location.assign(url)` on transition completion and resets state on `pageshow` (BFCache restore) when the user presses the browser Back button.

**Tech Stack:** Node.js (`>=20`, built-in `node:test`), Vite (`^6.0.0`), Playwright (`^1.49.0`), Vanilla ES Modules + CSS Grid/Custom Properties, Vercel static deployment.

## Global Constraints

- Repository must be a git fork/clone of `alexpate/awesome-design-systems` with the original `README.md` preserved at root so upstream PRs/syncs work cleanly.
- Zero runtime UI dependencies: use Vanilla JS + CSS bundled with Vite for instant load and zero framework bloat.
- All unit tests use Node's built-in `node --test` runner (no Jest/Vitest bloat).
- Viewport zoom transition must clean up on `window` `pageshow` event so BFCache restoration on browser Back button never leaves the gallery stuck on a fullscreen overlay.
- Output must build into `dist/` via `npm run build` and be deployable to Vercel with zero extra server configuration.

---

## File Structure

- `README.md` — Upstream markdown table of design systems (cloned from `alexpate/awesome-design-systems`).
- `package.json` — Scripts (`test`, `parse`, `screenshots`, `dev`, `build`, `preview`) and devDependencies (`vite`, `playwright`).
- `vercel.json` — Vercel static build configuration (`npm run build` -> `dist`).
- `src/lib/parse-readme.mjs` — Pure parser extracting design systems, tags, and source repo URLs from `README.md`.
- `tests/parse-readme.test.mjs` — Unit tests for `parseReadme` and `slugify`.
- `scripts/generate-data.mjs` — CLI script reading `README.md` and writing `src/data/systems.json`.
- `scripts/capture-screenshots.mjs` — Playwright CLI script capturing `1280x800` WebP landing page screenshots into `public/screenshots/<slug>.webp`.
- `src/lib/gallery-core.mjs` — Pure functions for search/tag filtering (`filterSystems`) and viewport expansion geometry (`computeExpansionRects`).
- `tests/gallery-core.test.mjs` — Unit tests for `filterSystems` and `computeExpansionRects`.
- `index.html` — Main HTML shell for Vite entry point.
- `src/style.css` — Responsive gallery grid, card styling, fallback preview cards, and fullscreen expansion overlay styles.
- `src/main.js` — DOM rendering, filter controls, FLIP viewport zoom transition, navigation trigger, and `pageshow` BFCache Back-button reset.

---

### Task 1: Fork Repository & Initialize Lightweight Vite + Vercel Project

**Files:**
- Create: `package.json`
- Create: `vercel.json`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: `alexpate/awesome-design-systems` upstream GitHub repository
- Produces: Root `README.md`, `package.json` with `npm test` and `npm run build`, `vercel.json`

- [ ] **Step 1: Fork and initialize `alexpate/awesome-design-systems` in the workspace**

```bash
gh repo fork alexpate/awesome-design-systems --clone=false || true
git init
git remote add upstream https://github.com/alexpate/awesome-design-systems.git
git fetch upstream master
git checkout -B main upstream/master
```

- [ ] **Step 2: Verify `README.md` exists at root**

Run: `head -n 20 README.md`
Expected: Markdown header containing `![cover](/cover.png)` and `### Tags`

- [ ] **Step 3: Create `package.json` and `vercel.json`, and update `.gitignore`**

Create `package.json`:
```json
{
  "name": "awesome-design-systems-gallery",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "test": "node --test tests/*.test.mjs",
    "parse": "node scripts/generate-data.mjs",
    "screenshots": "node scripts/capture-screenshots.mjs",
    "dev": "npm run parse && vite",
    "build": "npm run parse && vite build",
    "preview": "vite preview"
  },
  "devDependencies": {
    "playwright": "^1.49.0",
    "vite": "^6.0.0"
  }
}
```

Create `vercel.json`:
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite"
}
```

Append to `.gitignore`:
```gitignore
node_modules/
dist/
.DS_Store
```

- [ ] **Step 4: Install dependencies**

Run: `npm install`
Expected: `added ... packages` with exit code 0

- [ ] **Step 5: Commit project setup**

```bash
git add package.json package-lock.json vercel.json .gitignore
git commit -m "chore: initialize vite gallery config and vercel setup"
```

---

### Task 2: README Markdown Table Parser & Data Generator

**Files:**
- Create: `src/lib/parse-readme.mjs`
- Create: `scripts/generate-data.mjs`
- Create: `tests/parse-readme.test.mjs`

**Interfaces:**
- Consumes: Markdown string from `README.md`
- Produces:
  - `slugify(name: string): string`
  - `parseReadme(markdown: string): Array<{ slug: string, name: string, url: string, note: string, tags: { components: boolean, voiceAndTone: boolean, designersKit: boolean }, sourceUrl: string | null, screenshot: string }>`
  - `src/data/systems.json`

- [ ] **Step 1: Write the failing test in `tests/parse-readme.test.mjs`**

```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import { slugify, parseReadme } from '../src/lib/parse-readme.mjs';

const SAMPLE_MD = `
|                                                                                    | Components | Voice & Tone | Designers Kit |                                             Source code \\*                                             |
| ---------------------------------------------------------------------------------- | :--------: | :----------: | :-----------: | :----------------------------------------------------------------------------------------------------: |
| [Adobe Spectrum](https://spectrum.adobe.com)                                       |     👍     |      👍      |      👍       |                          [:octocat:](https://github.com/adobe/react-spectrum)                          |
| [Apple Developer Design Guidelines](https://developer.apple.com/design/)           |            |              |      👍       |                                                                                                        |
| [Jobber](https://atlantis.getjobber.com) (🔱 Atlantis)                             |     👍     |              |               |                                                                                                        |
`;

test('slugify converts system names into URL-safe filenames', () => {
  assert.equal(slugify('Adobe Spectrum'), 'adobe-spectrum');
  assert.equal(slugify("Pharos: JSTOR's Design System"), 'pharos-jstor-s-design-system');
});

test('parseReadme extracts systems, tags, notes, and source links from markdown table', () => {
  const systems = parseReadme(SAMPLE_MD);
  assert.equal(systems.length, 3);

  assert.deepEqual(systems[0], {
    slug: 'adobe-spectrum',
    name: 'Adobe Spectrum',
    url: 'https://spectrum.adobe.com',
    note: '',
    tags: {
      components: true,
      voiceAndTone: true,
      designersKit: true,
    },
    sourceUrl: 'https://github.com/adobe/react-spectrum',
    screenshot: '/screenshots/adobe-spectrum.webp',
  });

  assert.deepEqual(systems[1], {
    slug: 'apple-developer-design-guidelines',
    name: 'Apple Developer Design Guidelines',
    url: 'https://developer.apple.com/design/',
    note: '',
    tags: {
      components: false,
      voiceAndTone: false,
      designersKit: true,
    },
    sourceUrl: null,
    screenshot: '/screenshots/apple-developer-design-guidelines.webp',
  });

  assert.equal(systems[2].name, 'Jobber');
  assert.equal(systems[2].note, '(🔱 Atlantis)');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL with `Cannot find module '../src/lib/parse-readme.mjs'`

- [ ] **Step 3: Implement `src/lib/parse-readme.mjs` and `scripts/generate-data.mjs`**

Create `src/lib/parse-readme.mjs`:
```javascript
export function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function parseReadme(markdown) {
  const lines = markdown.split(/\r?\n/);
  const systems = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line.startsWith('|') || !line.endsWith('|')) continue;

    const cells = line
      .slice(1, -1)
      .split('|')
      .map((cell) => cell.trim());

    if (cells.length < 5) continue;

    // Match [System Name](https://example.com) followed by optional note
    const primaryMatch = cells[0].match(/^\[([^\]]+)\]\((https?:\/\/[^)]+)\)\s*(.*)$/);
    if (!primaryMatch) continue;

    const [, name, url, note] = primaryMatch;
    const slug = slugify(name);
    const sourceMatch = cells[4].match(/\((https?:\/\/[^)]+)\)/);

    systems.push({
      slug,
      name: name.trim(),
      url: url.trim(),
      note: note.trim(),
      tags: {
        components: cells[1].includes('👍'),
        voiceAndTone: cells[2].includes('👍'),
        designersKit: cells[3].includes('👍'),
      },
      sourceUrl: sourceMatch ? sourceMatch[1].trim() : null,
      screenshot: `/screenshots/${slug}.webp`,
    });
  }

  return systems;
}
```

Create `scripts/generate-data.mjs`:
```javascript
import fs from 'node:fs';
import path from 'node:path';
import { parseReadme } from '../src/lib/parse-readme.mjs';

const rootDir = process.cwd();
const readmePath = path.join(rootDir, 'README.md');
const outDir = path.join(rootDir, 'src', 'data');
const outPath = path.join(outDir, 'systems.json');
const screenshotsDir = path.join(rootDir, 'public', 'screenshots');

const markdown = fs.readFileSync(readmePath, 'utf8');
const systems = parseReadme(markdown).map((item) => {
  const fileOnDisk = path.join(screenshotsDir, `${item.slug}.webp`);
  return {
    ...item,
    hasScreenshot: fs.existsSync(fileOnDisk),
  };
});

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(systems, null, 2) + '\n', 'utf8');
console.log(`Parsed ${systems.length} design systems into src/data/systems.json`);
```

- [ ] **Step 4: Run tests and data generator to verify they pass**

Run: `npm test && npm run parse`
Expected: `pass 2` and `Parsed ... design systems into src/data/systems.json`

- [ ] **Step 5: Commit parser and generated data**

```bash
git add src/lib/parse-readme.mjs scripts/generate-data.mjs tests/parse-readme.test.mjs src/data/systems.json
git commit -m "feat: add README design systems parser and JSON generator"
```

---

### Task 3: Automated Landing Page Screenshot Script (Playwright)

**Files:**
- Create: `scripts/capture-screenshots.mjs`
- Create: `public/screenshots/.gitkeep`

**Interfaces:**
- Consumes: `src/data/systems.json` produced by Task 2
- Produces: `public/screenshots/<slug>.webp` images (`1280x800`) and refreshes `src/data/systems.json` `hasScreenshot` flags

- [ ] **Step 1: Implement `scripts/capture-screenshots.mjs`**

Create `public/screenshots/.gitkeep` (empty file) and `scripts/capture-screenshots.mjs`:
```javascript
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { parseReadme } from '../src/lib/parse-readme.mjs';

const rootDir = process.cwd();
const screenshotsDir = path.join(rootDir, 'public', 'screenshots');
fs.mkdirSync(screenshotsDir, { recursive: true });

const args = process.argv.slice(2);
const limitArg = args.find((a) => a.startsWith('--limit='));
const limit = limitArg ? Number(limitArg.split('=')[1]) : Infinity;
const force = args.includes('--force');
const concurrency = 4;

const markdown = fs.readFileSync(path.join(rootDir, 'README.md'), 'utf8');
const allSystems = parseReadme(markdown);
const queue = allSystems.slice(0, limit);

async function captureAll() {
  const browser = await chromium.launch({ headless: true });
  let index = 0;

  async function worker() {
    while (index < queue.length) {
      const current = queue[index++];
      const outPath = path.join(screenshotsDir, `${current.slug}.webp`);

      if (!force && fs.existsSync(outPath)) {
        console.log(`[skip] ${current.name} (${current.slug}.webp exists)`);
        continue;
      }

      const context = await browser.newContext({
        viewport: { width: 1280, height: 800 },
        deviceScaleFactor: 1,
        ignoreHTTPSErrors: true,
      });
      const page = await context.newPage();

      try {
        console.log(`[capture] ${current.name} -> ${current.url}`);
        // shortcut: 15s timeout per site, some legacy URLs in README may be offline
        await page.goto(current.url, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await page.waitForTimeout(1200);
        await page.screenshot({
          path: outPath,
          type: 'webp',
          quality: 80,
          fullPage: false,
        });
      } catch (err) {
        console.warn(`[warn] Failed ${current.name} (${current.url}): ${err.message}`);
      } finally {
        await context.close();
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  await browser.close();
}

await captureAll();
await import('./generate-data.mjs');
```

- [ ] **Step 2: Ensure Chromium is installed and capture an initial batch of screenshots**

Run: `npx playwright install chromium && node scripts/capture-screenshots.mjs --limit=12`
Expected: Captures `.webp` files in `public/screenshots/` and updates `src/data/systems.json` with `hasScreenshot: true`

- [ ] **Step 3: Commit screenshot script and initial screenshots**

```bash
git add scripts/capture-screenshots.mjs public/screenshots src/data/systems.json
git commit -m "feat: add playwright screenshot capture script and initial thumbnails"
```

---

### Task 4: Gallery Filtering & Viewport Expansion Geometry Logic

**Files:**
- Create: `src/lib/gallery-core.mjs`
- Create: `tests/gallery-core.test.mjs`

**Interfaces:**
- Consumes: `systems` array from `src/data/systems.json`
- Produces:
  - `filterSystems(systems: Array, filters: { query?: string, tag?: string }): Array`
  - `computeExpansionRects(cardRect: { top: number, left: number, width: number, height: number }, viewport: { width: number, height: number }): { from: { top: string, left: string, width: string, height: string, borderRadius: string }, to: { top: string, left: string, width: string, height: string, borderRadius: string } }`

- [ ] **Step 1: Write the failing test in `tests/gallery-core.test.mjs`**

```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import { filterSystems, computeExpansionRects } from '../src/lib/gallery-core.mjs';

const MOCK_SYSTEMS = [
  {
    slug: 'adobe-spectrum',
    name: 'Adobe Spectrum',
    url: 'https://spectrum.adobe.com',
    tags: { components: true, voiceAndTone: true, designersKit: true },
    sourceUrl: 'https://github.com/adobe/react-spectrum',
  },
  {
    slug: 'mailchimp-content',
    name: 'Mailchimp Content Styleguide',
    url: 'https://styleguide.mailchimp.com/',
    tags: { components: false, voiceAndTone: true, designersKit: false },
    sourceUrl: null,
  },
];

test('filterSystems filters by search query and tag', () => {
  assert.equal(filterSystems(MOCK_SYSTEMS, { query: 'adobe', tag: 'all' }).length, 1);
  assert.equal(filterSystems(MOCK_SYSTEMS, { query: '', tag: 'components' }).length, 1);
  assert.equal(filterSystems(MOCK_SYSTEMS, { query: '', tag: 'voiceAndTone' }).length, 2);
  assert.equal(filterSystems(MOCK_SYSTEMS, { query: '', tag: 'source' }).length, 1);
});

test('computeExpansionRects returns exact pixel start box and full-viewport target box', () => {
  const cardRect = { top: 120, left: 40, width: 360, height: 225 };
  const viewport = { width: 1440, height: 900 };

  const rects = computeExpansionRects(cardRect, viewport);
  assert.deepEqual(rects, {
    from: {
      top: '120px',
      left: '40px',
      width: '360px',
      height: '225px',
      borderRadius: '14px',
    },
    to: {
      top: '0px',
      left: '0px',
      width: '1440px',
      height: '900px',
      borderRadius: '0px',
    },
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL with `Cannot find module '../src/lib/gallery-core.mjs'`

- [ ] **Step 3: Implement `src/lib/gallery-core.mjs`**

```javascript
export function filterSystems(systems, { query = '', tag = 'all' } = {}) {
  const normalizedQuery = query.trim().toLowerCase();

  return systems.filter((system) => {
    const matchesQuery =
      !normalizedQuery ||
      system.name.toLowerCase().includes(normalizedQuery) ||
      system.url.toLowerCase().includes(normalizedQuery);

    if (!matchesQuery) return false;
    if (!tag || tag === 'all') return true;
    if (tag === 'source') return Boolean(system.sourceUrl);
    return Boolean(system.tags?.[tag]);
  });
}

export function computeExpansionRects(cardRect, viewport) {
  return {
    from: {
      top: `${Math.round(cardRect.top)}px`,
      left: `${Math.round(cardRect.left)}px`,
      width: `${Math.round(cardRect.width)}px`,
      height: `${Math.round(cardRect.height)}px`,
      borderRadius: '14px',
    },
    to: {
      top: '0px',
      left: '0px',
      width: `${Math.round(viewport.width)}px`,
      height: `${Math.round(viewport.height)}px`,
      borderRadius: '0px',
    },
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: `pass 4` with 0 failures

- [ ] **Step 5: Commit gallery core logic**

```bash
git add src/lib/gallery-core.mjs tests/gallery-core.test.mjs
git commit -m "feat: add gallery filter and viewport expansion geometry helpers"
```

---

### Task 5: Gallery UI, Viewport Zoom-to-Navigate Animation & Browser Back Recovery

**Files:**
- Create: `index.html`
- Create: `src/style.css`
- Create: `src/main.js`

**Interfaces:**
- Consumes: `src/data/systems.json`, `filterSystems` and `computeExpansionRects` from `src/lib/gallery-core.mjs`
- Produces: Static gallery web app with search/filter, FLIP card-to-viewport expansion overlay, automatic navigation to `system.url`, and `pageshow` BFCache Back-button reset

- [ ] **Step 1: Create `index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Awesome Design Systems — Visual Gallery</title>
    <link rel="stylesheet" href="/src/style.css" />
  </head>
  <body>
    <header class="hero">
      <div class="hero-inner">
        <span class="badge">Curated Collection</span>
        <h1>Awesome Design Systems</h1>
        <p class="subtitle">
          Click any landing page preview to expand it to fullscreen and jump straight into the live design system.
        </p>
        <div class="controls">
          <input
            id="search-input"
            type="search"
            placeholder="Search design systems (e.g., Carbon, Spectrum, Polaris)..."
            autocomplete="off"
          />
          <div class="filter-pills" id="filter-pills">
            <button type="button" class="pill active" data-tag="all">All</button>
            <button type="button" class="pill" data-tag="components">Components</button>
            <button type="button" class="pill" data-tag="voiceAndTone">Voice &amp; Tone</button>
            <button type="button" class="pill" data-tag="designersKit">Designers Kit</button>
            <button type="button" class="pill" data-tag="source">Open Source</button>
          </div>
        </div>
        <div class="meta-bar">
          <span id="count-label">Loading systems...</span>
          <a href="https://github.com/alexpate/awesome-design-systems" target="_blank" rel="noreferrer">
            Upstream Repository ↗
          </a>
        </div>
      </div>
    </header>

    <main class="gallery-container">
      <div id="gallery-grid" class="gallery-grid" aria-live="polite"></div>
    </main>

    <div id="zoom-overlay" class="zoom-overlay" hidden>
      <div class="zoom-progress"></div>
      <div id="zoom-card" class="zoom-card"></div>
      <div class="zoom-status" id="zoom-status">Opening live site...</div>
    </div>

    <script type="module" src="/src/main.js"></script>
  </body>
</html>
```

- [ ] **Step 2: Create `src/style.css`**

```css
:root {
  --bg: #0b0d12;
  --surface: #131722;
  --surface-hover: #1c2232;
  --border: rgba(255, 255, 255, 0.09);
  --text: #f3f5f8;
  --muted: #94a3b8;
  --accent: #6366f1;
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  background: var(--bg);
  color: var(--text);
  font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, sans-serif;
  min-height: 100vh;
  overflow-x: hidden;
}

.hero {
  padding: 3.5rem 1.5rem 2rem;
  border-bottom: 1px solid var(--border);
  background: radial-gradient(circle at 50% 0%, rgba(99, 102, 241, 0.16), transparent 65%);
}

.hero-inner {
  max-width: 1360px;
  margin: 0 auto;
}

.badge {
  display: inline-block;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  padding: 0.3rem 0.7rem;
  border-radius: 999px;
  background: rgba(99, 102, 241, 0.18);
  color: #a5b4fc;
  margin-bottom: 0.75rem;
}

h1 {
  font-size: clamp(2rem, 4vw, 3rem);
  font-weight: 800;
  letter-spacing: -0.02em;
  margin-bottom: 0.5rem;
}

.subtitle {
  color: var(--muted);
  max-width: 640px;
  line-height: 1.5;
  margin-bottom: 1.75rem;
}

.controls {
  display: flex;
  flex-wrap: wrap;
  gap: 0.85rem;
  align-items: center;
  margin-bottom: 1.25rem;
}

#search-input {
  flex: 1 1 300px;
  background: var(--surface);
  border: 1px solid var(--border);
  color: var(--text);
  padding: 0.75rem 1rem;
  border-radius: 10px;
  font-size: 0.95rem;
  outline: none;
}

#search-input:focus {
  border-color: var(--accent);
}

.filter-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.pill {
  background: var(--surface);
  border: 1px solid var(--border);
  color: var(--muted);
  padding: 0.6rem 0.95rem;
  border-radius: 999px;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.15s ease;
}

.pill:hover,
.pill.active {
  background: var(--accent);
  color: #fff;
  border-color: var(--accent);
}

.meta-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.85rem;
  color: var(--muted);
}

.meta-bar a {
  color: #a5b4fc;
  text-decoration: none;
}

.gallery-container {
  max-width: 1360px;
  margin: 0 auto;
  padding: 2rem 1.5rem 4rem;
}

.gallery-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 1.5rem;
}

.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  overflow: hidden;
  cursor: pointer;
  transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
  display: flex;
  flex-direction: column;
}

.card:hover {
  transform: translateY(-4px);
  border-color: rgba(99, 102, 241, 0.5);
  box-shadow: 0 16px 36px rgba(0, 0, 0, 0.45);
}

.card-preview {
  position: relative;
  aspect-ratio: 16 / 10;
  width: 100%;
  background: #181d2c;
  overflow: hidden;
}

.card-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: top center;
  display: block;
}

.fallback-poster {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 1.25rem;
  background: linear-gradient(135deg, #1e1b4b 0%, #0f172a 100%);
}

.fallback-domain {
  font-size: 0.75rem;
  color: #818cf8;
  font-family: monospace;
}

.fallback-title {
  font-size: 1.35rem;
  font-weight: 700;
  color: #fff;
}

.card-body {
  padding: 1rem 1.15rem;
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 0.5rem;
}

.card-title {
  font-size: 1.02rem;
  font-weight: 600;
  color: var(--text);
}

.card-domain {
  font-size: 0.78rem;
  color: var(--muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.tag {
  font-size: 0.7rem;
  padding: 0.2rem 0.5rem;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.06);
  color: var(--muted);
}

.zoom-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: rgba(8, 10, 15, 0.85);
  backdrop-filter: blur(6px);
}

.zoom-card {
  position: fixed;
  overflow: hidden;
  box-shadow: 0 25px 60px rgba(0, 0, 0, 0.75);
  background: #0f172a;
  transition:
    top 460ms cubic-bezier(0.22, 1, 0.36, 1),
    left 460ms cubic-bezier(0.22, 1, 0.36, 1),
    width 460ms cubic-bezier(0.22, 1, 0.36, 1),
    height 460ms cubic-bezier(0.22, 1, 0.36, 1),
    border-radius 460ms cubic-bezier(0.22, 1, 0.36, 1);
}

.zoom-card img,
.zoom-card .fallback-poster {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: top center;
}

.zoom-progress {
  position: fixed;
  top: 0;
  left: 0;
  height: 3px;
  width: 100%;
  background: linear-gradient(90deg, #6366f1, #ec4899);
  transform-origin: left;
  animation: progress-grow 500ms ease-out forwards;
  z-index: 10001;
}

.zoom-status {
  position: fixed;
  bottom: 1.5rem;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(15, 23, 42, 0.9);
  border: 1px solid var(--border);
  color: #fff;
  padding: 0.55rem 1.1rem;
  border-radius: 999px;
  font-size: 0.85rem;
  z-index: 10001;
}

@keyframes progress-grow {
  from {
    transform: scaleX(0.05);
  }
  to {
    transform: scaleX(1);
  }
}
```

- [ ] **Step 3: Create `src/main.js` with FLIP viewport expansion, direct navigation, and `pageshow` BFCache Back reset**

```javascript
import systemsData from './data/systems.json';
import { filterSystems, computeExpansionRects } from './lib/gallery-core.mjs';

const gridEl = document.getElementById('gallery-grid');
const searchInput = document.getElementById('search-input');
const pillsContainer = document.getElementById('filter-pills');
const countLabel = document.getElementById('count-label');
const zoomOverlay = document.getElementById('zoom-overlay');
const zoomCard = document.getElementById('zoom-card');
const zoomStatus = document.getElementById('zoom-status');

let activeState = {
  query: '',
  tag: 'all',
  isNavigating: false,
};

function getHostname(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function getScreenshotSources(system) {
  const localSrc = system.screenshot;
  const remoteFallback = `https://s0.wordpress.com/mshots/v1/${encodeURIComponent(system.url)}?w=1280&h=800`;
  return {
    primary: system.hasScreenshot ? localSrc : remoteFallback,
    fallback: remoteFallback,
  };
}

function createPreviewMarkup(system) {
  const { primary, fallback } = getScreenshotSources(system);
  const domain = getHostname(system.url);
  return `
    <img
      src="${primary}"
      alt="${system.name} landing page preview"
      loading="lazy"
      data-fallback="${fallback}"
      onerror="if (this.src !== this.dataset.fallback) { this.src = this.dataset.fallback; } else { this.parentElement.innerHTML = '<div class=\\'fallback-poster\\'><span class=\\'fallback-domain\\'>${domain}</span><span class=\\'fallback-title\\'>${system.name.replace(/'/g, '&#39;')}</span></div>'; }"
    />
  `;
}

function renderGallery() {
  const filtered = filterSystems(systemsData, activeState);
  countLabel.textContent = `Showing ${filtered.length} of ${systemsData.length} design systems`;

  gridEl.innerHTML = filtered
    .map((system) => {
      const domain = getHostname(system.url);
      const badges = [];
      if (system.tags.components) badges.push('<span class="tag">Components</span>');
      if (system.tags.voiceAndTone) badges.push('<span class="tag">Voice & Tone</span>');
      if (system.tags.designersKit) badges.push('<span class="tag">Designers Kit</span>');
      if (system.sourceUrl) badges.push('<span class="tag">Open Source</span>');

      return `
        <article
          class="card"
          tabindex="0"
          role="link"
          aria-label="Open ${system.name}"
          data-slug="${system.slug}"
        >
          <div class="card-preview">
            ${createPreviewMarkup(system)}
          </div>
          <div class="card-body">
            <div class="card-header">
              <h2 class="card-title">${system.name}</h2>
            </div>
            <span class="card-domain">${domain}</span>
            <div class="card-tags">${badges.join('')}</div>
          </div>
        </article>
      `;
    })
    .join('');
}

function resetZoomOverlay() {
  activeState.isNavigating = false;
  zoomOverlay.hidden = true;
  zoomCard.innerHTML = '';
  zoomCard.removeAttribute('style');
}

function expandAndNavigate(cardEl, system) {
  if (activeState.isNavigating) return;
  activeState.isNavigating = true;

  const previewEl = cardEl.querySelector('.card-preview');
  const rect = previewEl.getBoundingClientRect();
  const { from, to } = computeExpansionRects(rect, {
    width: window.innerWidth,
    height: window.innerHeight,
  });

  zoomCard.innerHTML = previewEl.innerHTML;
  Object.assign(zoomCard.style, from);
  zoomStatus.textContent = `Opening ${system.name} (${getHostname(system.url)})...`;
  zoomOverlay.hidden = false;

  // Force layout calc before transitioning to 100vw x 100vh
  zoomCard.getBoundingClientRect();

  requestAnimationFrame(() => {
    Object.assign(zoomCard.style, to);
  });

  let navigated = false;
  const go = () => {
    if (navigated) return;
    navigated = true;
    window.location.assign(system.url);
  };

  zoomCard.addEventListener('transitionend', go, { once: true });
  setTimeout(go, 520);
}

gridEl.addEventListener('click', (event) => {
  const cardEl = event.target.closest('.card');
  if (!cardEl) return;
  const system = systemsData.find((item) => item.slug === cardEl.dataset.slug);
  if (system) expandAndNavigate(cardEl, system);
});

gridEl.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  const cardEl = event.target.closest('.card');
  if (!cardEl) return;
  event.preventDefault();
  const system = systemsData.find((item) => item.slug === cardEl.dataset.slug);
  if (system) expandAndNavigate(cardEl, system);
});

searchInput.addEventListener('input', (event) => {
  activeState.query = event.target.value;
  renderGallery();
});

pillsContainer.addEventListener('click', (event) => {
  const btn = event.target.closest('.pill');
  if (!btn) return;
  pillsContainer.querySelectorAll('.pill').forEach((el) => el.classList.remove('active'));
  btn.classList.add('active');
  activeState.tag = btn.dataset.tag;
  renderGallery();
});

// Critical: when user clicks Browser Back button, BFCache restores the page.
// Reset the fullscreen overlay immediately so the user is back in the gallery.
window.addEventListener('pageshow', () => {
  resetZoomOverlay();
});

renderGallery();
```

- [ ] **Step 4: Build production bundle with Vite and run all unit tests**

Run: `npm test && npm run build`
Expected: All unit tests pass and `vite build` outputs `dist/index.html` and hashed assets in `dist/assets/`.

- [ ] **Step 5: Commit gallery frontend**

```bash
git add index.html src/style.css src/main.js
git commit -m "feat: implement design systems gallery UI and viewport zoom transition"
```
