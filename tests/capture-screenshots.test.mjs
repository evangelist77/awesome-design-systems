import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCliArgs } from '../scripts/capture-screenshots.mjs';

test('parseCliArgs parses defaults when no arguments provided', () => {
  const result = parseCliArgs([]);
  assert.equal(result.limit, Infinity);
  assert.equal(result.force, false);
});

test('parseCliArgs parses --limit and --force flags correctly', () => {
  const result = parseCliArgs(['--limit=12', '--force']);
  assert.equal(result.limit, 12);
  assert.equal(result.force, true);
});

test('parseCliArgs handles individual flags in any order', () => {
  const onlyForce = parseCliArgs(['--force']);
  assert.equal(onlyForce.limit, Infinity);
  assert.equal(onlyForce.force, true);

  const onlyLimit = parseCliArgs(['--limit=5']);
  assert.equal(onlyLimit.limit, 5);
  assert.equal(onlyLimit.force, false);
});
