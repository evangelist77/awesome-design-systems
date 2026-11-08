import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { parseReadme } from '../src/lib/parse-readme.mjs';

const VIEWPORT_WIDTH = 1280;
const VIEWPORT_HEIGHT = 800;
const NAVIGATION_TIMEOUT_MS = 15000;
const POST_LOAD_DELAY_MS = 1200;
const WEBP_QUALITY = 80;
const DEFAULT_CONCURRENCY = 4;

/**
 * Parses command-line arguments for screenshot capture.
 *
 * @param {string[]} args - Process CLI arguments.
 * @returns {{ limit: number, force: boolean }}
 */
export function parseCliArgs(args) {
  const limitArg = args.find((a) => a.startsWith('--limit='));
  const limit = limitArg ? Number(limitArg.split('=')[1]) : Infinity;
  const force = args.includes('--force');

  return { limit, force };
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

  const page = await context.newPage();

  try {
    console.log(`[capture] ${site.name} -> ${site.url}`);
    // shortcut: 15s timeout per site, some legacy URLs in README may be offline
    await page.goto(site.url, {
      waitUntil: 'domcontentloaded',
      timeout: NAVIGATION_TIMEOUT_MS,
    });

    await page.waitForTimeout(POST_LOAD_DELAY_MS);

    await page.screenshot({
      path: outPath,
      type: 'webp',
      quality: WEBP_QUALITY,
      fullPage: false,
    });
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
 * @param {string} targetDir - Output directory for screenshots.
 * @param {boolean} force - Whether to overwrite existing screenshots.
 * @param {number} concurrency - Max concurrent workers.
 */
async function processQueue(browser, queue, targetDir, force, concurrency) {
  let currentIndex = 0;

  async function worker() {
    while (currentIndex < queue.length) {
      const current = queue[currentIndex++];
      if (!current) break;

      const outPath = path.join(targetDir, `${current.slug}.webp`);
      if (!force && fs.existsSync(outPath)) {
        console.log(`[skip] ${current.name} (${current.slug}.webp exists)`);
        continue;
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

  const { limit, force } = parseCliArgs(process.argv.slice(2));

  const markdown = fs.readFileSync(path.join(rootDir, 'README.md'), 'utf8');
  const allSystems = parseReadme(markdown);
  const queue = allSystems.slice(0, limit);

  const browser = await chromium.launch({ headless: true });

  try {
    await processQueue(browser, queue, screenshotsDir, force, DEFAULT_CONCURRENCY);
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
