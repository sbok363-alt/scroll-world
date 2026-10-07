import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const read = path => readFileSync(path, 'utf8');

test('CI is reproducible, browser-complete, and protects the legacy skill', () => {
  const workflow = read('.github/workflows/ci.yml');

  assert.match(workflow, /node-version:\s*22/);
  assert.match(workflow, /fetch-depth:\s*0/);
  assert.match(workflow, /npm ci/);
  assert.match(workflow, /(?:apt-get|apt)\s+install[^\n]*ffmpeg|ffmpeg\s+-version/i);
  assert.match(workflow, /playwright install --with-deps chromium webkit/);
  assert.match(workflow, /npm test/);
  assert.match(workflow, /git diff --exit-code origin\/main -- skills\/scroll-world/);
});

test('CI validates pull requests and main branch pushes', () => {
  const workflow = read('.github/workflows/ci.yml');

  assert.match(workflow, /^\s*pull_request:\s*$/m);
  assert.match(workflow, /^\s*push:\s*$/m);
  const mainBranchEntries = workflow.match(/^\s*- main\s*$/gm) ?? [];
  assert.ok(mainBranchEntries.length >= 2, 'main must be covered by both pull_request and push triggers');
});

test('dependency lockfile is committed for npm ci', () => {
  assert.equal(existsSync('package-lock.json'), true, 'package-lock.json must be committed');
  const lock = JSON.parse(read('package-lock.json'));
  assert.equal(lock.name, 'scroll-world-fork-tests');
  assert.ok(lock.lockfileVersion >= 3);
});

test('Playwright acceptance matrix names desktop Chromium and phone Chromium/WebKit contexts', () => {
  const config = read('playwright.config.mjs');

  assert.match(config, /chromium-desktop/);
  assert.match(config, /chromium-phone/);
  assert.match(config, /webkit-phone/);
  assert.match(config, /390/);
  assert.match(config, /844/);
});
