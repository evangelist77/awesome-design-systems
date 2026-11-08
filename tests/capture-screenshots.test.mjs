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

test('parseCliArgs handles individual flags in any order', () => {
  const onlyForce = parseCliArgs(['--force']);
  assert.equal(onlyForce.limit, Infinity);
  assert.equal(onlyForce.shouldForce, true);
  assert.equal(onlyForce.concurrency, 8);

  const onlyLimit = parseCliArgs(['--limit=5']);
  assert.equal(onlyLimit.limit, 5);
  assert.equal(onlyLimit.shouldForce, false);
  assert.equal(onlyLimit.concurrency, 8);
});

test('isValidScreenshotResponse rejects HTTP errors and tiny/blank files', () => {
  assert.equal(isValidScreenshotResponse(200, 15000), true);
  assert.equal(isValidScreenshotResponse(404, 15000), false);
  assert.equal(isValidScreenshotResponse(500, 15000), false);
  assert.equal(isValidScreenshotResponse(200, 1200), false);
  assert.equal(isValidScreenshotResponse(null, 15000), false);
});

