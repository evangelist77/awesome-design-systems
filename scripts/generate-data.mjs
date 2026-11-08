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
