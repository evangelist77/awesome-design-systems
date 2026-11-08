# Remove "Generating Preview" & Complete Local Screenshots Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate the "Generating Preview..." placeholder images from the gallery by removing the external WordPress `mshots` dependency, rendering native branded fallback posters for offline sites, and capturing local WebP landing page screenshots for all reachable design systems in `README.md`.

**Architecture:** Extract preview resolution logic (`resolvePreviewConfig`) into `src/lib/gallery-core.mjs` so cards only load local `/screenshots/<slug>.webp` files when `hasScreenshot: true` and immediately render `.fallback-poster` otherwise (never calling `s0.wordpress.com/mshots`). Upgrade `scripts/capture-screenshots.mjs` with higher concurrency (`8` workers), HTTP response validation, and empty-image pruning, then execute a full screenshot pass across all 151 design systems.

**Tech Stack:** Node.js (`node:test`), Vite, Playwright Chromium (`webp` 1280x800), Vanilla ES Modules + CSS.

## Global Constraints

- Zero calls to `s0.wordpress.com/mshots` or any third-party on-the-fly screenshot URL service anywhere in the codebase.
- All unit tests must run and pass via `npm test` (`node --test tests/*.test.mjs`).
- Do not deploy to Vercel; keep all verification and builds local (`npm test` and `npm run build`).
- Keep all source files under 200 lines and functions under 3 parameters (use options objects where needed).

---

## File Structure

- `src/lib/gallery-core.mjs` — Add `getHostname(url)` and `resolvePreviewConfig(system)` so preview selection is pure, unit-tested, and never uses external `mshots` URLs.
- `tests/gallery-core.test.mjs` — Add unit tests verifying `resolvePreviewConfig` returns local image config when `hasScreenshot: true`, poster config when `hasScreenshot: false`, and never references `wordpress.com/mshots`.
- `src/main.js` — Remove `getScreenshotSources` and inline `onerror` `mshots` fallback; use `resolvePreviewConfig` and a delegated capture-phase `error` listener to render `.fallback-poster` if a local image fails to load.
- `scripts/capture-screenshots.mjs` — Support `--concurrency=N` (default `8`), refactor `processQueue` to take an options object `(browser, queue, { targetDir, shouldForce, concurrency })`, and discard broken/tiny screenshots (`< 2048` bytes or HTTP status `>= 400`).
- `tests/capture-screenshots.test.mjs` — Update CLI argument tests for `--concurrency` and `shouldForce`.
- `public/screenshots/*.webp` & `src/data/systems.json` — Populated with local screenshots for all live design systems in `README.md`.

---

### Task 1: Remove WordPress `mshots` & Switch to Pure Local Screenshot + Poster Fallback

**Files:**
- Modify: `src/lib/gallery-core.mjs`
- Modify: `tests/gallery-core.test.mjs`
- Modify: `src/main.js`

**Interfaces:**
- Consumes: `system` object `{ slug, name, url, screenshot, hasScreenshot, tags, sourceUrl }` from `src/data/systems.json`
- Produces:
  - `getHostname(url: string): string`
  - `resolvePreviewConfig(system: object): { type: 'image' | 'poster', src: string | null, domain: string, title: string }`

- [ ] **Step 1: Write the failing tests in `tests/gallery-core.test.mjs`**

Update `tests/gallery-core.test.mjs` to test `getHostname` and `resolvePreviewConfig`:
```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  filterSystems,
  computeExpansionRects,
  getHostname,
  resolvePreviewConfig,
} from '../src/lib/gallery-core.mjs';

const MOCK_SYSTEMS = [
  {
    slug: 'adobe-spectrum',
    name: 'Adobe Spectrum',
    url: 'https://spectrum.adobe.com',
    screenshot: '/screenshots/adobe-spectrum.webp',
    hasScreenshot: true,
    tags: { components: true, voiceAndTone: true, designersKit: true },
    sourceUrl: 'https://github.com/adobe/react-spectrum',
  },
  {
    slug: 'mailchimp-content',
    name: 'Mailchimp Content Styleguide',
    url: 'https://www.styleguide.mailchimp.com/',
    screenshot: '/screenshots/mailchimp-content.webp',
    hasScreenshot: false,
    tags: { components: false, voiceAndTone: true, designersKit: false },
    sourceUrl: null,
  },
];

test('filterSystems filters by search query and tag', () => {
  assert.equal(filterSystems(MOCK_SYSTEMS, { query: 'adobe', tag: 'all' }).length, 1);
  assert.equal(filterSystems(MOCK_SYSTEMS, { query: '', tag: 'components' }).length, 1);
  assert.equal(filterSystems(MOCK_SYSTEMS, { query: '', tag: 'voiceAndTone' }).length, 2);
  assert.equal(filterSystems(MOCK_SYSTEMS, { query: '', tag: 'source' }).length, 1);
  assert.equal(filterSystems(MOCK_SYSTEMS, { query: 'nonexistent', tag: 'all' }).length, 0);
});

test('computeExpansionRects returns exact pixel start box and full-viewport target box', () => {
  const cardRect = { top: 120.4, left: 40.2, width: 360, height: 225 };
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

test('getHostname strips www prefix and handles invalid URLs gracefully', () => {
  assert.equal(getHostname('https://www.carbondesignsystem.com/'), 'carbondesignsystem.com');
  assert.equal(getHostname('not-a-valid-url'), 'not-a-valid-url');
});

test('resolvePreviewConfig uses local screenshot when available and poster when missing (never mshots)', () => {
  const withImage = resolvePreviewConfig(MOCK_SYSTEMS[0]);
  assert.deepEqual(withImage, {
    type: 'image',
    src: '/screenshots/adobe-spectrum.webp',
    domain: 'spectrum.adobe.com',
    title: 'Adobe Spectrum',
  });

  const withoutImage = resolvePreviewConfig(MOCK_SYSTEMS[1]);
  assert.deepEqual(withoutImage, {
    type: 'poster',
    src: null,
    domain: 'styleguide.mailchimp.com',
    title: 'Mailchimp Content Styleguide',
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL with `SyntaxError: The requested module '../src/lib/gallery-core.mjs' does not provide an export named 'getHostname'`

- [ ] **Step 3: Implement `getHostname` and `resolvePreviewConfig` in `src/lib/gallery-core.mjs` and update `src/main.js`**

Update `src/lib/gallery-core.mjs`:
```javascript
const DEFAULT_CARD_BORDER_RADIUS = '14px';

export function getHostname(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    // Return raw URL string if URL constructor fails on malformed input
    return url;
  }
}

export function resolvePreviewConfig(system) {
  const domain = getHostname(system.url);
  const title = system.name;

  if (system.hasScreenshot && system.screenshot) {
    return {
      type: 'image',
      src: system.screenshot,
      domain,
      title,
    };
  }

  return {
    type: 'poster',
    src: null,
    domain,
    title,
  };
}

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
      borderRadius: DEFAULT_CARD_BORDER_RADIUS,
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

Update `src/main.js`:
```javascript
import systemsData from './data/systems.json';
import {
  filterSystems,
  computeExpansionRects,
  getHostname,
  resolvePreviewConfig,
} from './lib/gallery-core.mjs';

const NAVIGATION_FALLBACK_TIMEOUT_MS = 520;

const gridEl = document.getElementById('gallery-grid');
const searchInput = document.getElementById('search-input');
const pillsContainer = document.getElementById('filter-pills');
const countLabel = document.getElementById('count-label');
const zoomOverlay = document.getElementById('zoom-overlay');
const zoomCard = document.getElementById('zoom-card');
const zoomStatus = document.getElementById('zoom-status');

const activeState = { query: '', tag: 'all', isNavigating: false };

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderPosterMarkup(domain, title) {
  return `<div class="fallback-poster"><span class="fallback-domain">${escapeHtml(domain)}</span><span class="fallback-title">${escapeHtml(title)}</span></div>`;
}

function createPreviewMarkup(system) {
  const preview = resolvePreviewConfig(system);
  if (preview.type === 'poster') {
    return renderPosterMarkup(preview.domain, preview.title);
  }

  return `<img src="${escapeHtml(preview.src)}" alt="${escapeHtml(preview.title)} preview" loading="lazy" data-domain="${escapeHtml(preview.domain)}" data-title="${escapeHtml(preview.title)}" />`;
}

function renderCardTags(system) {
  const badges = [];
  if (system.tags?.components) badges.push('<span class="tag">Components</span>');
  if (system.tags?.voiceAndTone) badges.push('<span class="tag">Voice & Tone</span>');
  if (system.tags?.designersKit) badges.push('<span class="tag">Designers Kit</span>');
  if (system.sourceUrl) badges.push('<span class="tag">Open Source</span>');
  return badges.join('');
}

function renderCard(system) {
  const domain = getHostname(system.url);
  const tagsMarkup = renderCardTags(system);

  return `
    <article class="card" tabindex="0" role="link" aria-label="Open ${escapeHtml(system.name)}" data-slug="${escapeHtml(system.slug)}">
      <div class="card-preview">${createPreviewMarkup(system)}</div>
      <div class="card-body">
        <div class="card-header"><h2 class="card-title">${escapeHtml(system.name)}</h2></div>
        <span class="card-domain">${escapeHtml(domain)}</span>
        <div class="card-tags">${tagsMarkup}</div>
      </div>
    </article>
  `;
}

function renderGallery() {
  const filtered = filterSystems(systemsData, activeState);
  countLabel.textContent = `Showing ${filtered.length} of ${systemsData.length} design systems`;
  gridEl.innerHTML = filtered.map(renderCard).join('');
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

  zoomCard.getBoundingClientRect();

  requestAnimationFrame(() => {
    Object.assign(zoomCard.style, to);
  });

  let hasNavigated = false;
  const go = () => {
    if (hasNavigated) return;
    hasNavigated = true;
    window.location.assign(system.url);
  };

  zoomCard.addEventListener('transitionend', go, { once: true });
  setTimeout(go, NAVIGATION_FALLBACK_TIMEOUT_MS);
}

// Replace broken local image with fallback poster using event capturing
gridEl.addEventListener(
  'error',
  (event) => {
    const imgEl = event.target;
    if (imgEl.tagName !== 'IMG' || !imgEl.parentElement) return;
    const domain = imgEl.dataset.domain || '';
    const title = imgEl.dataset.title || '';
    imgEl.parentElement.innerHTML = renderPosterMarkup(domain, title);
  },
  true
);

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
  const pillButton = event.target.closest('.pill');
  if (!pillButton) return;
  pillsContainer.querySelectorAll('.pill').forEach((el) => el.classList.remove('active'));
  pillButton.classList.add('active');
  activeState.tag = pillButton.dataset.tag;
  renderGallery();
});

window.addEventListener('pageshow', () => {
  resetZoomOverlay();
});

renderGallery();
```

- [ ] **Step 4: Run tests and verify zero references to `mshots` remain**

Run: `npm test && ! grep -rn "mshots" src/`
Expected: All 9 unit tests pass and `grep` finds zero matches in `src/`.

- [ ] **Step 5: Commit Task 1**

```bash
git add src/lib/gallery-core.mjs tests/gallery-core.test.mjs src/main.js
git commit -m "fix: remove wordpress mshots generating-preview fallback in favor of local images and poster"
```

---

### Task 2: Upgrade Screenshot Script & Capture All 151 Design Systems Locally

**Files:**
- Modify: `scripts/capture-screenshots.mjs`
- Modify: `tests/capture-screenshots.test.mjs`
- Modify: `src/data/systems.json`
- Create/Update: `public/screenshots/*.webp`

**Interfaces:**
- Consumes: `README.md` via `parseReadme`
- Produces:
  - `parseCliArgs(args: string[]): { limit: number, shouldForce: boolean, concurrency: number }`
  - `isValidScreenshotResponse(status: number | null, byteSize: number): boolean`
  - Complete set of local `.webp` thumbnails in `public/screenshots/` and updated `src/data/systems.json`

- [ ] **Step 1: Write the failing test in `tests/capture-screenshots.test.mjs`**

Update `tests/capture-screenshots.test.mjs`:
```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCliArgs, isValidScreenshotResponse } from '../scripts/capture-screenshots.mjs';

test('parseCliArgs parses defaults when no arguments provided', () => {
  const result = parseCliArgs([]);
  assert.equal(result.limit, Infinity);
  assert.equal(result.shouldForce, false);
  assert.equal(result.concurrency, 8);
});

test('parseCliArgs parses --limit, --concurrency, and --force flags correctly', () => {
  const result = parseCliArgs(['--limit=12', '--concurrency=6', '--force']);
  assert.equal(result.limit, 12);
  assert.equal(result.concurrency, 6);
  assert.equal(result.shouldForce, true);
});

test('isValidScreenshotResponse rejects HTTP errors and tiny/blank files', () => {
  assert.equal(isValidScreenshotResponse(200, 15000), true);
  assert.equal(isValidScreenshotResponse(404, 15000), false);
  assert.equal(isValidScreenshotResponse(500, 15000), false);
  assert.equal(isValidScreenshotResponse(200, 1200), false);
  assert.equal(isValidScreenshotResponse(null, 15000), false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL because `isValidScreenshotResponse` is not exported and `parseCliArgs` returns `force` instead of `shouldForce` / `concurrency`.

- [ ] **Step 3: Implement upgraded `scripts/capture-screenshots.mjs`**

Update `scripts/capture-screenshots.mjs`:
```javascript
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { parseReadme } from '../src/lib/parse-readme.mjs';

const VIEWPORT_WIDTH = 1280;
const VIEWPORT_HEIGHT = 800;
const NAVIGATION_TIMEOUT_MS = 12000;
const POST_LOAD_DELAY_MS = 1000;
const WEBP_QUALITY = 80;
const DEFAULT_CONCURRENCY = 8;
const MIN_VALID_BYTES = 2048;

export function parseCliArgs(args) {
  const limitArg = args.find((a) => a.startsWith('--limit='));
  const limit = limitArg ? Number(limitArg.split('=')[1]) : Infinity;
  const concurrencyArg = args.find((a) => a.startsWith('--concurrency='));
  const concurrency = concurrencyArg ? Number(concurrencyArg.split('=')[1]) : DEFAULT_CONCURRENCY;
  const shouldForce = args.includes('--force');

  return { limit, shouldForce, concurrency };
}

export function isValidScreenshotResponse(status, byteSize) {
  if (typeof status !== 'number' || status >= 400) return false;
  return byteSize >= MIN_VALID_BYTES;
}

async function captureSiteScreenshot(browser, site, outPath) {
  const context = await browser.newContext({
    viewport: { width: VIEWPORT_WIDTH, height: VIEWPORT_HEIGHT },
    deviceScaleFactor: 1,
    ignoreHTTPSErrors: true,
  });

  try {
    const page = await context.newPage();
    console.log(`[capture] ${site.name} -> ${site.url}`);
    // shortcut: 12s timeout per site, offline legacy domains fall back to poster
    const response = await page.goto(site.url, {
      waitUntil: 'domcontentloaded',
      timeout: NAVIGATION_TIMEOUT_MS,
    });

    const status = response ? response.status() : null;
    await page.waitForTimeout(POST_LOAD_DELAY_MS);

    const buffer = await page.screenshot({
      type: 'webp',
      quality: WEBP_QUALITY,
      fullPage: false,
    });

    if (!isValidScreenshotResponse(status, buffer.byteLength)) {
      console.warn(`[warn] Skipping invalid/tiny screenshot for ${site.name} (status=${status}, bytes=${buffer.byteLength})`);
      if (fs.existsSync(outPath)) fs.unlinkSync(outPath);
      return;
    }

    fs.writeFileSync(outPath, buffer);
  } catch (err) {
    console.warn(`[warn] Failed ${site.name} (${site.url}): ${err.message}`);
  } finally {
    await context.close();
  }
}

async function processQueue(browser, queue, { targetDir, shouldForce, concurrency }) {
  let currentIndex = 0;

  async function worker() {
    while (currentIndex < queue.length) {
      const current = queue[currentIndex++];
      if (!current) break;

      const outPath = path.join(targetDir, `${current.slug}.webp`);
      if (!shouldForce && fs.existsSync(outPath)) {
        const stat = fs.statSync(outPath);
        if (stat.size >= MIN_VALID_BYTES) {
          console.log(`[skip] ${current.name} (${current.slug}.webp exists)`);
          continue;
        }
      }

      await captureSiteScreenshot(browser, current, outPath);
    }
  }

  const workers = Array.from({ length: concurrency }, () => worker());
  await Promise.all(workers);
}

export async function runCapture() {
  const rootDir = process.cwd();
  const screenshotsDir = path.join(rootDir, 'public', 'screenshots');
  fs.mkdirSync(screenshotsDir, { recursive: true });

  const { limit, shouldForce, concurrency } = parseCliArgs(process.argv.slice(2));

  const markdown = fs.readFileSync(path.join(rootDir, 'README.md'), 'utf8');
  const allSystems = parseReadme(markdown);
  const queue = allSystems.slice(0, limit);

  const browser = await chromium.launch({ headless: true });

  try {
    await processQueue(browser, queue, {
      targetDir: screenshotsDir,
      shouldForce,
      concurrency,
    });
  } finally {
    await browser.close();
  }

  await import('./generate-data.mjs');
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  await runCapture();
}
```

- [ ] **Step 4: Run unit tests, then execute full screenshot capture across all 151 design systems and build**

Run: `npm test && npm run screenshots && npm run build`
Expected:
- All unit tests pass.
- `npm run screenshots` visits all 151 design systems in `README.md`, saves valid `.webp` screenshots in `public/screenshots/`, and updates `src/data/systems.json`.
- `npm run build` succeeds cleanly.

- [ ] **Step 5: Commit Task 2**

```bash
git add scripts/capture-screenshots.mjs tests/capture-screenshots.test.mjs public/screenshots src/data/systems.json
git commit -m "feat: capture full local screenshots and validate response quality"
```
