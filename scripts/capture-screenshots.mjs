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

/**
 * Parses command-line arguments for screenshot capture.
 *
 * @param {string[]} args - Process CLI arguments.
 * @returns {{ limit: number, shouldForce: boolean, concurrency: number }}
 */
export function parseCliArgs(args) {
  const limitArg = args.find((a) => a.startsWith('--limit='));
  const limit = limitArg ? Number(limitArg.split('=')[1]) : Infinity;
  const concurrencyArg = args.find((a) => a.startsWith('--concurrency='));
  const concurrency = concurrencyArg ? Number(concurrencyArg.split('=')[1]) : DEFAULT_CONCURRENCY;
  const shouldForce = args.includes('--force');

  return { limit, shouldForce, concurrency };
}

/**
 * Validates screenshot HTTP response code and payload size.
 *
 * @param {number|null} status - HTTP response status code.
 * @param {number} byteSize - Rendered webp buffer size in bytes.
 * @returns {boolean}
 */
export function isValidScreenshotResponse(status, byteSize) {
  if (typeof status !== 'number' || status >= 400) return false;
  return byteSize >= MIN_VALID_BYTES;
}

/**
 * Captures a single landing page screenshot.
 *
 * @param {import('playwright').Browser} browser - Active Playwright browser instance.
 * @param {{ name: string, url: string }} site - Target design system metadata.
 * @param {string} outPath - Destination path for webp image.
 */
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

/**
 * Worker pool to process queued design systems concurrently.
 *
 * @param {import('playwright').Browser} browser - Active Playwright browser instance.
 * @param {Array<{ name: string, slug: string, url: string }>} queue - List of sites to capture.
 * @param {{ targetDir: string, shouldForce: boolean, concurrency: number }} options
 */
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

/**
 * Main execution flow: captures screenshots and refreshes JSON index.
 */
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

  // Refresh systems.json so hasScreenshot flags reflect newly created images on disk
  await import('./generate-data.mjs');
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  await runCapture();
}

