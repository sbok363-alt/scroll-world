# Cinematic Web Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new `cinematic-web` skill that keeps ordinary document scrolling as the page architecture, uses viewport-triggered autoplay video as the default cinematic primitive, and allows only bounded 1–3 viewport-height micro-scrubs.

**Architecture:** The new skill is progressive enhancement over semantic HTML. `cinematic-engine.js` mounts two independent controllers: viewport video and micro scrub. Viewport video uses IntersectionObserver and a single-playback coordinator; micro scrub is initialized only when scrub sections exist and uses localized scroll/seek work with no permanent rAF loop. Video generation stays build-time and provider-blind at runtime; the original `skills/scroll-world` remains unchanged as legacy/reference material.

**Tech Stack:** Vanilla JavaScript ES modules, semantic HTML/CSS, IntersectionObserver, HTMLVideoElement, `requestVideoFrameCallback` with fallback, Playwright browser tests, Node built-ins for static server/contract tests, ffmpeg guidance for generated web assets.

**Spec:** `docs/superpowers/specs/2026-10-03-cinematic-web-design.md`

## Global Constraints

- Normal browser document flow is authoritative; viewport video must not add artificial scroll distance.
- Viewport video is the default cinematic behavior; it is muted, inline, poster-first, lazy-loaded, and pauses offscreen.
- Play threshold is `0.50` intersection ratio; pause threshold is `0.15`; prefetch root margin is `100% 0px`.
- At most one viewport-autoplay video may be playing at a time.
- `Save-Data` and `prefers-reduced-motion: reduce` default to static poster behavior; no autoplay or scrub motion.
- Micro scrub uses one independent clip, default `2` viewport heights, hard-clamped to `1..3`.
- A scrub's total sticky track height is `(clampedScrollVh + 1) * 100dvh`, giving exactly 1–3 viewport heights of controlled progress plus the visible sticky viewport.
- No connectors, cross-section video chains, or frame-identical seam requirement in the new skill.
- No page-wide or permanent `requestAnimationFrame` loop; scrub work is scheduled only on relevant scroll/visibility events and only when scrub sections exist.
- Every motion section has ordinary semantic HTML copy and a poster/static fallback; navigation and CTAs never depend on media state.
- Mobile may use `data-src-mobile`; when absent it falls back to the desktop source without breaking the layout.
- The runtime never knows or cares which provider generated a video.
- Provider selection is free-first at generation time, but current quotas/capabilities must be re-checked rather than hard-coded as permanent facts.
- The existing `skills/scroll-world/**` implementation remains untouched during this migration.
- No framework or build step is required to consume the new runtime; generated pages use browser-native ES modules.

## Review Focus

1. **Two cinematic sections visible at once:** only the section with the highest qualifying intersection may play; the previously active video pauses.
2. **Autoplay/load failure:** poster and semantic content remain visible/usable; no blocking play overlay appears.
3. **Reduced-motion or Save-Data users:** video sources are not eagerly fetched and scrub height/sticky behavior does not trap the user.
4. **Missing mobile asset:** mobile uses the desktop source/poster cleanly rather than rendering a blank media surface.
5. **Malformed/extreme scrub configuration and fast scrolling:** `scrollVh` resolves to default `2` when invalid, clamps to `1..3`, seek requests coalesce, and no runaway rAF loop persists after scrolling stops.

---

## File Structure

### New runtime and skill

- `skills/cinematic-web/SKILL.md` — agent workflow and product rules.
- `skills/cinematic-web/references/cinematic-engine.js` — public mount/destroy entrypoint only.
- `skills/cinematic-web/references/viewport-video.js` — viewport loading, play/pause, single-active coordination, poster transition.
- `skills/cinematic-web/references/micro-scrub.js` — bounded scrub math, lazy seekable loading, localized scroll scheduling, iOS priming.
- `skills/cinematic-web/references/media-utils.js` — shared source selection and simple media capability helpers.
- `skills/cinematic-web/references/cinematic.css` — layouts, poster/media states, responsive stacking, sticky scrub, reduced-motion and safe-area rules.
- `skills/cinematic-web/references/index-template.html` — semantic progressive-enhancement example.
- `skills/cinematic-web/references/section-types.md` — supported semantic section patterns and HTML contracts.
- `skills/cinematic-web/references/motion-rules.md` — when to use static/video/scrub and hard motion budgets.
- `skills/cinematic-web/references/prompts.md` — independent per-section generation prompt grammar.
- `skills/cinematic-web/references/video-pipeline.md` — provider capability selection, free-first policy, optimization and asset handoff.

### Test/support files

- `package.json` — dev-only Playwright dependency and test scripts.
- `playwright.config.mjs` — Chromium/WebKit browser projects and local test server.
- `tests/server.mjs` — zero-dependency static HTTP server for fixtures/modules.
- `tests/fixtures/cinematic-page.html` — deterministic semantic fixture covering video, scrub, content and CTA sections.
- `tests/progressive-enhancement.spec.mjs` — no-JS/normal-flow/browser shell tests.
- `tests/viewport-video.spec.mjs` — autoplay/lazy-load/poster/single-active tests.
- `tests/micro-scrub.spec.mjs` — clamp/seek/rAF/reduced-motion tests.
- `tests/mobile-accessibility.spec.mjs` — mobile source/fallback/inline/safe layout tests.
- `tests/skill-contract.test.mjs` — Node contract tests for the skill instructions/docs.
- `tests/manifest-contract.test.mjs` — JSON/plugin packaging contract tests.

### Modified packaging/docs

- `README.md` — present `cinematic-web` as the fork's primary direction and `scroll-world` as legacy.
- `.claude-plugin/plugin.json` — update description/homepage/version while preserving upstream author attribution.
- `.claude-plugin/marketplace.json` — expose both `./skills/cinematic-web` and `./skills/scroll-world`, with cinematic-web described as primary.
- `.github/workflows/ci.yml` — run Node contract tests plus Chromium/WebKit Playwright tests.

---

### Task 1: Progressive-Enhancement Shell and Browser Test Harness

**Files:**
- Create: `package.json`
- Create: `playwright.config.mjs`
- Create: `tests/server.mjs`
- Create: `tests/fixtures/cinematic-page.html`
- Create: `tests/progressive-enhancement.spec.mjs`
- Create: `skills/cinematic-web/references/cinematic-engine.js`
- Create: `skills/cinematic-web/references/cinematic.css`
- Create: `skills/cinematic-web/references/index-template.html`

**Interfaces:**
- Produces: `mountCinematicWeb(root = document, options = {}) -> { destroy(): void }` from `cinematic-engine.js`.
- DOM contract: semantic sections use `data-cw-kind="video|scrub|content|cards|hero|device-showcase|cta"`; JS never creates or replaces primary copy/navigation/CTA content.
- Test server: `node tests/server.mjs` serves repository root on `127.0.0.1:4173`.

- [ ] **Step 1: Add the browser test harness and write failing progressive-enhancement tests**

Create `package.json` with `type: "module"`, dev dependency `@playwright/test`, and scripts `test:browser`, `test:contracts`, and `test`. Create `playwright.config.mjs` with Chromium and WebKit projects and `webServer.command = "node tests/server.mjs"`.

In `tests/progressive-enhancement.spec.mjs`, assert:

```js
// JS disabled: semantic content is still present.
expect(await page.locator('h1').textContent()).toContain('Cinematic');
await expect(page.locator('[data-test="primary-cta"]')).toBeVisible();
await expect(page.locator('[data-cw-poster]').first()).toBeVisible();

// JS enabled: mounting does not replace semantic children.
expect(await page.locator('[data-test="semantic-copy"]').count()).toBeGreaterThan(0);

// A non-scrub section keeps natural document height before vs after mount.
expect(Math.abs(afterHeight - beforeHeight)).toBeLessThanOrEqual(1);
```

- [ ] **Step 2: Run the new browser test and verify it fails because the runtime/template do not exist yet**

Run: `npm install && npx playwright install chromium webkit && npm run test:browser -- tests/progressive-enhancement.spec.mjs`

Expected: FAIL on missing `skills/cinematic-web` assets or `mountCinematicWeb`.

- [ ] **Step 3: Implement the minimal progressive-enhancement shell**

Create semantic fixture/template markup containing ordinary hero copy, CTA links/buttons, poster images, a viewport-video section, a scrub section, normal content/cards, and final CTA. `cinematic-engine.js` must export `mountCinematicWeb`; for this task it only marks the root as mounted and returns an idempotent `destroy()` without generating primary content. `cinematic.css` must style normal document-flow sections and poster/media containers but must not add scrub-specific tall height yet.

- [ ] **Step 4: Run the progressive-enhancement test and verify it passes in Chromium and WebKit**

Run: `npm run test:browser -- tests/progressive-enhancement.spec.mjs`

Expected: PASS in both configured browser projects.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json playwright.config.mjs tests/server.mjs tests/fixtures/cinematic-page.html tests/progressive-enhancement.spec.mjs skills/cinematic-web/references/cinematic-engine.js skills/cinematic-web/references/cinematic.css skills/cinematic-web/references/index-template.html
git commit -m "feat: add cinematic progressive enhancement shell"
```

---

### Task 2: Viewport-Triggered Autoplay Controller

**Files:**
- Create: `skills/cinematic-web/references/media-utils.js`
- Create: `skills/cinematic-web/references/viewport-video.js`
- Modify: `skills/cinematic-web/references/cinematic-engine.js`
- Modify: `tests/fixtures/cinematic-page.html`
- Create: `tests/viewport-video.spec.mjs`

**Interfaces:**
- Consumes: semantic `[data-cw-kind="video"]` sections from Task 1.
- Produces: `selectMediaSource(video, isMobile) -> string | null` in `media-utils.js`.
- Produces: `mountViewportVideos(root, options = {}) -> { destroy(): void }` in `viewport-video.js`.
- `options` defaults: `{ playThreshold: 0.50, pauseThreshold: 0.15, prefetchMargin: '100% 0px', mobileQuery: '(max-width: 860px)' }`.
- Video contract: `video[data-cw-video][data-src]`, optional `data-src-mobile`, sibling/ancestor `[data-cw-poster]`.

- [ ] **Step 1: Write failing browser tests for lazy loading, play/pause thresholds, single-active playback, Save-Data, poster fallback, and no scroll seeking**

Use `page.addInitScript` to stub `HTMLMediaElement.play/pause/load` and `requestVideoFrameCallback` so tests exercise controller decisions without committing binary video fixtures. Assertions must include:

```js
// Before prefetch zone: no src attribute assigned.
expect(await video.getAttribute('src')).toBeNull();

// At >= 0.50 visible: play called.
expect(await playCalls(video)).toBeGreaterThan(0);

// Active section falls below 0.15: pause called.
expect(await pauseCalls(video)).toBeGreaterThan(0);

// Two qualifying sections: exactly one remains playing; highest ratio wins.
expect(await currentlyPlayingCount()).toBe(1);

// Successful first-frame callback hides poster via cw-has-frame.
await expect(section).toHaveClass(/cw-has-frame/);

// play() rejection or media error leaves poster visible.
await expect(failingSection).not.toHaveClass(/cw-has-frame/);

// Save-Data: no src assignment / play calls.
expect(await saveDataVideo.getAttribute('src')).toBeNull();

// Normal viewport video never assigns currentTime in response to scroll.
expect(await currentTimeWriteCount(video)).toBe(0);
```

- [ ] **Step 2: Run tests and verify they fail on missing controller behavior**

Run: `npm run test:browser -- tests/viewport-video.spec.mjs`

Expected: FAIL because `viewport-video.js` does not exist and the engine does not mount it.

- [ ] **Step 3: Implement `media-utils.js` source selection**

Implement exactly:

```js
export function selectMediaSource(video, isMobile) { /* data-src-mobile when mobile and present; else data-src; else null */ }
export function prefersReducedMotion(win = window) { /* matchMedia reduce */ }
export function saveDataEnabled(nav = navigator) { /* navigator.connection?.saveData === true */ }
```

No provider logic belongs here.

- [ ] **Step 4: Implement `mountViewportVideos(root, options)`**

Use one prefetch IntersectionObserver with `rootMargin: '100% 0px'` to assign the chosen source, set `preload='auto'`, and call `load()`. Use a second observer with thresholds `[0.15, 0.50, 1]` to maintain current intersection ratios. Choose the highest-ratio section at or above `0.50` as the only active video; pause the previous active video before starting a new one. Pause the active video when it falls below `0.15`. Do nothing when reduced motion or Save-Data is active.

Keep poster visible until `play()` resolves and the first frame paints: use `requestVideoFrameCallback` when available, with a `playing` event fallback. Load/play/error rejection must never remove the poster.

- [ ] **Step 5: Integrate the viewport controller into `mountCinematicWeb`**

`mountCinematicWeb` calls `mountViewportVideos` and its returned `destroy()` disconnects observers/listeners and pauses any active viewport video.

- [ ] **Step 6: Run tests**

Run: `npm run test:browser -- tests/viewport-video.spec.mjs tests/progressive-enhancement.spec.mjs`

Expected: PASS in Chromium and WebKit.

- [ ] **Step 7: Commit**

```bash
git add skills/cinematic-web/references/media-utils.js skills/cinematic-web/references/viewport-video.js skills/cinematic-web/references/cinematic-engine.js tests/fixtures/cinematic-page.html tests/viewport-video.spec.mjs
git commit -m "feat: add viewport cinematic playback"
```

---

### Task 3: Bounded Micro-Scrub Controller

**Files:**
- Create: `skills/cinematic-web/references/micro-scrub.js`
- Modify: `skills/cinematic-web/references/cinematic-engine.js`
- Modify: `skills/cinematic-web/references/cinematic.css`
- Modify: `tests/fixtures/cinematic-page.html`
- Create: `tests/micro-scrub.spec.mjs`

**Interfaces:**
- Consumes: `selectMediaSource`, `prefersReducedMotion`, `saveDataEnabled` from Task 2.
- Produces: `clampScrollVh(value) -> number`; invalid/non-finite => `2`, below `1` => `1`, above `3` => `3`.
- Produces: `mountMicroScrubs(root, options = {}) -> { destroy(): void }`.
- DOM contract: `section[data-cw-kind="scrub"][data-cw-scroll-vh]` containing `.cw-scrub__sticky`, `video[data-cw-scrub-video][data-src]`, optional `data-src-mobile`, and `[data-cw-poster]`.

- [ ] **Step 1: Write failing tests for the clamp, exact local height budget, localized seeking, reduced motion, fast-scroll seek coalescing, and rAF shutdown**

Assertions:

```js
expect(clampScrollVh(0)).toBe(1);
expect(clampScrollVh(1)).toBe(1);
expect(clampScrollVh(2)).toBe(2);
expect(clampScrollVh(99)).toBe(3);
expect(clampScrollVh('bad')).toBe(2);

// 2vh scrub => 300dvh total section track (2 progress viewports + 1 sticky viewport).
expect(section.style.getPropertyValue('--cw-scrub-height')).toBe('300dvh');

// Scroll inside scrub changes only scrub currentTime.
expect(await scrubCurrentTimeWrites()).toBeGreaterThan(0);
expect(await viewportVideoCurrentTimeWrites()).toBe(0);

// Rapid scroll while video.seeking=true does not queue additional seeks.
expect(await writesWhileSeeking()).toBe(0);

// Reduced motion: no blob/source load and section is not tall/sticky.
expect(await reducedMotionFetchCount()).toBe(0);

// Page with no scrub section: requestAnimationFrame count does not grow after idle.
expect(afterIdleRafCount - beforeIdleRafCount).toBe(0);
```

- [ ] **Step 2: Run tests and verify failure**

Run: `npm run test:browser -- tests/micro-scrub.spec.mjs`

Expected: FAIL because micro-scrub behavior is absent.

- [ ] **Step 3: Implement `clampScrollVh` and section sizing**

Parse `data-cw-scroll-vh`; write the clamped value back to `data-cw-scroll-vh-resolved`; set `--cw-scrub-height` to `${(resolved + 1) * 100}dvh`. CSS uses `min-height: var(--cw-scrub-height)` only for enhanced scrub sections, with a `100dvh` sticky child. Under `prefers-reduced-motion: reduce`, scrub height returns to `auto` and sticky positioning is disabled.

- [ ] **Step 4: Implement lazy seekable loading and iOS-safe priming for scrub video only**

When neither reduced motion nor Save-Data applies, prefetch scrub media near the viewport. Fetch the selected clip as a Blob and assign an object URL so seeking is independent of host byte-range support. Keep the poster visible through load errors. On the first pointer/touch gesture, prime loaded scrub videos with muted `play()` -> `pause()`; do not add this priming cost to ordinary viewport videos.

- [ ] **Step 5: Implement localized scrub progress and coalesced seeks without a permanent animation loop**

When a scrub section is intersecting, a passive scroll listener schedules at most one `requestAnimationFrame`. In that frame:

`progress = clamp(-section.getBoundingClientRect().top / (section.offsetHeight - innerHeight), 0, 1)`

Set `targetTime = progress * duration`. Skip assignment while `video.seeking` is true; after `seeked`, the next scroll/rAF uses the latest progress. Do not recurse with `requestAnimationFrame`. If there are zero scrub sections, install no scrub scroll listener and schedule no scrub rAF work.

- [ ] **Step 6: Integrate micro scrub into `mountCinematicWeb`**

Mount only when `root.querySelector('[data-cw-kind="scrub"]')` exists. Combine destroy functions from viewport and scrub controllers; `destroy()` must revoke created Blob URLs and remove observers/listeners.

- [ ] **Step 7: Run focused and regression tests**

Run: `npm run test:browser -- tests/micro-scrub.spec.mjs tests/viewport-video.spec.mjs tests/progressive-enhancement.spec.mjs`

Expected: PASS in Chromium and WebKit.

- [ ] **Step 8: Commit**

```bash
git add skills/cinematic-web/references/micro-scrub.js skills/cinematic-web/references/cinematic-engine.js skills/cinematic-web/references/cinematic.css tests/fixtures/cinematic-page.html tests/micro-scrub.spec.mjs
git commit -m "feat: add bounded micro scrub sections"
```

---

### Task 4: Mobile, Reduced-Motion, and Accessibility Hardening

**Files:**
- Modify: `skills/cinematic-web/references/cinematic.css`
- Modify: `skills/cinematic-web/references/viewport-video.js`
- Modify: `skills/cinematic-web/references/micro-scrub.js`
- Modify: `skills/cinematic-web/references/index-template.html`
- Modify: `tests/fixtures/cinematic-page.html`
- Create: `tests/mobile-accessibility.spec.mjs`

**Interfaces:**
- Consumes: runtime APIs from Tasks 1–3.
- Produces no new public JS API; this task hardens the existing DOM/runtime contract.

- [ ] **Step 1: Write failing mobile/accessibility tests**

Cover the Review Focus cases:

```js
// Mobile-specific source wins when present.
expect(await mobileVideo.getAttribute('src')).toBe('/media/mobile.mp4');

// Missing mobile source falls back to desktop.
expect(await fallbackVideo.getAttribute('src')).toBe('/media/desktop.mp4');

// Runtime enforces inline muted playback attributes/properties.
expect(await video.getAttribute('playsinline')).not.toBeNull();
expect(await video.evaluate(v => v.muted)).toBe(true);

// Mobile semantic order: copy and CTA remain reachable without waiting for media.
await expect(page.locator('[data-test="mobile-copy"]')).toBeVisible();
await expect(page.locator('[data-test="primary-cta"]')).toBeVisible();

// Reduced motion: poster visible, no play calls, no scrub fetch/height trap.
expect(await totalPlayCalls()).toBe(0);
await expect(page.locator('[data-cw-poster]').first()).toBeVisible();
```

Also assert the loaded stylesheet contains `env(safe-area-inset-bottom)` and a `prefers-reduced-motion` rule, since emulated safe-area values are commonly zero and cannot prove the CSS token through computed pixels.

- [ ] **Step 2: Run tests and verify failure**

Run: `npm run test:browser -- tests/mobile-accessibility.spec.mjs`

Expected: FAIL on source/fallback/layout/hardening gaps.

- [ ] **Step 3: Implement responsive layouts and safe-area rules**

In `cinematic.css`, support the approved layouts only: hero, full-bleed media, split text/media, device/product showcase, normal content/cards, micro scrub spotlight, CTA. At `max-width: 860px`, split layouts stack in semantic DOM order; media never obscures copy/CTA; bottom padding includes `env(safe-area-inset-bottom)` where relevant. Do not add decorative particles.

- [ ] **Step 4: Enforce media attributes and reduced-motion behavior in both controllers**

Before any playback/priming, set `video.muted = true`, `video.playsInline = true`, and mirror `muted`/`playsinline` attributes. Under reduced motion or Save-Data, do not assign media source or start scrub fetches; CSS keeps posters/static content visible and disables scrub pinning.

- [ ] **Step 5: Run mobile/accessibility plus all browser regressions**

Run: `npm run test:browser`

Expected: PASS in Chromium and WebKit, including mobile viewport cases defined in the spec file.

- [ ] **Step 6: Commit**

```bash
git add skills/cinematic-web/references/cinematic.css skills/cinematic-web/references/viewport-video.js skills/cinematic-web/references/micro-scrub.js skills/cinematic-web/references/index-template.html tests/fixtures/cinematic-page.html tests/mobile-accessibility.spec.mjs
git commit -m "feat: harden cinematic web for mobile and reduced motion"
```

---

### Task 5: Author the New Skill and Provider-Agnostic Video Pipeline

**Files:**
- Create: `skills/cinematic-web/SKILL.md`
- Create: `skills/cinematic-web/references/section-types.md`
- Create: `skills/cinematic-web/references/motion-rules.md`
- Create: `skills/cinematic-web/references/prompts.md`
- Create: `skills/cinematic-web/references/video-pipeline.md`
- Create: `tests/skill-contract.test.mjs`

**Interfaces:**
- Consumes: runtime HTML/data-attribute contract from Tasks 1–4.
- Produces: agent-facing build workflow. Runtime receives finished poster/video assets only; generation provider remains outside runtime.

- [ ] **Step 1: Write failing Node contract tests for the skill rules**

Using `node:test` + `fs`, assert the docs encode the approved invariants. Tests should check for exact canonical values/phrases rather than broad prose similarity:

```js
assert.match(skill, /viewport-triggered autoplay/i);
assert.match(skill, /maximum.*3.*viewport/i);
assert.match(skill, /default.*2.*viewport/i);
assert.match(skill, /normal document flow/i);
assert.match(skill, /free-first/i);
assert.match(skill, /re-check.*capabilit|verify.*capabilit/i);
assert.match(skill, /no connector|do not generate connector/i);
assert.match(skill, /communication purpose/i);
assert.match(pipeline, /provider.*capabilit/i);
assert.match(pipeline, /ffmpeg/i);
```

Also assert `section-types.md` documents the same `data-cw-kind`, `data-cw-video`, `data-cw-scrub-video`, `data-src`, `data-src-mobile`, and `data-cw-scroll-vh` contracts implemented by runtime code.

- [ ] **Step 2: Run contract tests and verify failure**

Run: `npm run test:contracts`

Expected: FAIL because the skill/reference docs do not exist.

- [ ] **Step 3: Write `SKILL.md` around a normal-site-first decision flow**

Required workflow:

1. understand product/brand and useful content first;
2. decide which sections actually benefit from motion;
3. default those sections to viewport video;
4. allow micro scrub only for a focused reveal and choose `1`, `2` default, or justified `3` viewport heights;
5. explicitly reject page-wide scrub/connector chains for the canonical path;
6. design semantic HTML before enhancement;
7. choose/generate independent motion assets;
8. wire the runtime and perform mobile/reduced-motion/failure QA.

The skill must explicitly say motion is not required for every section and must not gate information or CTAs.

- [ ] **Step 4: Write section/layout and motion-rule references**

`section-types.md` contains copy-paste semantic HTML patterns for the seven approved roles only. `motion-rules.md` defines static vs viewport-video vs scrub selection, autoplay thresholds, single-active rule, Save-Data/reduced-motion behavior, and the 1–3 scrub budget.

- [ ] **Step 5: Write independent-section prompt grammar**

`prompts.md` reuses a shared brand/art-direction preamble for cohesion but gives each animated section its own purpose, action, camera motion, duration, aspect/composition, and no-unwanted-text constraints. It must not require a continuous camera path or frame-matched endpoints.

- [ ] **Step 6: Write `video-pipeline.md` with a minimal provider capability boundary and free-first selection policy**

Document a build-time provider checklist: image-to-video, aspect ratio, duration, resolution, optional start/end frame control only when needed, current price/quota, commercial/output restrictions when relevant. Name Wan/MiniMax/Seedance only as examples/candidates; require live capability/quota verification each build and do not encode today's free allowance as a permanent rule.

Provide generic web optimization guidance: no audio, `yuv420p`, `+faststart`, sensible CRF/GOP, lighter mobile variants when warranted. Independent sections produce one final clip each; no N-1 connector stage.

- [ ] **Step 7: Run contract tests**

Run: `npm run test:contracts`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add skills/cinematic-web/SKILL.md skills/cinematic-web/references/section-types.md skills/cinematic-web/references/motion-rules.md skills/cinematic-web/references/prompts.md skills/cinematic-web/references/video-pipeline.md tests/skill-contract.test.mjs
git commit -m "feat: add cinematic web agent skill"
```

---

### Task 6: Package the New Skill Without Breaking Legacy Scroll World

**Files:**
- Modify: `README.md`
- Modify: `.claude-plugin/plugin.json`
- Modify: `.claude-plugin/marketplace.json`
- Create: `tests/manifest-contract.test.mjs`

**Interfaces:**
- Consumes: both `skills/cinematic-web` and existing `skills/scroll-world`.
- Produces: plugin/marketplace metadata that exposes both skills, with cinematic-web as the primary fork direction.

- [ ] **Step 1: Write failing manifest contract tests**

Parse both JSON files and assert:

```js
assert.equal(plugin.name, 'scroll-world'); // preserve plugin/install identity during migration
assert.equal(plugin.version, '0.9.0');
assert.match(plugin.description, /cinematic/i);
assert.deepEqual(marketplace.plugins[0].skills.sort(), ['./skills/cinematic-web', './skills/scroll-world'].sort());
assert.equal(fs.existsSync('skills/scroll-world/SKILL.md'), true);
assert.equal(fs.existsSync('skills/cinematic-web/SKILL.md'), true);
```

Assert upstream author/owner attribution fields are still present rather than silently replacing them.

- [ ] **Step 2: Run contract tests and verify failure**

Run: `npm run test:contracts`

Expected: FAIL because manifests still expose only legacy scroll-world.

- [ ] **Step 3: Update plugin and marketplace metadata**

Keep plugin install identity `scroll-world`. Bump plugin version to `0.9.0`, point homepage to the fork, describe cinematic normal-scroll pages plus optional bounded scrub, and preserve existing upstream author attribution. In marketplace metadata, include both skill paths and state that `cinematic-web` is the canonical new path while `scroll-world` is legacy continuous-scroll behavior.

- [ ] **Step 4: Rewrite README around the fork's primary workflow**

Lead with normal scrolling + viewport autoplay + optional 1–3 viewport micro scrub. Explain that the original continuous Scroll World skill remains included for legacy/specialized use. Remove the paid-provider chain from the primary requirements; generation docs are provider-agnostic/free-first. Preserve MIT attribution/license language and do not pretend the fork authored the upstream history.

- [ ] **Step 5: Run contracts and verify the legacy folder is unchanged**

Run:

```bash
npm run test:contracts
git diff --exit-code main -- skills/scroll-world
```

Expected: contract tests PASS; second command exits `0` with no diff.

- [ ] **Step 6: Commit**

```bash
git add README.md .claude-plugin/plugin.json .claude-plugin/marketplace.json tests/manifest-contract.test.mjs
git commit -m "docs: make cinematic web the primary fork workflow"
```

---

### Task 7: CI and Whole-Branch Acceptance

**Files:**
- Create: `.github/workflows/ci.yml`
- Modify: `playwright.config.mjs` only if final browser-project coverage needs adjustment.
- Modify: `package.json` only if final script composition needs adjustment.

**Interfaces:**
- Consumes: all tasks above.
- Produces: repeatable CI verification; no product/runtime interface changes.

- [ ] **Step 1: Add CI that runs contracts and browser tests**

Use GitHub Actions on Ubuntu with Node 22. Steps:

```yaml
- uses: actions/checkout@v4
- uses: actions/setup-node@v4
  with:
    node-version: 22
    cache: npm
- run: npm ci
- run: npx playwright install --with-deps chromium webkit
- run: npm test
```

Trigger on pushes and pull requests.

- [ ] **Step 2: Run the complete local/agent verification suite**

Run:

```bash
npm ci
npx playwright install chromium webkit
npm test
git diff --exit-code main -- skills/scroll-world
```

Expected: all Node contract tests pass; all Chromium/WebKit browser tests pass; legacy `skills/scroll-world` has no diff.

- [ ] **Step 3: Perform explicit browser acceptance checks not reducible to one assertion**

In Chromium desktop, Chromium phone viewport, and WebKit phone viewport verify:

- ordinary wheel/touch scrolling moves through the page normally;
- viewport video begins around halfway visible and pauses after leaving;
- only one autoplay video plays when two sections overlap;
- no autoplay video requires a click-to-play overlay;
- scrub sections occupy at most the configured local 1–3 viewport progress budget;
- a fast fling through a scrub does not freeze the page or trap scroll;
- reduced-motion shows static posters and natural-height scrub content;
- with media requests forced to fail, copy/navigation/CTA remain usable;
- no console errors or unhandled promise rejections.

- [ ] **Step 4: Run plan/spec coverage review before declaring completion**

Check every Success Criterion in `docs/superpowers/specs/2026-10-03-cinematic-web-design.md` against at least one passing automated test or the explicit browser acceptance list. If any criterion has neither, add the smallest owning test before continuing.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/ci.yml package.json package-lock.json playwright.config.mjs
git commit -m "ci: verify cinematic web runtime"
```

- [ ] **Step 6: Final branch evidence**

Record:

```bash
git status --short
git log --oneline --decorate -8
npm test
```

Expected: clean worktree; task commits present; full suite green. Do not claim completion without this evidence.
